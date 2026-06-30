// Step A of the no-API-key notes flow — prepare balanced work batches.
// Finds sessions still missing `summary` (or missing `deepdive` while having chapters),
// then splits them into N balanced batches (by transcript length + chapter count) and
// writes the id lists to .cache/gen-batches/b{k}.json. Hand each batch file to a subagent
// using scripts/gen-notes-prompt.md, which writes .cache/gen/{id}.json; then run merge-notes.
//
// Run:  node scripts/prep-gen-batches.mjs [N]   (default N=14; use --all to re-do every session)

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const args = process.argv.slice(2);
const all = args.includes("--all");
const N = Number(args.find((a) => /^\d+$/.test(a))) || 14;

const sessions = JSON.parse(readFileSync("public/data/sessions.json", "utf8"));
const needs = (s) =>
  all || !Array.isArray(s.summary) || !s.summary.length ||
  ((s.chapters || []).length > 0 && (!Array.isArray(s.deepdive) || !s.deepdive.length));

const targets = sessions.filter(needs).map((s) => {
  let w = (s.chapters || []).length * 400;
  try { w += (JSON.parse(readFileSync(`.cache/raw/${s.id}.json`, "utf8")).transcript || "").length; } catch (e) {}
  return { id: s.id, w };
});

if (!targets.length) { console.log("Nothing to do — every session already has summary/deepdive."); process.exit(0); }

// greedy longest-processing-time bin packing → even batches
targets.sort((a, b) => b.w - a.w);
const batches = Array.from({ length: N }, () => ({ ids: [], w: 0 }));
for (const x of targets) { batches.sort((a, b) => a.w - b.w); batches[0].ids.push(x.id); batches[0].w += x.w; }

rmSync(".cache/gen-batches", { recursive: true, force: true });
mkdirSync(".cache/gen-batches", { recursive: true });
batches.forEach((b, k) => {
  b.ids.sort((a, b) => Number(a) - Number(b));
  writeFileSync(`.cache/gen-batches/b${k}.json`, JSON.stringify(b.ids));
});

console.log(`targets: ${targets.length} | batches: ${batches.filter((b) => b.ids.length).length}`);
batches.forEach((b, k) => b.ids.length && console.log(`  b${k} (${b.ids.length}, ~${Math.round(b.w / 1000)}k): ${b.ids.join(",")}`));
console.log(`\nNext: dispatch one subagent per batch with scripts/gen-notes-prompt.md (replace {BATCH}),`);
console.log(`then run:  node scripts/merge-notes.mjs`);
