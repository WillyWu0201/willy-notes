import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATEGORIES } from "./digest-lib.mjs";
import { itemId, videoOf, toTaipeiIso, buildApi, writeApi } from "./digest-api.mjs";

const day = { date: "2026-11-09", generatedAt: "2026-11-09T01:01:52.522Z", items: [
  { source: "Addy", title: "Agentic <Verification>", url: "https://a.test/v", date: "2026-10-14", curated: true, groups: ["AI"],
    category: "dev", deep: true, summary: "瓶頸是驗證", points: ["p1", "p2", "p3"], questions: ["q1", "q2"],
    further: [{ title: "Cited", url: "https://x.test/c", note: "n" }, { title: "Lean", note: "m" }] },
  { source: "AI Engineer", title: "Talk", url: "https://www.youtube.com/watch?v=9RKrSF9d2SE", curated: true, groups: ["AI"], category: "dev", deep: false, summary: "影片摘要" },
  { source: "iThome", title: "GPT-6", url: "https://i.test/1", date: "2026-11-08", groups: ["AI"], category: "industry", summary: "新模型" },
  { source: "iThome", title: "資安日報", url: "https://i.test/2", groups: ["iOS / Apple"], category: "apple", drop: true, dropReason: "無關" },
  { source: "FSC", title: "穩定幣", url: "https://f.test/1", groups: ["虛擬資產"] },
  { source: "X", title: "Evil", url: "javascript:alert(1)", groups: ["AI"], category: "industry", summary: "x" },
] };

test("itemId is the first 16 hex chars of sha256(url)", () => {
  const url = "https://simonwillison.net/2026/Nov/17/datasette-lite/";
  const id = itemId(url);
  assert.equal(id, createHash("sha256").update(url).digest("hex").slice(0, 16));
  assert.equal(id.length, 16);
});

test("videoOf recognises the three YouTube forms and nothing else", () => {
  const yt = { provider: "youtube", id: "9RKrSF9d2SE" };
  assert.deepEqual(videoOf("https://www.youtube.com/watch?v=9RKrSF9d2SE"), yt);
  assert.deepEqual(videoOf("https://youtu.be/9RKrSF9d2SE?t=3"), yt);
  assert.deepEqual(videoOf("https://www.youtube.com/shorts/9RKrSF9d2SE"), yt);
  assert.equal(videoOf("https://www.youtube.com/@AIEngineer"), null);
  assert.equal(videoOf("https://vimeo.com/1"), null);
  assert.equal(videoOf("not a url"), null);
});

test("toTaipeiIso converts UTC to +08:00 without milliseconds", () => {
  assert.equal(toTaipeiIso("2026-11-18T01:01:52.522Z"), "2026-11-18T09:01:52+08:00");
  assert.equal(toTaipeiIso("2026-11-18T17:00:00.000Z"), "2026-11-19T01:00:00+08:00");
});

test("buildApi index lists categories, days newest first, and per-category counts", () => {
  const older = { ...day, date: "2026-11-08", generatedAt: "2026-11-08T01:00:00.000Z", items: day.items.slice(2, 3) };
  const { index } = buildApi([day, older]);
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.minimumAppVersion, "1.0");
  assert.deepEqual(index.categories, CATEGORIES);
  assert.deepEqual(index.days.map((d) => d.date), ["2026-11-09", "2026-11-08"]);
  assert.deepEqual(index.days[0].counts, { dev: 2, industry: 1, apple: 0, finance: 1, security: 0 });
  assert.equal(index.days[0].total, 4);
  assert.deepEqual(index.days[1].counts, { dev: 0, industry: 1, apple: 0, finance: 0, security: 0 });
  assert.equal(index.generatedAt, "2026-11-09T09:01:52+08:00");
  assert.equal(buildApi([day], { minimumAppVersion: "99.0" }).index.minimumAppVersion, "99.0");
});

test("buildApi day items skip dropped and non-http items and match the web page grouping", () => {
  const f = buildApi([day]).files.get("2026-11-09");
  assert.equal(f.schemaVersion, 1);
  assert.equal(f.date, "2026-11-09");
  assert.equal(f.generatedAt, "2026-11-09T09:01:52+08:00");
  assert.deepEqual(f.items.map((i) => i.title), ["Agentic <Verification>", "Talk", "GPT-6", "穩定幣"]);
  assert.deepEqual(f.items.map((i) => i.category), ["dev", "dev", "industry", "finance"]);
});

test("buildApi maps fields: publishedOn, nullable summary, deep-only fields, further url only when http", () => {
  const [deep, talk, gpt, coin] = buildApi([day]).files.get("2026-11-09").items;
  assert.equal(deep.deep, true);
  assert.equal(deep.publishedOn, "2026-10-14");
  assert.deepEqual(deep.points, ["p1", "p2", "p3"]);
  assert.deepEqual(deep.questions, ["q1", "q2"]);
  assert.deepEqual(deep.further[0], { title: "Cited", url: "https://x.test/c", note: "n" });
  assert.equal("url" in deep.further[1], false);
  assert.equal(deep.id, itemId("https://a.test/v"));
  assert.equal(talk.deep, false);
  assert.equal("points" in talk, false);
  assert.equal("questions" in talk, false);
  assert.equal("further" in talk, false);
  assert.deepEqual(talk.video, { provider: "youtube", id: "9RKrSF9d2SE" });
  assert.equal(gpt.video, null);
  assert.equal(coin.publishedOn, null);
  assert.equal(coin.summary, null);
});

test("buildApi drops a non-http further url but keeps the entry", () => {
  const bad = { ...day, items: [{ ...day.items[0], further: [{ title: "Bad", url: "javascript:alert(2)", note: "n" }] }] };
  const [i] = buildApi([bad]).files.get("2026-11-09").items;
  assert.deepEqual(i.further, [{ title: "Bad", note: "n" }]);
});

test("buildApi dedupes items with the same id within a day", () => {
  const twice = { ...day, items: [day.items[2], { ...day.items[2], title: "GPT-6 again" }] };
  const { index, files } = buildApi([twice]);
  assert.deepEqual(files.get("2026-11-09").items.map((i) => i.title), ["GPT-6"]);
  assert.equal(index.days[0].total, 1);
});

test("writeApi writes index and day files and removes stale day files", () => {
  const dir = mkdtempSync(join(tmpdir(), "api-"));
  writeFileSync(join(dir, "2020-01-01.json"), "{}");
  writeApi(dir, [day]);
  assert.deepEqual(readdirSync(dir).sort(), ["2026-11-09.json", "index.json"]);
  assert.equal(existsSync(join(dir, "2020-01-01.json")), false);
  const raw = readFileSync(join(dir, "index.json"), "utf8");
  assert.ok(raw.endsWith("}\n"));
  assert.equal(JSON.parse(raw).days[0].date, "2026-11-09");
  writeApi(dir, [day]);
  assert.equal(readFileSync(join(dir, "index.json"), "utf8"), raw);
});

test("buildApi tolerates a day without generatedAt", () => {
  const bare = { date: "2026-11-10", items: day.items.slice(2, 3) };
  const bad = { date: "2026-11-08", generatedAt: "nonsense", items: day.items.slice(2, 3) };
  const { index, files } = buildApi([bare, day, bad]);
  assert.equal(files.get("2026-11-10").generatedAt, null);
  assert.equal(files.get("2026-11-08").generatedAt, null);
  assert.equal(index.generatedAt, "2026-11-09T09:01:52+08:00");
  assert.equal(buildApi([bare]).index.generatedAt, null);
});
