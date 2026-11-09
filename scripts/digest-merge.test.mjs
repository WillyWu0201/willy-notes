import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAnalysis, mergeDay, mergeFiles, LIMITS } from "./digest-merge.mjs";

const entry = { index: 0, url: "https://a.test/p", deep: true, links: ["https://x.test/cited"] };
const good = {
  url: "https://a.test/p", category: "dev", drop: false, dropReason: null, summary: "一句話",
  points: ["a", "b", "c"], questions: ["q1", "q2"],
  further: [{ title: "Cited", url: "https://x.test/cited", note: "n" }, { title: "Lean", note: "文中提到，未附連結" }],
};

test("validateAnalysis accepts a deep dev analysis with cited links and unlinked mentions", () => {
  assert.equal(validateAnalysis(good, entry), null);
});
test("validateAnalysis rejects an analysis written for a different article", () => {
  assert.match(validateAnalysis({ ...good, url: "https://a.test/other" }, entry), /url/);
});
test("validateAnalysis rejects unknown categories", () => {
  assert.match(validateAnalysis({ ...good, category: "security" }, entry), /category/);
});
test("validateAnalysis enforces 3–5 points and 2–3 questions for deep dev items", () => {
  assert.match(validateAnalysis({ ...good, points: ["a", "b"] }, entry), /points/);
  assert.match(validateAnalysis({ ...good, points: ["1", "2", "3", "4", "5", "6"] }, entry), /points/);
  assert.match(validateAnalysis({ ...good, questions: ["1", "2", "3", "4"] }, entry), /questions/);
  assert.match(validateAnalysis({ ...good, questions: undefined }, entry), /questions/);
});
test("validateAnalysis allows only a summary for non-deep or non-dev items", () => {
  const plain = { url: entry.url, category: "industry", drop: false, dropReason: null, summary: "s" };
  assert.equal(validateAnalysis(plain, entry), null);
  assert.match(validateAnalysis({ ...good, category: "industry" }, entry), /points/);
  assert.match(validateAnalysis(good, { ...entry, deep: false }), /points/);
  assert.match(validateAnalysis({ ...plain, further: [{ title: "X", note: "n" }] }, entry), /further/);
});
test("validateAnalysis rejects further links that are not in the article or not http(s)", () => {
  assert.match(validateAnalysis({ ...good, further: [{ title: "X", url: "https://made.up/x", note: "n" }] }, entry), /further/);
  assert.match(validateAnalysis({ ...good, further: [{ title: "X", url: "javascript:alert(1)", note: "n" }] }, { ...entry, links: ["javascript:alert(1)"] }), /further/);
  const six = Array.from({ length: 6 }, () => ({ title: "L", note: "n" }));
  assert.match(validateAnalysis({ ...good, further: six }, entry), /further/);
});
test("validateAnalysis requires a summary unless dropped, a reason when dropping, and caps lengths", () => {
  assert.match(validateAnalysis({ ...good, summary: "" }, entry), /summary/);
  assert.match(validateAnalysis({ url: entry.url, category: "apple", drop: true, dropReason: null }, entry), /dropReason/);
  assert.equal(validateAnalysis({ url: entry.url, category: "apple", drop: true, dropReason: "只是資安日報" }, entry), null);
  assert.equal(LIMITS.summary, 160);
  assert.equal(LIMITS.line, 120);
  assert.match(validateAnalysis({ ...good, summary: "長".repeat(161) }, entry), /summary/);
  assert.match(validateAnalysis({ ...good, points: ["a", "b", "長".repeat(121)] }, entry), /points/);
});
test("mergeDay merges valid analyses and reports bad ones without blocking the rest", () => {
  const day = { date: "d", items: [{ url: "https://a.test/p", title: "P" }, { url: "https://a.test/q", title: "Q" }] };
  const entries = new Map([[0, entry], [1, { ...entry, index: 1, url: "https://a.test/q" }]]);
  const analyses = new Map([[0, good], [1, { ...good, url: "https://a.test/q", category: "nope" }]]);
  const out = mergeDay(day, entries, analyses);
  assert.equal(out.merged, 1);
  assert.equal(out.day.items[0].category, "dev");
  assert.equal(out.day.items[0].deep, true);
  assert.deepEqual(out.day.items[0].points, ["a", "b", "c"]);
  assert.equal(out.day.items[0].title, "P");
  assert.equal(out.day.items[1].category, undefined);
  assert.deepEqual(out.problems.map((p) => p.index), [1]);
});
test("mergeDay reports an analysis whose item or bundle entry is missing", () => {
  const day = { date: "d", items: [{ url: "https://a.test/p" }] };
  const out = mergeDay(day, new Map(), new Map([[0, good], [5, good]]));
  assert.equal(out.merged, 0);
  assert.deepEqual(out.problems.map((p) => p.index), [0, 5]);
});
test("mergeFiles is a no-op on a day without a digest file", () => {
  assert.deepEqual(mergeFiles("1999-01-01"), { merged: 0, problems: [] });
});
