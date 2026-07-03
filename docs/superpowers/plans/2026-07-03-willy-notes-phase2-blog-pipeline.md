# willy-notes 階段二:部落格管線 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `content/posts/*.md`(markdown + YAML frontmatter)build 成靜態部落格頁 + 列表 + `posts.json`,並提供 `preview`(含草稿)與 `publish`(搬檔→只含 posts 的正式 build→deploy)流程。

**Architecture:** 純函式(讀設定、解析 frontmatter、推導 date/slug、驗證)集中在 `scripts/blog-lib.mjs`,用 Node 內建 `node:test` 做單元測試;`scripts/build-blog.mjs` 是 orchestrator(讀資料夾、渲染、寫檔);`scripts/publish.mjs` 處理發佈。HTML 產出用「跑 build + grep」驗證。

**Tech Stack:** Node(ESM `.mjs`)、`marked`(md→HTML,唯一新增相依)、`node:test`、`wrangler pages`。

## Global Constraints

- 內容一律標準 markdown + YAML frontmatter(Obsidian 相容);不使用 Obsidian 專屬語法。
- frontmatter 欄位:`title`(必填)、`date`、`summary`、`tags`、`slug`(其餘選填)。
- 發佈狀態只由資料夾決定:`posts/` = 上線、`drafts/` = 未上線。不使用 `draft:` 欄位。
- 網址 slug:frontmatter 有 `slug` 用它,否則用日期 `YYYY-MM-DD`;文章網址 `/blog/{slug}`。
- 內容路徑來自單一設定 `content.config.json` 的 `contentDir`(相對 repo 根或絕對路徑)。
- `marked` 是本階段唯一新增執行相依。
- 品牌字樣一律 `willy-notes`。
- build 錯誤不得靜默:缺 title / 無法取得日期 / slug 撞號都要 throw 並指出檔名。
- 正式 build(非 `--drafts`)只讀 `posts/`,且清除 `public/blog/drafts/`。
- 專案無既有測試框架;純邏輯用 `node:test`,產出用跑 build + grep 驗證。
- 每個 task 結束都要 commit。

---

### Task 1: 設定檔 + `readConfig` + `parseFrontmatter`

**Files:**
- Create: `content.config.json`
- Create: `content/posts/.gitkeep`, `content/drafts/.gitkeep`
- Create: `scripts/blog-lib.mjs`
- Create: `scripts/blog-lib.test.mjs`
- Modify: `package.json`(加 `test` script)

**Interfaces:**
- Produces:
  - `readConfig(root = process.cwd())` → `{ contentDir: string }`(絕對路徑;`content.config.json` 的 `contentDir` 相對值以 `root` 解析,`~/` 展開為 `$HOME`)
  - `parseFrontmatter(raw: string)` → `{ data: object, body: string }`(無 frontmatter 時 `data = {}`、`body = raw`;`tags: [a, b]` 解析為字串陣列)

- [ ] **Step 1: 建立設定檔與內容資料夾**

Create `content.config.json`:
```json
{ "contentDir": "content" }
```
Create empty `content/posts/.gitkeep` and `content/drafts/.gitkeep`（讓空資料夾進版控）:
```bash
mkdir -p content/posts content/drafts && touch content/posts/.gitkeep content/drafts/.gitkeep
```

- [ ] **Step 2: 寫失敗測試**

Create `scripts/blog-lib.test.mjs`:
```js
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
```

- [ ] **Step 3: 執行測試,確認失敗**

Run: `node --test scripts/blog-lib.test.mjs`
Expected: FAIL（`blog-lib.mjs` 尚不存在 / 未匯出函式,匯入即錯）。

- [ ] **Step 4: 實作 `blog-lib.mjs`(本 task 範圍)**

Create `scripts/blog-lib.mjs`:
```js
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readConfig(root = process.cwd()) {
  const cfg = JSON.parse(readFileSync(resolve(root, "content.config.json"), "utf8"));
  let dir = cfg.contentDir || "content";
  if (dir.startsWith("~/")) dir = resolve(process.env.HOME || "", dir.slice(2));
  return { contentDir: resolve(root, dir) };
}

export function parseFrontmatter(raw) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split("\n")) {
    const mm = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!mm) continue;
    let val = mm[2].trim();
    if (/^\[.*\]$/.test(val)) {
      val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    data[mm[1]] = val;
  }
  return { data, body: raw.slice(m[0].length) };
}
```

- [ ] **Step 5: 加 `test` npm script**

在 `package.json` 的 `"scripts"` 加入:
```json
"test": "node --test scripts/"
```

- [ ] **Step 6: 執行測試,確認通過**

Run: `node --test scripts/blog-lib.test.mjs`
Expected: PASS（3 個測試全過）。

- [ ] **Step 7: Commit**

```bash
git add content.config.json content/posts/.gitkeep content/drafts/.gitkeep scripts/blog-lib.mjs scripts/blog-lib.test.mjs package.json
git commit -m "Add content config, readConfig and frontmatter parser with tests"
```

---

### Task 2: `deriveDate` / `deriveSlug` / `postFromFile` / `assertUniqueSlugs`

**Files:**
- Modify: `scripts/blog-lib.mjs`
- Modify: `scripts/blog-lib.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter`(Task 1)
- Produces:
  - `deriveDate(data, filename)` → `"YYYY-MM-DD"`（用 `data.date`,否則取檔名開頭的 `YYYY-MM-DD`,兩者皆無則 throw）
  - `deriveSlug(data, filename)` → `string`（`data.slug`,否則等同 `deriveDate`）
  - `postFromFile(filename, data)` → `{ title, date, slug, summary, tags }`（缺 `title` throw;`tags` 正規化為陣列;`summary` 預設 `""`）
  - `assertUniqueSlugs(posts)` → `void`（`posts` 為含 `slug` 的物件陣列,重複 slug throw）

- [ ] **Step 1: 追加失敗測試**

在 `scripts/blog-lib.test.mjs` 末端追加:
```js
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
```

- [ ] **Step 2: 執行測試,確認失敗**

Run: `node --test scripts/blog-lib.test.mjs`
Expected: FAIL（新函式尚未匯出）。

- [ ] **Step 3: 實作四個函式**

在 `scripts/blog-lib.mjs` 追加:
```js
export function deriveDate(data, filename) {
  if (data.date) return String(data.date).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(filename);
  if (m) return m[1];
  throw new Error(`No date: set 'date' in frontmatter or prefix filename with YYYY-MM-DD (${filename})`);
}

export function deriveSlug(data, filename) {
  if (data.slug) return String(data.slug).trim();
  return deriveDate(data, filename);
}

export function postFromFile(filename, data) {
  if (!data.title) throw new Error(`Missing 'title' in ${filename}`);
  const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
  return {
    title: String(data.title),
    date: deriveDate(data, filename),
    slug: deriveSlug(data, filename),
    summary: data.summary || "",
    tags,
  };
}

export function assertUniqueSlugs(posts) {
  const seen = new Set();
  for (const p of posts) {
    if (seen.has(p.slug)) throw new Error(`Duplicate slug "${p.slug}" — add a unique 'slug' in frontmatter`);
    seen.add(p.slug);
  }
}
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `node --test scripts/blog-lib.test.mjs`
Expected: PASS（含 Task 1 共 10 個測試全過）。

- [ ] **Step 5: Commit**

```bash
git add scripts/blog-lib.mjs scripts/blog-lib.test.mjs
git commit -m "Add date/slug derivation, postFromFile, and slug-collision check"
```

---

### Task 3: 渲染 + `blog.css` + `build-blog.mjs`(正式 build) + 範例文章

**Files:**
- Modify: `scripts/blog-lib.mjs`(加 `renderPost` / `renderList`)
- Create: `public/blog/blog.css`
- Create: `scripts/build-blog.mjs`
- Create: `content/posts/2026-07-03-hello.md`
- Modify: `package.json`(加 `marked` 相依 + `build:blog` script)

**Interfaces:**
- Consumes: `readConfig`, `parseFrontmatter`, `postFromFile`, `assertUniqueSlugs`（Task 1–2）
- Produces:
  - `renderPost(post, bodyHtml)` → 完整 HTML 字串（`post` = `postFromFile` 的回傳）
  - `renderList(posts)` → 完整 HTML 字串（`posts` = 已排序的 post 陣列）
  - `scripts/build-blog.mjs` 執行後產出 `public/blog/{slug}.html`、`public/blog/index.html`、`public/data/posts.json`

- [ ] **Step 1: 安裝 `marked`**

```bash
npm install marked
```
Expected: `package.json` 的 `dependencies` 出現 `marked`。

- [ ] **Step 2: 加渲染函式到 `blog-lib.mjs`**

在 `scripts/blog-lib.mjs` 追加:
```js
const esc = (x) => String(x).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/blog/blog.css">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
</head>
<body>
<div id="site-nav"></div>
${bodyHtml}
<script src="/nav.js"></script>
</body>
</html>
`;
}

export function renderPost(post, bodyHtml) {
  const tags = (post.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("");
  const body = `<div class="wrap"><article>
<h1 class="title">${esc(post.title)}</h1>
<div class="meta"><span>${esc(post.date)}</span>${tags}</div>
<div class="body">${bodyHtml}</div>
<a class="back" href="/blog/">← 回部落格</a>
</article></div>`;
  return layout(`${post.title} · willy-notes`, body);
}

export function renderList(posts) {
  const items = posts
    .map((p) => `<li>
<a class="t" href="/blog/${esc(p.slug)}">${esc(p.title)}</a>
<div class="d">${esc(p.date)}</div>
${p.summary ? `<div class="s">${esc(p.summary)}</div>` : ""}
</li>`)
    .join("");
  const body = `<div class="wrap">
<div class="blog-head"><h1>部落格</h1></div>
<ul class="post-list">${items || `<li class="s">尚無文章。</li>`}</ul>
</div>`;
  return layout("部落格 · willy-notes", body);
}
```

- [ ] **Step 3: 建立 `blog.css`**

Create `public/blog/blog.css`:
```css
:root{--bg:#FAFAF7;--surface:#FFFFFF;--ink:#18181B;--muted:#71717A;--faint:#A1A1AA;--line:#E8E8E3;--accent:#3B5BDB;--accent-soft:#EEF1FC;--mono:"SF Mono",ui-monospace,"Menlo",monospace;--ui:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang TC","Noto Sans TC",system-ui,sans-serif}
:root[data-theme="dark"]{--bg:#0E0E10;--surface:#191A1D;--ink:#ECECEE;--muted:#9A9AA2;--faint:#6B6B73;--line:#27272B;--accent:#8AA0F2;--accent-soft:#1C2138}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0E0E10;--surface:#191A1D;--ink:#ECECEE;--muted:#9A9AA2;--faint:#6B6B73;--line:#27272B;--accent:#8AA0F2;--accent-soft:#1C2138}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:var(--ui);line-height:1.7;-webkit-font-smoothing:antialiased;padding:0 20px 96px}
.wrap{max-width:720px;margin:0 auto}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.blog-head{padding:48px 0 8px}
.blog-head h1{font-size:26px;font-weight:680;letter-spacing:-.02em;color:var(--ink)}
.post-list{list-style:none;margin-top:8px}
.post-list li{padding:20px 0;border-top:1px solid var(--line)}
.post-list .t{font-size:18px;font-weight:640;color:var(--ink)}
.post-list .d{font-family:var(--mono);font-size:12px;color:var(--faint);margin-top:4px}
.post-list .s{color:var(--muted);font-size:14px;margin-top:6px}
article{padding:48px 0 0}
article h1.title{font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1.2;color:var(--ink)}
article .meta{font-family:var(--mono);font-size:12px;color:var(--faint);margin-top:10px;display:flex;gap:10px;flex-wrap:wrap}
article .meta .tag{background:var(--accent-soft);color:var(--accent);padding:2px 8px;border-radius:999px}
article .body{margin-top:28px}
article .body h2{font-size:20px;margin:28px 0 10px}
article .body h3{font-size:17px;margin:22px 0 8px}
article .body p{margin:14px 0}
article .body ul,article .body ol{margin:14px 0 14px 22px}
article .body pre{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow-x:auto;margin:16px 0}
article .body code{font-family:var(--mono);font-size:13px}
article .body :not(pre)>code{background:var(--accent-soft);padding:1px 6px;border-radius:6px}
article .body blockquote{border-left:3px solid var(--line);padding-left:14px;color:var(--muted);margin:16px 0}
.back{display:inline-block;margin-top:36px;font-size:13px;color:var(--muted)}
```

- [ ] **Step 4: 建立 `build-blog.mjs`(正式 build,只讀 posts)**

Create `scripts/build-blog.mjs`:
```js
// Build the blog: content/posts/*.md -> public/blog/{slug}.html + list + posts.json.
// Production build (this file, no flags) reads ONLY posts/ and clears public/blog/drafts/.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import { readConfig, parseFrontmatter, postFromFile, assertUniqueSlugs, renderPost, renderList } from "./blog-lib.mjs";

const { contentDir } = readConfig();
const OUT = "public/blog";

function load(sub) {
  const dir = join(contentDir, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, body } = parseFrontmatter(readFileSync(join(dir, f), "utf8"));
      const post = postFromFile(f, data);
      return { ...post, bodyHtml: marked.parse(body) };
    });
}

mkdirSync(OUT, { recursive: true });
const posts = load("posts").sort((a, b) => (a.date < b.date ? 1 : -1));
assertUniqueSlugs(posts);
for (const p of posts) writeFileSync(join(OUT, `${p.slug}.html`), renderPost(p, p.bodyHtml));
writeFileSync(join(OUT, "index.html"), renderList(posts));
mkdirSync("public/data", { recursive: true });
writeFileSync(
  "public/data/posts.json",
  JSON.stringify(posts.map(({ slug, title, date, summary, tags }) => ({ slug, title, date, summary, tags })), null, 2)
);
rmSync(join(OUT, "drafts"), { recursive: true, force: true }); // deploy safety
console.log(`built ${posts.length} posts`);
```

- [ ] **Step 5: 加範例文章**

Create `content/posts/2026-07-03-hello.md`:
```markdown
---
title: willy-notes 上線了
date: 2026-07-03
summary: 這個網站的第一篇筆記。
tags: [meta]
slug: hello
---

歡迎來到 **willy-notes**。這裡會放技術筆記與每日開發日誌。

- 支援標準 markdown
- 程式碼區塊會以等寬字呈現:

```swift
print("hello, willy-notes")
```
```

- [ ] **Step 6: 加 `build:blog` npm script**

在 `package.json` `"scripts"` 加入:
```json
"build:blog": "node scripts/build-blog.mjs"
```

- [ ] **Step 7: 執行 build 並驗證產出**

Run:
```bash
npm run build:blog
ls public/blog/hello.html public/blog/index.html public/data/posts.json
grep -c 'id="site-nav"' public/blog/hello.html
grep -c 'willy-notes 上線了' public/blog/index.html
node -e "const p=require('./public/data/posts.json'); console.log('posts:', p.length, '| slug:', p[0].slug)"
```
Expected: 三個檔存在;`hello.html` 含 nav 掛載(1);列表頁含文章標題(1);`posts.json` 為 1 篇、slug 為 `hello`。

- [ ] **Step 8: 驗證錯誤不靜默(缺 title / slug 撞號)**

Run:
```bash
printf 'no-title body\n' > content/posts/2099-01-01-bad.md
npm run build:blog; echo "exit=$?"
rm content/posts/2099-01-01-bad.md
```
Expected: build 失敗(非 0 exit)並印出提到 `title` 與檔名的錯誤。刪除測試檔後回復正常。

- [ ] **Step 9: Commit**

```bash
git add scripts/blog-lib.mjs scripts/build-blog.mjs public/blog/blog.css content/posts/2026-07-03-hello.md package.json package-lock.json
git commit -m "Add blog rendering, build-blog production build, and a first post"
```

---

### Task 4: 草稿預覽模式 + 隔離保護 + `preview`

**Files:**
- Modify: `scripts/build-blog.mjs`(加 `--drafts` 分支)
- Modify: `.gitignore`(加 `public/blog/drafts/`)
- Modify: `package.json`(加 `preview` script)

**Interfaces:**
- Consumes: Task 3 的 `build-blog.mjs`、`renderPost`
- Produces: `node scripts/build-blog.mjs --drafts` 額外把 `drafts/*.md` 輸出到 `public/blog/drafts/{slug}.html`;正式 build 仍會清除該資料夾

- [ ] **Step 1: 加 `--drafts` 分支**

在 `scripts/build-blog.mjs` 的最後兩行:
```js
rmSync(join(OUT, "drafts"), { recursive: true, force: true }); // deploy safety
console.log(`built ${posts.length} posts`);
```
改為:
```js
if (process.argv.includes("--drafts")) {
  const drafts = load("drafts");
  const draftsOut = join(OUT, "drafts");
  mkdirSync(draftsOut, { recursive: true });
  for (const d of drafts) writeFileSync(join(draftsOut, `${d.slug}.html`), renderPost(d, d.bodyHtml));
  console.log(`built ${posts.length} posts + ${drafts.length} drafts (preview)`);
} else {
  rmSync(join(OUT, "drafts"), { recursive: true, force: true }); // deploy safety
  console.log(`built ${posts.length} posts`);
}
```

- [ ] **Step 2: `.gitignore` 加入草稿產出**

在 `.gitignore` 末端加一行:
```
public/blog/drafts/
```

- [ ] **Step 3: 加 `preview` npm script**

在 `package.json` `"scripts"` 加入:
```json
"preview": "node scripts/build-blog.mjs --drafts && wrangler pages dev public"
```

- [ ] **Step 4: 驗證草稿會被建、且正式 build 會清除**

Run:
```bash
printf -- '---\ntitle: 草稿測試\ndate: 2026-07-04\nslug: draft-test\n---\n內文\n' > content/drafts/2026-07-04-draft-test.md
node scripts/build-blog.mjs --drafts
ls public/blog/drafts/draft-test.html && echo "✓ 草稿有建"
grep -c 'draft-test' public/blog/index.html || echo "✓ 草稿不在列表(0)"
node scripts/build-blog.mjs
[ -d public/blog/drafts ] && echo "✗ 草稿殘留" || echo "✓ 正式 build 已清除草稿"
rm content/drafts/2026-07-04-draft-test.md
```
Expected: 草稿頁有建、不在列表、正式 build 後 `public/blog/drafts/` 被清除。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-blog.mjs .gitignore package.json
git commit -m "Add draft preview mode, draft isolation, and preview script"
```

---

### Task 5: `publish.mjs` + `publish`

**Files:**
- Create: `scripts/publish.mjs`
- Modify: `package.json`(加 `publish` script)

**Interfaces:**
- Consumes: `readConfig`(Task 1)、`build-blog.mjs`(Task 3)
- Produces: `npm run publish <name>` 把 `drafts/<name>.md` 搬到 `posts/`、跑正式 build、`wrangler pages deploy`

- [ ] **Step 1: 建立 `publish.mjs`**

Create `scripts/publish.mjs`:
```js
// Publish a draft: move content/drafts/<name>.md -> content/posts/, rebuild, deploy.
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readConfig } from "./blog-lib.mjs";

const name = process.argv[2];
if (!name) {
  console.error("Usage: npm run publish <draft-name>   (e.g. npm run publish 2026-07-03)");
  process.exit(1);
}
const { contentDir } = readConfig();
const src = join(contentDir, "drafts", `${name}.md`);
const dst = join(contentDir, "posts", `${name}.md`);
if (!existsSync(src)) {
  console.error(`Draft not found: ${src}`);
  process.exit(1);
}
renameSync(src, dst);
console.log(`moved ${name}.md: drafts -> posts`);
execFileSync("node", ["scripts/build-blog.mjs"], { stdio: "inherit" });
execFileSync("npx", ["wrangler", "pages", "deploy", "public", "--project-name", "willy-notes"], { stdio: "inherit" });
```

- [ ] **Step 2: 加 `publish` npm script**

在 `package.json` `"scripts"` 加入:
```json
"publish": "node scripts/publish.mjs"
```

- [ ] **Step 3: 驗證搬檔 + build(不觸發實際 deploy 的乾式檢查)**

以本地方式驗證「搬檔 + build」邏輯(不跑 wrangler):先確認找不到草稿會報錯,再手動走搬檔 + build。
```bash
# a) 找不到草稿要報錯
node scripts/publish.mjs no-such-draft; echo "exit=$?"   # 期望非 0、印 Draft not found

# b) 造一篇草稿,手動搬 + build(驗證 publish 前兩步的效果)
printf -- '---\ntitle: 發佈測試\ndate: 2026-07-05\nslug: pub-test\n---\n內文\n' > content/drafts/2026-07-05-pub-test.md
mv content/drafts/2026-07-05-pub-test.md content/posts/2026-07-05-pub-test.md
npm run build:blog
ls public/blog/pub-test.html && grep -c '發佈測試' public/blog/index.html
# 清理,避免把測試文章留在 posts
rm content/posts/2026-07-05-pub-test.md public/blog/pub-test.html
npm run build:blog
```
Expected: (a) 找不到草稿時非 0 exit + `Draft not found`;(b) 搬到 posts 後 build 產出 `pub-test.html` 且列表含「發佈測試」;清理後重建正常。

> 註:實際 `wrangler pages deploy`(publish 第三步)為線上動作,留待收尾時由控制者用一篇真的草稿做一次端到端驗證(見計畫末)。

- [ ] **Step 4: Commit**

```bash
git add scripts/publish.mjs package.json
git commit -m "Add publish script: move draft to posts, build, and deploy"
```

---

## 收尾(全部 task 完成後)

- **端到端**:造一篇草稿 → `npm run preview`(瀏覽 `localhost:8788/blog/drafts/<slug>` 看排版)→ `npm run publish <name>` → 確認 `https://willy-notes.pages.dev/blog/<slug>` 上線、列表頁有它。
- **contentDir 可搬移**(spec §6 要求):把 `content.config.json` 的 `contentDir` 暫時改成一個絕對路徑並放幾篇 md,跑 `npm run build:blog`,確認產出跟著走;驗證後改回 `content`。
- 發佈後的 `content/posts/*.md` 記得 `git commit`(publish 不自動 commit)。

## 後續(不在本計畫)

- **階段三:每日自動化** — `automation/config.json`(沿用同一個 `contentDir` 概念)+ 平日 17:00 Cowork 排程,讀當天 commits + session,產草稿到 `content/drafts/`。另立計畫。
