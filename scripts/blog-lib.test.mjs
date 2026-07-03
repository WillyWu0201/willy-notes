import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfig, parseFrontmatter } from "./blog-lib.mjs";

test("readConfig returns an absolute contentDir ending in /content", () => {
  const { contentDir } = readConfig();
  assert.ok(contentDir.startsWith("/"), "should be absolute");
  assert.ok(contentDir.endsWith("/content"), "should resolve default 'content'");
});

test("parseFrontmatter extracts fields, tags array, and body", () => {
  const raw = "---\ntitle: Hi\ndate: 2026-07-03\ntags: [swift, wwdc]\n---\nHello **world**\n";
  const { data, body } = parseFrontmatter(raw);
  assert.equal(data.title, "Hi");
  assert.equal(data.date, "2026-07-03");
  assert.deepEqual(data.tags, ["swift", "wwdc"]);
  assert.equal(body, "Hello **world**\n");
});

test("parseFrontmatter with no frontmatter returns empty data and raw body", () => {
  const { data, body } = parseFrontmatter("no front matter here");
  assert.deepEqual(data, {});
  assert.equal(body, "no front matter here");
});
