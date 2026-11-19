// Step 3 of the daily digest — validate the analyses Claude wrote and merge them into the day.
// Reads .cache/digest/{date}/items/{i}.json (bundle from digest-prep) and
// .cache/digest/{date}/analysis/{i}.json (Claude), validates each analysis against its
// bundle entry, and merges the ones that pass into content/digests/{date}.json.
// A bad analysis is reported and skipped; it never blocks the rest of the day.
//
// Run:  node scripts/digest-merge.mjs [--date YYYY-MM-DD]

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES, isWebUrl } from "./digest-lib.mjs";

export const LIMITS = { summary: 160, line: 120 };
const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

const isText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const isLines = (a, min, max) => Array.isArray(a) && a.length >= min && a.length <= max && a.every((s) => isText(s, LIMITS.line));
const present = (v) => v !== undefined && v !== null;

function furtherError(further, entry) {
  if (!present(further)) return null;
  if (!Array.isArray(further) || further.length > 5) return "further 最多 5 條";
  for (const f of further) {
    if (!isText(f?.title, LIMITS.line) || !isText(f?.note, LIMITS.line)) return "further 每條要有 title 和 note";
    if (present(f.url) && !(isWebUrl(f.url) && entry.links.includes(f.url))) return `further 的連結不在原文裡：${f.url}`;
  }
  return null;
}

export function validateAnalysis(a, entry) {
  if (!a || typeof a !== "object") return "分析不是 JSON 物件";
  if (a.url !== entry.url) return `url 跟素材不一致：${a.url}`;
  if (!CATEGORY_IDS.includes(a.category)) return `category 不是 ${CATEGORY_IDS.join("、")} 之一：${a.category}`;
  if (a.drop) return isText(a.dropReason, LIMITS.line) ? null : "drop 時要寫 dropReason";
  if (!isText(a.summary, LIMITS.summary)) return `summary 要有內容、最多 ${LIMITS.summary} 字`;
  if (a.category === "dev" && entry.deep) {
    if (!isLines(a.points, 3, 5)) return "points 要 3–5 條、每條最多 120 字";
    if (!isLines(a.questions, 2, 3)) return "questions 要 2–3 條、每條最多 120 字";
    return furtherError(a.further, entry);
  }
  if (present(a.points)) return "points 只能出現在 dev 類的深度分析";
  if (present(a.questions)) return "questions 只能出現在 dev 類的深度分析";
  if (present(a.further)) return "further 只能出現在 dev 類的深度分析";
  return null;
}

function analysisFields(a, entry) {
  if (a.drop) return { category: a.category, drop: true, dropReason: a.dropReason };
  const deep = a.category === "dev" && entry.deep;
  return {
    category: a.category, drop: false, summary: a.summary, deep,
    ...(deep ? { points: a.points, questions: a.questions, further: a.further || [] } : {}),
  };
}

export function mergeDay(day, entries, analyses) {
  const out = structuredClone(day);
  const problems = [];
  let merged = 0;
  for (const [index, a] of [...analyses].sort(([x], [y]) => x - y)) {
    const item = out.items[index];
    const entry = entries.get(index);
    const error = !item || !entry ? "找不到對應的文章或素材檔"
      : item.url !== entry.url ? `素材檔的 url 跟這個位置的文章不一致：${entry.url}`
      : validateAnalysis(a, entry);
    if (error) {
      problems.push({ index, url: a?.url ?? item?.url ?? null, error });
      continue;
    }
    Object.assign(item, analysisFields(a, entry));
    merged++;
  }
  return { day: out, merged, problems };
}

function readDir(dir, problems) {
  const map = new Map();
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir).filter((f) => /^\d+\.json$/.test(f))) {
    const index = Number(f.slice(0, -5));
    try {
      map.set(index, JSON.parse(readFileSync(join(dir, f), "utf8")));
    } catch (e) {
      problems.push({ index, url: null, error: `${f} 不是合法 JSON：${e.message}` });
    }
  }
  return map;
}

// Quiet days (no day file, no analyses) are a no-op.
export function mergeFiles(date) {
  const dayPath = join("content/digests", `${date}.json`);
  const dir = join(".cache/digest", date);
  if (!existsSync(dayPath)) return { merged: 0, problems: [] };
  const readProblems = [];
  const entries = readDir(join(dir, "items"), readProblems);
  const analyses = readDir(join(dir, "analysis"), readProblems);
  const result = mergeDay(JSON.parse(readFileSync(dayPath, "utf8")), entries, analyses);
  if (result.merged) writeFileSync(dayPath, JSON.stringify(result.day, null, 2) + "\n");
  return { merged: result.merged, problems: [...readProblems, ...result.problems] };
}

// An analysis file exists for an item that has not been merged yet.
export function needsMerge(day, analysisIndexes) {
  return analysisIndexes.some((i) => day.items[i] && !day.items[i].summary && !day.items[i].drop);
}

const RECENT_DAYS = 7;

// Today plus any recent cached date still waiting for a merge — a run whose collect and
// publish fell on different dates (late start, interrupted run) is picked up the next time.
export function mergePending(today) {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_DAYS);
  const since = cutoff.toISOString().slice(0, 10);
  const cached = existsSync(".cache/digest") ? readdirSync(".cache/digest").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  const dates = cached.filter((d) => d >= since && d !== today && pendingOnDisk(d)).sort();
  const results = [...dates, today].map((d) => ({ date: d, ...mergeFiles(d) }));
  return {
    dates: results.filter((r) => r.merged).map((r) => r.date),
    merged: results.reduce((n, r) => n + r.merged, 0),
    problems: results.flatMap((r) => r.problems.map((p) => ({ ...p, date: r.date }))),
  };
}

function pendingOnDisk(date) {
  const dayPath = join("content/digests", `${date}.json`);
  const dir = join(".cache/digest", date, "analysis");
  if (!existsSync(dayPath) || !existsSync(dir)) return false;
  const indexes = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).map((f) => Number(f.slice(0, -5)));
  return needsMerge(JSON.parse(readFileSync(dayPath, "utf8")), indexes);
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateFromArgs(argv) {
  const i = argv.indexOf("--date");
  return i !== -1 ? argv[i + 1] : todayLocal();
}

export function printMerge({ merged, problems }) {
  console.log(`MERGED: ${merged}`);
  for (const p of problems) console.log(`PROBLEM: ${p.date ? `${p.date} ` : ""}${p.index} ${p.url ?? "-"} ${p.error}`);
}

if (import.meta.url === `file://${process.argv[1]}`) printMerge(mergeFiles(dateFromArgs(process.argv)));
