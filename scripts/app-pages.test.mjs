import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderPrivacy, renderSupport, buildAppPages } from "./app-pages.mjs";

test("privacy page states no data collection, the only server, local reminders and YouTube", () => {
  const html = renderPrivacy();
  for (const s of ["不收集任何個人資料", "沒有帳號", "不追蹤", "willy-notes.pages.dev", "本機", "YouTube"]) {
    assert.ok(html.includes(s), s);
  }
  assert.ok(html.includes('href="https://policies.google.com/privacy"'));
  assert.ok(html.includes('href="mailto:willy.xcoder@gmail.com"'));
});

test("support page has the contact email and the three FAQs", () => {
  const html = renderSupport();
  assert.ok(html.includes('href="mailto:willy.xcoder@gmail.com"'));
  assert.ok(html.includes("登入"));
  assert.ok(html.includes("開啟影片頁面"));
  assert.ok(html.includes("09:00"));
  assert.ok(html.includes("台北時間"));
  assert.ok(html.includes("偶爾"));
  assert.ok(html.includes("今天的摘要還沒出來"));
});

test("pages use the site layout", () => {
  const p = renderPrivacy();
  const s = renderSupport();
  for (const h of [p, s]) {
    assert.ok(h.includes('<html lang="zh-Hant">'));
    assert.ok(h.includes("/blog/blog.css"));
  }
  assert.ok(p.includes("<title>日知 隱私權政策 · willy-notes</title>"));
  assert.ok(s.includes("<title>日知 支援 · willy-notes</title>"));
});

test("buildAppPages writes both files", () => {
  const dir = mkdtempSync(join(tmpdir(), "app-pages-"));
  buildAppPages(dir);
  assert.equal(readFileSync(join(dir, "privacy.html"), "utf8"), renderPrivacy());
  assert.equal(readFileSync(join(dir, "support.html"), "utf8"), renderSupport());
});
