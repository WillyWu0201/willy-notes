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

import { deriveDate, deriveSlug, postFromFile, assertUniqueSlugs } from "./blog-lib.mjs";

test("deriveDate prefers frontmatter date", () => {
  assert.equal(deriveDate({ date: "2026-01-02" }, "whatever.md"), "2026-01-02");
});
test("deriveDate falls back to filename prefix", () => {
  assert.equal(deriveDate({}, "2026-07-03-hello.md"), "2026-07-03");
});
test("deriveDate throws when neither present", () => {
  assert.throws(() => deriveDate({}, "hello.md"), /date/i);
});
test("deriveSlug prefers frontmatter slug, else date", () => {
  assert.equal(deriveSlug({ slug: "my-post" }, "2026-07-03.md"), "my-post");
  assert.equal(deriveSlug({}, "2026-07-03.md"), "2026-07-03");
});
test("postFromFile builds a post and normalizes tags", () => {
  const p = postFromFile("2026-07-03.md", { title: "Hi", tags: "solo" });
  assert.equal(p.title, "Hi");
  assert.equal(p.date, "2026-07-03");
  assert.equal(p.slug, "2026-07-03");
  assert.equal(p.summary, "");
  assert.deepEqual(p.tags, ["solo"]);
});
test("postFromFile throws when title missing", () => {
  assert.throws(() => postFromFile("2026-07-03.md", {}), /title/i);
});
test("assertUniqueSlugs throws on duplicate", () => {
  assert.throws(() => assertUniqueSlugs([{ slug: "a" }, { slug: "a" }]), /slug/i);
  assert.doesNotThrow(() => assertUniqueSlugs([{ slug: "a" }, { slug: "b" }]));
});
