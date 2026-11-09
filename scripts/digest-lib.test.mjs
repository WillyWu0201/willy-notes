import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, fallbackCategory, categoryOf, isWebUrl } from "./digest-lib.mjs";

test("CATEGORIES are the four tabs in display order", () => {
  assert.deepEqual(CATEGORIES.map((c) => [c.id, c.label]), [
    ["dev", "AI 開發方式"], ["industry", "AI 產業動態"], ["apple", "iOS / Apple"], ["finance", "金融與虛擬資產"],
  ]);
});
test("fallbackCategory maps curated items to dev and keyword groups to tabs", () => {
  assert.equal(fallbackCategory({ curated: true, groups: ["AI"] }), "dev");
  assert.equal(fallbackCategory({ groups: ["AI"] }), "industry");
  assert.equal(fallbackCategory({ groups: ["iOS / Apple", "AI"] }), "apple");
  assert.equal(fallbackCategory({ groups: ["金融"] }), "finance");
  assert.equal(fallbackCategory({ groups: ["虛擬資產"] }), "finance");
});
test("categoryOf prefers the analysed category", () => {
  assert.equal(categoryOf({ category: "dev", groups: ["金融"] }), "dev");
  assert.equal(categoryOf({ groups: ["金融"] }), "finance");
});
test("isWebUrl only accepts http and https", () => {
  assert.equal(isWebUrl("https://a.test/x"), true);
  assert.equal(isWebUrl("javascript:alert(1)"), false);
  assert.equal(isWebUrl("not a url"), false);
});
