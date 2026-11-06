import { test } from "node:test";
import assert from "node:assert/strict";
import { groupItems, renderDay, renderIndex } from "./build-digest.mjs";

const order = ["AI", "iOS / Apple", "金融"];
const day = {
  date: "2026-11-06",
  items: [
    { source: "iThome", title: "金融 <新聞>", url: "https://x.test/a?b=1&c=2", date: "2026-11-06", groups: ["金融"] },
    { source: "Claude Blog", title: "Agents", url: "https://x.test/b", date: null, groups: ["AI", "金融"] },
  ],
};

test("groupItems puts each item under its first group, in config order, dropping empty groups", () => {
  const out = groupItems(day.items, order);
  assert.deepEqual(out.map(([g, list]) => [g, list.map((i) => i.title)]), [["AI", ["Agents"]], ["金融", ["金融 <新聞>"]]]);
});

test("renderDay renders escaped links with source and date, grouped by topic", () => {
  const html = renderDay(day, order);
  assert.match(html, /<h1 class="title">資訊摘要 · 2026-11-06<\/h1>/);
  assert.match(html, /<h2>AI<\/h2>[\s\S]*<h2>金融<\/h2>/);
  assert.match(html, /<a href="https:\/\/x\.test\/a\?b=1&amp;c=2">金融 &lt;新聞&gt;<\/a><span class="src">iThome · 2026-11-06<\/span>/);
  assert.match(html, /<span class="src">Claude Blog<\/span>/);
  assert.doesNotMatch(html, /iOS \/ Apple/);
});

test("renderIndex lists days with total and per-topic counts", () => {
  const html = renderIndex([day], order);
  assert.match(html, /<a class="t" href="\/digest\/2026-11-06">資訊摘要 · 2026-11-06<\/a>/);
  assert.match(html, /<div class="d">2 篇<\/div>/);
  assert.match(html, /<div class="s">AI 1、金融 1<\/div>/);
});
test("non-http(s) URLs are never published and are not counted", () => {
  const bad = { ...day, items: [...day.items, { source: "X", title: "Evil", url: "javascript:alert(1)", date: null, groups: ["AI"] }] };
  const html = renderDay(bad, order);
  assert.doesNotMatch(html, /javascript:|Evil/);
  assert.match(html, /<span>2 篇<\/span>/);
  assert.match(renderIndex([bad], order), /<div class="d">2 篇<\/div>/);
});
test("renderIndex shows a placeholder when there are no days", () => {
  assert.match(renderIndex([], order), /尚無摘要/);
});
