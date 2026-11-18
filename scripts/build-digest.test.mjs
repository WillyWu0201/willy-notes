import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { groupByCategory, defaultTab, renderDay, renderIndex, buildAll } from "./build-digest.mjs";

const day = { date: "2026-11-09", items: [
  { source: "Addy", title: "Agentic <Verification>", url: "https://a.test/v", date: "2026-10-14", curated: true, groups: ["AI"],
    category: "dev", deep: true, summary: "瓶頸是驗證", points: ["p1", "p2", "p3"], questions: ["q1", "q2"],
    further: [{ title: "Cited", url: "https://x.test/c", note: "n" }, { title: "Lean", note: "m" }] },
  { source: "AI Engineer", title: "Talk", url: "https://www.youtube.com/watch?v=1", curated: true, groups: ["AI"], category: "dev", deep: false, summary: "影片摘要" },
  { source: "iThome", title: "GPT-6", url: "https://i.test/1", groups: ["AI"], category: "industry", summary: "新模型" },
  { source: "iThome", title: "資安日報", url: "https://i.test/2", groups: ["iOS / Apple"], category: "apple", drop: true, dropReason: "無關" },
  { source: "FSC", title: "穩定幣", url: "https://f.test/1", groups: ["虛擬資產"] },
  { source: "X", title: "Evil", url: "javascript:alert(1)", groups: ["AI"], category: "industry", summary: "x" },
] };

test("groupByCategory uses analysed categories, falls back for old items, and skips dropped and non-http items", () => {
  const g = Object.fromEntries(groupByCategory(day.items));
  assert.deepEqual(Object.keys(g), ["dev", "industry", "apple", "finance"]);
  assert.deepEqual(g.dev.deep.map((i) => i.title), ["Agentic <Verification>"]);
  assert.deepEqual(g.dev.rows.map((i) => i.title), ["Talk"]);
  assert.deepEqual(g.industry.rows.map((i) => i.title), ["GPT-6"]);
  assert.equal(g.apple.rows.length, 0);
  assert.deepEqual(g.finance.rows.map((i) => i.title), ["穩定幣"]);
});
test("defaultTab is dev when it has items, else the first non-empty tab", () => {
  assert.equal(defaultTab(groupByCategory(day.items)), "dev");
  assert.equal(defaultTab(groupByCategory(day.items.slice(2))), "industry");
});
test("renderDay renders tabs with counts, a disabled empty tab and the deep card sections", () => {
  const html = renderDay(day);
  assert.match(html, /data-default="dev"/);
  assert.match(html, /<a class="tab" href="#dev">AI 開發方式 <b>2<\/b><\/a>/);
  assert.match(html, /<span class="tab off">iOS \/ Apple <b>0<\/b><\/span>/);
  assert.match(html, /<div class="deep-card">[\s\S]*Agentic &lt;Verification&gt;[\s\S]*<p class="one">瓶頸是驗證<\/p>[\s\S]*<h4>重點<\/h4>[\s\S]*<h4>反思問題<\/h4>[\s\S]*<h4>延伸閱讀<\/h4>/);
  assert.match(html, /<a href="https:\/\/x\.test\/c">Cited<\/a>/);
  assert.match(html, /Lean[^<]*（文中提到，未附連結）/);
  assert.match(html, /<h3>其他（影片、只有摘要）<\/h3>[\s\S]*Talk[\s\S]*影片摘要/);
  assert.match(html, /<p class="empty">今天沒有<\/p>/);
  assert.match(html, /<span>4 篇<\/span>/);
});
test("renderDay never publishes non-http links or dropped items", () => {
  const html = renderDay(day);
  assert.doesNotMatch(html, /javascript:|Evil|資安日報/);
});
test("renderDay never publishes a non-http further link", () => {
  const bad = { ...day, items: [{ ...day.items[0], further: [{ title: "Bad", url: "javascript:alert(2)", note: "n" }] }] };
  assert.doesNotMatch(renderDay(bad), /javascript:/);
});
test("renderIndex lists days with per-tab counts", () => {
  const html = renderIndex([day]);
  assert.match(html, /<a class="t" href="\/digest\/2026-11-09">資訊摘要 · 2026-11-09<\/a>/);
  assert.match(html, /<div class="d">4 篇<\/div>/);
  assert.match(html, /<div class="s">AI 開發方式 2、AI 產業動態 1、金融與虛擬資產 1<\/div>/);
  assert.match(renderIndex([]), /尚無摘要/);
});
test("buildAll writes the app JSON next to the pages", () => {
  const dir = mkdtempSync(join(tmpdir(), "digest-"));
  mkdirSync(join(dir, "content/digests"), { recursive: true });
  writeFileSync(join(dir, "content/digests/2026-11-09.json"), JSON.stringify({ ...day, generatedAt: "2026-11-09T01:00:00.000Z" }));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    assert.equal(buildAll(), 1);
  } finally {
    process.chdir(cwd);
  }
  for (const f of ["index.json", "2026-11-09.json"]) assert.ok(existsSync(join(dir, "public/digest/api/v1", f)), f);
});
