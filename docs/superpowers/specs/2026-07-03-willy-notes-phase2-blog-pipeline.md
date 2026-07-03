# willy-notes 階段二:部落格管線 — 設計文件

- 日期:2026-07-03
- 狀態:設計已與使用者確認,待寫實作計畫
- 前置:階段一(網站骨架)已完成並上線(`willy-notes.pages.dev`)。`/blog/` 目前是佔位頁。

---

## 1. 目標

把 markdown 文章自動轉成靜態部落格頁,並提供「本機預覽草稿 → 一鍵發佈」的流程。內容維持標準 markdown + YAML frontmatter(Obsidian 相容),路徑集中在單一設定以便日後搬進 vault。

本階段產出的發佈能力,是階段三(每日 17:00 自動產草稿)的落地基礎:排程把草稿寫進 `drafts/`,使用者用本階段的 `preview`/`publish` 審閱發佈。

**不做**(YAGNI):標籤篩選 / 分類頁、程式碼語法高亮、本機圖片管線、分頁、封存頁、`draft:` 欄位、publish 自動 commit。

---

## 2. 內容模型與檔案

### 2.1 設定檔(單一來源,Obsidian 可搬移)

repo 根目錄 `content.config.json`:
```json
{ "contentDir": "content" }
```
`build-blog.mjs`(本階段)與未來的排程(階段三)都從這裡讀內容路徑。要搬進 Obsidian vault 時,把 `contentDir` 改成 vault 的絕對路徑即可,其餘不動。支援相對路徑(相對 repo 根)與絕對路徑。

### 2.2 內容資料夾

```
{contentDir}/
  posts/     ← 已發佈文章(.md)
  drafts/    ← 未發佈草稿(.md),不會出現在正式網站
```

**發佈狀態只由資料夾決定**:`posts/` = 上線,`drafts/` = 未上線。不使用 `draft:` frontmatter 欄位(避免資料夾與欄位兩套機制)。

### 2.3 檔名與 slug 慣例

- 檔名:`YYYY-MM-DD.md`(每日草稿)或 `YYYY-MM-DD-短英文.md`(手寫文)。
- **網址 slug**:frontmatter 有 `slug` 就用它;否則用**日期** `YYYY-MM-DD`。文章網址 = `/blog/{slug}`。
- 中文標題不需轉 slug。同一天多篇時,在 frontmatter 各自加 `slug` 區分。

### 2.4 frontmatter 欄位

```yaml
title:    文章標題          # 必填
date:     2026-07-03        # 必填;若省略則由檔名的日期前綴推得
summary:  一句話摘要        # 選填,列表頁顯示
tags:     [swift, wwdc]     # 選填,文章頁純顯示(本階段不做篩選)
slug:     my-post           # 選填,不填則用日期
```

---

## 3. Build(`scripts/build-blog.mjs`)

讀 `{contentDir}/posts/*.md` → 解析 frontmatter + 用 `marked` 轉 HTML → 產出三種輸出。

### 3.1 相依與解析

- markdown → HTML:`marked`(**本階段唯一新增執行相依**)。
- frontmatter:**自寫極簡解析器**(不加套件)。支援 `key: value`、`tags: [a, b]` 行內陣列;內容由使用者或我們自己的排程產生,格式可控。

### 3.2 輸出

1. **文章頁** `public/blog/{slug}.html`
   - 沿用網站樣式(同組 CSS 變數、`--mono`、深色模式)、掛 `/nav.js`、含 theme-restore inline script。
   - 版面:標題 + 日期 + tags(純顯示)+ 內文 + 底部「← 回部落格」連 `/blog/`。
   - 共用樣式 `public/blog/blog.css`(文章頁 + 列表頁),不併入 `detail.css`。
2. **列表頁** `public/blog/index.html`(取代佔位頁)
   - 依日期新→舊:標題(連 `/blog/{slug}`)、日期、摘要。掛 `/nav.js`。
3. **索引** `public/data/posts.json`
   - `[{ slug, title, date, summary, tags }]`,新→舊排序。

### 3.3 程式碼區塊

` ```lang ... ``` ` 由 `marked` 轉為 `<pre><code>`,以 `--mono` + 底色 + 橫向可捲動呈現。**不做語法高亮**。

### 3.4 錯誤處理(不靜默)

- 缺 `title`、或無法取得日期(frontmatter 無 `date` 且檔名無日期前綴)→ build 報錯並指出檔名。
- slug 撞號(兩篇算出同一個 slug)→ build 報錯,提示加 `slug`。
- 內容視為可信(自己寫的),不做額外 HTML 消毒。

---

## 4. 作者流程(npm 指令)

### 4.1 `npm run preview` — 本機預覽(含草稿)

- build **posts + drafts**;草稿輸出到 `public/blog/drafts/{name}.html`(不從列表頁連出)。
- 接著 `wrangler pages dev public`,可在瀏覽器看草稿排版。
- 邊看邊改 `content/drafts/{name}.md`。

### 4.2 `npm run publish <name>` — 一鍵發佈

1. 把 `content/drafts/<name>.md` 搬到 `content/posts/`(先確認該草稿存在,否則報錯)。
2. 跑**正式 build(只讀 `posts/`)**→ 文章頁 + 列表頁 + `posts.json`。
3. `wrangler pages deploy public` 上線。
- 例:`npm run publish 2026-07-03`。

### 4.3 草稿不外流的保護

- 正式 build(publish 用)**只讀 `posts/`**,並清除任何殘留的 `public/blog/drafts/`,確保 deploy 內容不含草稿。
- `public/blog/drafts/` 加入 `.gitignore`。

### 4.4 版控

發佈後 `content/posts/` 會多出新檔;由使用者自行 `git commit`(publish 不自動 commit)。

---

## 5. 邊界與非目標

- 標籤篩選 / 分類頁、語法高亮、本機圖片管線、分頁、封存頁、`draft:` 欄位、publish 自動 commit — 皆不做。
- 偶爾要放圖:用標準 markdown 指向外部圖片網址。
- WWDC 的 `build-details.mjs` 維持獨立、不受影響。

---

## 6. 驗證方式

- **範例文章**:放一兩篇測試 `.md` 到 `posts/`,跑 build,確認 `/blog/{slug}.html`、列表頁、`posts.json` 內容正確。
- **frontmatter 解析**:含 tags 陣列、缺 summary、有/無 slug 各測一篇。
- **錯誤路徑**:故意缺 `title`、造一組 slug 撞號,確認 build 報錯而非靜默。
- **草稿隔離**:`preview` 後跑正式 build,確認 `public/blog/drafts/` 被清除、`posts.json` 不含草稿。
- **contentDir 可搬移**:把 `contentDir` 指到另一絕對路徑,確認 build 跟著走。
- **端到端**:`publish` 一篇測試草稿,確認檔案搬移 + 上線(willy-notes.pages.dev/blog/{slug} 可達)。

---

## 7. 檔案總覽

- 新增:`content.config.json`、`scripts/build-blog.mjs`、`public/blog/blog.css`、`content/posts/`、`content/drafts/`
- 修改:`package.json`(加 `marked` 相依、`preview`/`publish`/blog build 的 npm scripts)、`.gitignore`(加 `public/blog/drafts/`)、`public/blog/index.html`(改為 build 產生)
- 不動:`scripts/build-details.mjs`、`public/wwdc26/**`、`functions/**`、`public/nav.js`
