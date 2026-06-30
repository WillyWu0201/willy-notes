// Step C of the no-API-key notes flow — validate + merge generated notes.
// Reads .cache/gen/{id}.json (written by subagents), validates each against the freshly
// fetched .cache/raw chapters (deepdive must align 1:1, zh/en must have parity), then
// merges summary/deepdive/summary_en/deepdive_en into public/data/sessions.json. Also
// re-syncs a session's chapters to raw when Apple has since refined them (so the deep
// dive stays aligned). Crash-safe: writes only if every gen file passes.
//
// Run:  node scripts/merge-notes.mjs   (then: node scripts/build-details.mjs)

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const OUT = "public/data/sessions.json";
const sessions = JSON.parse(readFileSync(OUT, "utf8"));
const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));

const isStrArr = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => typeof x === "string" && x.trim());
function ddOk(dd, chapters) {
  if (!Array.isArray(dd)) return "deepdive not array";
  if ((chapters || []).length === 0) return dd.length === 0 ? null : "deepdive should be [] (no chapters)";
  if (dd.length !== chapters.length) return `deepdive ${dd.length} != ${chapters.length} chapters`;
  for (let i = 0; i < chapters.length; i++) {
    const [t, title] = chapters[i];
    if (Number(dd[i].t) !== Number(t)) return `dd[${i}].t ${dd[i].t} != ${t}`;
    if (String(dd[i].title) !== String(title)) return `dd[${i}].title mismatch`;
    if (typeof dd[i].body !== "string" || !dd[i].body.trim()) return `dd[${i}].body empty`;
  }
  return null;
}

const problems = [];
let merged = 0, chapSync = 0;
const ids = readdirSync(".cache/gen").filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
for (const id of ids) {
  const s = byId[id];
  if (!s) { problems.push(`${id}: not in sessions.json`); continue; }
  let o, raw;
  try { o = JSON.parse(readFileSync(`.cache/gen/${id}.json`, "utf8")); }
  catch (e) { problems.push(`${id}: invalid JSON (${e.message})`); continue; }
  try { raw = JSON.parse(readFileSync(`.cache/raw/${id}.json`, "utf8")); }
  catch (e) { problems.push(`${id}: raw missing (${e.message})`); continue; }
  const p = [];
  if (o.id !== id) p.push("id mismatch");
  if (!isStrArr(o.summary)) p.push("summary not non-empty string[]");
  if (!isStrArr(o.summary_en)) p.push("summary_en not non-empty string[]");
  const e1 = ddOk(o.deepdive, raw.chapters); if (e1) p.push("zh " + e1);
  const e2 = ddOk(o.deepdive_en, raw.chapters); if (e2) p.push("en " + e2);
  if (p.length) { problems.push(`${id}: ${p.join("; ")}`); continue; }
  if (JSON.stringify(s.chapters) !== JSON.stringify(raw.chapters)) { s.chapters = raw.chapters; chapSync++; }
  s.summary = o.summary;
  s.deepdive = o.deepdive;
  s.summary_en = o.summary_en;
  s.deepdive_en = o.deepdive_en;
  merged++;
}

const missing = sessions.filter((s) => !s.summary).map((s) => s.id);
console.log(`gen files: ${ids.length} | merged: ${merged} | chapters synced: ${chapSync} | problems: ${problems.length}`);
if (problems.length) console.log("PROBLEMS:\n" + problems.join("\n"));
console.log(`sessions still without summary: ${missing.length}${missing.length ? " -> " + missing.join(",") : ""}`);
if (problems.length === 0) { writeFileSync(OUT, JSON.stringify(sessions, null, 2)); console.log("WROTE", OUT, "— now run: node scripts/build-details.mjs"); }
else { console.log("*** not writing — re-run the listed ids, then merge again ***"); process.exit(1); }
