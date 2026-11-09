import { test } from "node:test";
import assert from "node:assert/strict";
import { extractArticle, extractVideoDescription, isVideo, prepEntry, prepTargets, DEEP_MIN_CHARS, TEXT_MAX_CHARS } from "./digest-prep.mjs";

const html = `<html><body><nav><a href="/home">Home</a></nav><article><h1>T</h1><script>x()</script>
<p>Body text <a href="https://x.test/cited">cited</a> and <a href="/rel">rel</a> <a href="#top">top</a>
<a href="https://x.test/cited">again</a></p></article><footer><a href="https://x.test/foot">f</a></footer></body></html>`;

test("extractArticle prefers <article> and drops scripts, nav and footer", () => {
  const { text } = extractArticle(html, "https://site.test/post");
  assert.match(text, /Body text cited and rel/);
  assert.doesNotMatch(text, /x\(\)|Home|f$/);
});
test("extractArticle returns unique absolute http(s) links inside the article only", () => {
  assert.deepEqual(extractArticle(html, "https://site.test/post").links, ["https://x.test/cited", "https://site.test/rel"]);
});
test("extractArticle falls back to <main>, then <body>", () => {
  assert.match(extractArticle("<body><main><p>Main part</p></main><p>outside</p></body>", "https://s.test/").text, /^Main part$/);
  assert.match(extractArticle("<body><p>Only body &amp; more</p></body>", "https://s.test/").text, /^Only body & more$/);
});
test("isVideo recognises YouTube links", () => {
  assert.equal(isVideo("https://www.youtube.com/watch?v=abc"), true);
  assert.equal(isVideo("https://youtu.be/abc"), true);
  assert.equal(isVideo("https://a.test/watch"), false);
});
test("prepEntry marks videos, short texts and failed fetches as not deep", () => {
  assert.equal(DEEP_MIN_CHARS, 1500);
  const long = { text: "字".repeat(1500), links: [] };
  const e = prepEntry({ url: "https://a.test/p", title: "t", source: "s", date: null }, 0, long);
  assert.deepEqual([e.index, e.url, e.title, e.source, e.deep, e.curated], [0, "https://a.test/p", "t", "s", true, false]);
  assert.equal(prepEntry({ url: "https://www.youtube.com/watch?v=x" }, 1, long).deep, false);
  assert.equal(prepEntry({ url: "https://a.test/p" }, 2, { text: "short", links: [] }).deep, false);
  assert.equal(prepEntry({ url: "https://a.test/p" }, 3, null).deep, false);
});
test("prepEntry caps text at TEXT_MAX_CHARS", () => {
  assert.equal(TEXT_MAX_CHARS, 30000);
  assert.equal(prepEntry({ url: "https://a.test/p" }, 0, { text: "a".repeat(40000), links: [] }).text.length, 30000);
});
test("prepTargets skips analysed and dropped items so a second run does not redo them", () => {
  const items = [{ url: "a" }, { url: "b", summary: "done" }, { url: "c", drop: true }, { url: "d" }];
  assert.deepEqual(prepTargets(items), [0, 3]);
  assert.deepEqual(prepTargets([]), []);
});
test("extractVideoDescription reads the YouTube shortDescription", () => {
  const page = `<script>var ytInitialPlayerResponse = {"videoDetails":{"shortDescription":"Line one\\nLine \\"two\\""}};</script>`;
  assert.equal(extractVideoDescription(page), 'Line one\nLine "two"');
  assert.equal(extractVideoDescription("<html></html>"), "");
});
