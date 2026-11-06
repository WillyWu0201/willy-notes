import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMatcher, parseFeed, extractLinks, parseSitemap, extractYouTube,
  parseAppleSecurity, parseLooseDate, selectNew, renderDigest,
} from "./feed-digest.mjs";

const match = buildMatcher({
  AI: ["AI", "LLM", "agent", "生成式"],
  "虛擬資產": ["stablecoin", "digital asset", "穩定幣"],
});

test("buildMatcher matches short English words only as whole words", () => {
  assert.deepEqual(match("The main point").keywords, []);
  assert.deepEqual(match("Said the agency").keywords, []);
  assert.deepEqual(match("New AI model").keywords, ["AI"]);
  assert.deepEqual(match("Two LLMs and three agents").keywords, ["LLM", "agent"]);
});
test("buildMatcher matches next to CJK text and is case-insensitive", () => {
  assert.deepEqual(match("導入生成式AI技術").keywords, ["AI", "生成式"]);
  assert.deepEqual(match("STABLECOINS and Digital Assets").groups, ["虛擬資產"]);
  assert.deepEqual(match("推動穩定幣監理").groups, ["虛擬資產"]);
});

test("parseFeed reads RSS items with CDATA and entities", () => {
  const xml = `<rss><channel><title>Feed</title>
    <item><title><![CDATA[A &amp; B]]></title><link><![CDATA[https://x.test/1]]></link>
      <pubDate>Thu, 05 Nov 2026 08:20:00 GMT</pubDate><description>&lt;p&gt;Hello&lt;/p&gt;</description></item>
  </channel></rss>`;
  assert.deepEqual(parseFeed(xml), [
    { title: "A & B", url: "https://x.test/1", date: "2026-11-05", text: "A & B Hello" },
  ]);
});
test("parseFeed reads Atom entries with link href", () => {
  const xml = `<feed><entry><title>Post</title><link rel="alternate" href="https://x.test/p"/>
    <updated>2026-11-03T10:00:00Z</updated><summary>Sum</summary></entry></feed>`;
  assert.deepEqual(parseFeed(xml), [{ title: "Post", url: "https://x.test/p", date: "2026-11-03", text: "Post Sum" }]);
});

test("parseLooseDate understands the date styles used by listing pages", () => {
  assert.equal(parseLooseDate("Article Nov 5, 2026 Title"), "2026-11-05");
  assert.equal(parseLooseDate("01 October 2026 REPORT"), "2026-10-01");
  assert.equal(parseLooseDate("no date here"), null);
});

test("extractLinks keeps matching links, prefers the heading as title, dedupes and drops nav links", () => {
  const html = `
    <a href="/news/announcements">Announcements</a>
    <a href="/news/big-launch"><span>Article Nov 5, 2026</span><h3>Big launch of a thing</h3><p>Desc</p></a>
    <a href="/news/big-launch">Big launch of a thing</a>
    <a href="/about">About us page link</a>`;
  const out = extractLinks(html, "https://x.test/news", "^https://x\\.test/news/[a-z-]+$");
  assert.equal(out.length, 1);
  assert.equal(out[0].url, "https://x.test/news/big-launch");
  assert.equal(out[0].title, "Big launch of a thing");
  assert.equal(out[0].date, "2026-11-05");
  assert.match(out[0].text, /Desc/);
});

test("parseSitemap filters locs and turns the slug into a title", () => {
  const xml = `<urlset><url><loc>https://x.test/p/will-ai-kill-fintech</loc><lastmod>2026-11-01</lastmod></url>
    <url><loc>https://x.test/about</loc></url></urlset>`;
  assert.deepEqual(parseSitemap(xml, "/p/[a-z-]+$"), [
    { title: "will ai kill fintech", url: "https://x.test/p/will-ai-kill-fintech", date: "2026-11-01", text: "will ai kill fintech" },
  ]);
});

test("extractYouTube reads lockupViewModel videos from ytInitialData", () => {
  const data = { a: [{ lockupViewModel: { contentId: "abc123DEF45", metadata: { lockupMetadataViewModel: { title: { content: "Agents in prod" } } } } }] };
  const html = `<script>var ytInitialData = ${JSON.stringify(data)};</script>`;
  assert.deepEqual(extractYouTube(html), [
    { title: "Agents in prod", url: "https://www.youtube.com/watch?v=abc123DEF45", date: null, text: "Agents in prod" },
  ]);
});

test("parseAppleSecurity reads linked rows and skips rows without a link", () => {
  const html = `<table><tr><th>Name</th></tr>
    <tr><td><a href="https://support.apple.com/en-us/149230">iOS 27.2 and iPadOS 27.2</a></td><td>iPhone 11 and later</td><td>26 Oct 2026</td></tr>
    <tr><td>Safari 27</td><td>macOS</td><td>20 Oct 2026</td></tr></table>`;
  assert.deepEqual(parseAppleSecurity(html), [
    { title: "iOS 27.2 and iPadOS 27.2", url: "https://support.apple.com/en-us/149230", date: "2026-10-26", text: "iOS 27.2 and iPadOS 27.2 iPhone 11 and later" },
  ]);
});

test("selectNew on first run seeds everything and keeps only recent dated items", () => {
  const items = [
    { url: "u1", date: "2026-11-05" }, { url: "u2", date: "2026-09-01" }, { url: "u3", date: null },
  ];
  const { fresh, seen } = selectNew(items, undefined, "2026-11-06");
  assert.deepEqual(fresh.map((i) => i.url), ["u1"]);
  assert.deepEqual(seen.sort(), ["u1", "u2", "u3"]);
});
test("selectNew on later runs returns only unseen items", () => {
  const { fresh, seen } = selectNew([{ url: "u1" }, { url: "u4", date: null }], ["u1", "u2"], "2026-11-06");
  assert.deepEqual(fresh.map((i) => i.url), ["u4"]);
  assert.deepEqual(seen.sort(), ["u1", "u2", "u4"]);
});

test("renderDigest groups items by source and lists source status", () => {
  const md = renderDigest("2026-11-06", [
    { source: "Anthropic News", title: "Big [launch]", url: "https://x.test/a", date: "2026-11-05", groups: ["AI"] },
  ], [
    { name: "Anthropic News", parsed: 20, fresh: 1, matched: 1, firstRun: false },
    { name: "MAS 新聞稿", parsed: 0, fresh: 0, matched: 0, error: "HTTP 500" },
  ]);
  assert.match(md, /^# 資訊摘要 · 2026-11-06/);
  assert.match(md, /## Anthropic News/);
  assert.match(md, /- \[Big \\\[launch\\\]\]\(https:\/\/x\.test\/a\) · 2026-11-05 · AI/);
  assert.match(md, /\| MAS 新聞稿 \| 0 \| 0 \| 0 \| 失敗：HTTP 500 \|/);
});
test("renderDigest says so when nothing matched", () => {
  const md = renderDigest("2026-11-06", [], [{ name: "A", parsed: 3, fresh: 0, matched: 0, firstRun: true }]);
  assert.match(md, /今天沒有命中關鍵字的新文章/);
  assert.match(md, /首次執行，已建立基準/);
});
