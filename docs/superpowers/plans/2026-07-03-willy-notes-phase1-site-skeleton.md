# willy-notes 階段一:網站骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把現有 WWDC 站改成個人網站 `willy-notes` 的骨架:新增首頁/關於、共用導覽列、把 WWDC 內容搬到 `/wwdc26/`、並放一個空的部落格分頁。

**Architecture:** 純靜態站(Cloudflare Pages)。WWDC 瀏覽器與詳解頁從站根搬到 `/wwdc26/`;新增站根首頁與 `/blog/` 佔位頁;導覽列以一支自包含的 `/nav.js`(注入 markup + 樣式,使用既有 CSS 變數)掛在每頁,不需 build step。

**Tech Stack:** 靜態 HTML/CSS/JS、Node 腳本(`scripts/build-details.mjs`)、`wrangler pages dev` 本機預覽。專案目前無測試框架,故每個 task 的驗證以「執行 build/dev + grep 產出 + 目視」取代單元測試。

## Global Constraints

- 內容維持標準 markdown + YAML frontmatter(本階段尚未產內容,但約束先立)。
- 不新增登入、資料庫、線上編輯後台(YAGNI)。
- 只動與搬移/導覽相關的程式;不順手重構既有樣式或無關程式(surgical)。
- 導覽列使用既有 CSS 自訂屬性:`--bg` `--ink` `--muted` `--line` `--accent-soft` `--mono`。
- 站名/品牌字樣一律用 `willy-notes`。
- 每個 task 結束都要 commit。

---

### Task 1: 把 WWDC 瀏覽器搬到 `/wwdc26/`

**Files:**
- Move: `public/index.html` → `public/wwdc26/index.html`
- Modify: `public/wwdc26/index.html`(搬移後修兩處連結)

**Interfaces:**
- Consumes: 既有 `public/data/sessions.json`(留在原地不動)、`/api/*`(絕對路徑,不受影響)。
- Produces: 可用的 WWDC 瀏覽頁於 `/wwdc26/`,詳解連結指向 `/wwdc26/s/{id}`(詳解頁在 Task 2 產生)。

- [ ] **Step 1: 搬移檔案**

```bash
mkdir -p public/wwdc26
git mv public/index.html public/wwdc26/index.html
```

- [ ] **Step 2: 修資料 fetch 為絕對路徑**

`sessions.json` 仍在 `public/data/`,但頁面已移到 `/wwdc26/`,原本的相對路徑 `data/sessions.json` 會失效。改成絕對路徑。

在 `public/wwdc26/index.html`(約第 343 行)：
```
    fetch("data/sessions.json").then((r) => r.json()).catch(() => []),
```
改為：
```
    fetch("/data/sessions.json").then((r) => r.json()).catch(() => []),
```

- [ ] **Step 3: 修詳解頁連結指向 `/wwdc26/s/`**

在 `public/wwdc26/index.html`(約第 459 行)：
```
        <a class="src" href="/s/${esc(s.id)}${state.lang === "en" ? "?lang=en" : ""}">${t.detail}</a>
```
改為：
```
        <a class="src" href="/wwdc26/s/${esc(s.id)}${state.lang === "en" ? "?lang=en" : ""}">${t.detail}</a>
```

- [ ] **Step 4: 驗證兩處已改、且沒有殘留的相對 data 路徑**

Run:
```bash
grep -n 'fetch("/data/sessions.json")' public/wwdc26/index.html
grep -n 'href="/wwdc26/s/' public/wwdc26/index.html
grep -n 'fetch("data/sessions.json")' public/wwdc26/index.html || echo "OK: no relative data fetch left"
```
Expected: 前兩行各有 1 筆命中;第三行印出 `OK: no relative data fetch left`。

- [ ] **Step 5: 本機起站目視**

Run: `npm run dev`(啟動 `wrangler pages dev public`),瀏覽 `http://localhost:8788/wwdc26/`。
Expected: session 列表正常載入(資料來自 `/data/sessions.json`);根路徑 `/` 此時仍是舊行為或 404(Task 4 才補首頁),可忽略。停掉 dev server。

- [ ] **Step 6: Commit**

```bash
git add public/wwdc26/index.html
git commit -m "Move WWDC browser to /wwdc26/ and fix data/detail links"
```

---

### Task 2: 把 WWDC 詳解頁搬到 `/wwdc26/s/`

**Files:**
- Modify: `scripts/build-details.mjs`(輸出目錄與資產連結)
- Move: `public/s/detail.css` → `public/wwdc26/s/detail.css`
- Move: `public/s/detail.js` → `public/wwdc26/s/detail.js`
- Modify: `public/wwdc26/s/detail.js`(related 連結與 back 連結)
- Delete: 舊 `public/s/`(重建後移除)

**Interfaces:**
- Consumes: `public/data/sessions.json`、選用的 `.cache/raw/{id}.json`(無則略過,腳本已 try/catch)。
- Produces: `public/wwdc26/s/{id}.html` 每場詳解頁,資產指向 `/wwdc26/s/detail.{css,js}`,back 連回 `/wwdc26/`。

- [ ] **Step 1: 移動共用資產**

```bash
mkdir -p public/wwdc26/s
git mv public/s/detail.css public/wwdc26/s/detail.css
git mv public/s/detail.js public/wwdc26/s/detail.js
```

- [ ] **Step 2: 改 build-details.mjs 的輸出目錄**

`scripts/build-details.mjs` 第 11 行：
```
mkdirSync("public/s", { recursive: true });
```
改為：
```
mkdirSync("public/wwdc26/s", { recursive: true });
```

- [ ] **Step 3: 改 build-details.mjs 的資產連結**

同檔第 45、51 行的 `/s/detail.css`、`/s/detail.js`：
```
<link rel="stylesheet" href="/s/detail.css">
```
改為：
```
<link rel="stylesheet" href="/wwdc26/s/detail.css">
```
以及：
```
<script src="/s/detail.js"></script>
```
改為：
```
<script src="/wwdc26/s/detail.js"></script>
```

- [ ] **Step 4: 改 build-details.mjs 的輸出路徑**

同檔第 55 行：
```
  writeFileSync(`public/s/${s.id}.html`, html);
```
改為：
```
  writeFileSync(`public/wwdc26/s/${s.id}.html`, html);
```

- [ ] **Step 5: 改 detail.js 的 related 連結**

`public/wwdc26/s/detail.js`(約第 53 行)：
```
    `<a href="/s/${esc(r.id)}${langParam()}">
```
改為：
```
    `<a href="/wwdc26/s/${esc(r.id)}${langParam()}">
```

- [ ] **Step 6: 改 detail.js 的 back 連結**

同檔(約第 57 行),back 應回到 WWDC 首頁而非站根:
```
      <a class="back" href="/${lang === "en" ? "#lang=en" : ""}">${t.back}</a>
```
改為：
```
      <a class="back" href="/wwdc26/${lang === "en" ? "#lang=en" : ""}">${t.back}</a>
```

- [ ] **Step 7: 重建詳解頁並移除舊目錄**

```bash
node scripts/build-details.mjs
git rm -r --quiet public/s
```
Expected: 腳本印出 `wrote N detail pages ...`;`public/s` 被移除。

- [ ] **Step 8: 驗證產出正確**

Run:
```bash
ls public/wwdc26/s/detail.js public/wwdc26/s/detail.css
grep -l '/wwdc26/s/detail.js' public/wwdc26/s/101.html
grep -c '/s/detail.js' public/wwdc26/s/101.html || echo "OK: no old asset path"
```
Expected: 兩個資產檔存在;`101.html` 命中新資產路徑;舊路徑 grep 計數為 0(印出 `OK` 或 `0`)。

- [ ] **Step 9: 本機目視**

Run: `npm run dev`,瀏覽 `http://localhost:8788/wwdc26/`,點任一場詳解 → 應到 `/wwdc26/s/{id}`,樣式正常、相關連結與「返回」都指向 `/wwdc26/...`。停掉 dev server。

- [ ] **Step 10: Commit**

```bash
git add scripts/build-details.mjs public/wwdc26/s
git commit -m "Move WWDC detail pages under /wwdc26/s/ and fix links"
```

---

### Task 3: 共用導覽列 `/nav.js`

**Files:**
- Create: `public/nav.js`
- Modify: `public/wwdc26/index.html`(掛載點 + 載入 nav.js)

**Interfaces:**
- Consumes: 頁面需提供 `<div id="site-nav"></div>` 掛載點,並以 `<script src="/nav.js"></script>` 載入。使用既有 CSS 變數。
- Produces: 全站導覽列;`/nav.js` 對外約定:任何含 `#site-nav` 的頁面載入後會被注入導覽列,並依 `location.pathname` 標記當前分頁(`aria-current="page"`)。

- [ ] **Step 1: 建立 nav.js**

Create `public/nav.js`:
```js
// Shared top navigation. Any page with <div id="site-nav"></div> that loads
// this script gets the nav injected, styled via the site's CSS custom properties.
(function () {
  var items = [
    { href: "/", label: "首頁" },
    { href: "/blog/", label: "部落格" },
    { href: "/wwdc26/", label: "WWDC26" },
  ];
  var path = location.pathname;
  function active(href) {
    if (href === "/") return path === "/" || path === "/index.html";
    return path.indexOf(href) === 0;
  }
  var css =
    '#site-nav{position:sticky;top:0;z-index:40;backdrop-filter:saturate(180%) blur(12px);' +
    '-webkit-backdrop-filter:saturate(180%) blur(12px);' +
    'background:color-mix(in srgb,var(--bg) 86%,transparent);border-bottom:1px solid var(--line)}' +
    '#site-nav .snav{max-width:880px;margin:0 auto;display:flex;gap:6px;align-items:center;padding:10px 20px}' +
    '#site-nav .brand{font-family:var(--mono,ui-monospace,monospace);font-size:13px;font-weight:700;' +
    'letter-spacing:-.01em;color:var(--ink);text-decoration:none;margin-right:auto}' +
    '#site-nav a.tab{font-size:13.5px;color:var(--muted);text-decoration:none;padding:6px 12px;border-radius:999px}' +
    '#site-nav a.tab:hover{color:var(--ink)}' +
    '#site-nav a.tab[aria-current="page"]{color:var(--ink);background:var(--accent-soft,rgba(127,127,127,.14))}';
  var tabs = items
    .map(function (it) {
      return '<a class="tab" href="' + it.href + '"' +
        (active(it.href) ? ' aria-current="page"' : "") + ">" + it.label + "</a>";
    })
    .join("");
  var mount = document.getElementById("site-nav");
  if (!mount) return;
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  mount.innerHTML = '<div class="snav"><a class="brand" href="/">willy-notes</a>' + tabs + "</div>";
})();
```

- [ ] **Step 2: 在 WWDC 頁掛載導覽列**

在 `public/wwdc26/index.html` 的 `<body>` 起始標籤後,插入掛載點(作為 body 第一個子元素):
```html
<body>
<div id="site-nav"></div>
```
並在 `</body>` 之前加入載入腳本:
```html
<script src="/nav.js"></script>
</body>
```

- [ ] **Step 3: 驗證掛載點與腳本都在**

Run:
```bash
grep -n 'id="site-nav"' public/wwdc26/index.html
grep -n '/nav.js' public/wwdc26/index.html
```
Expected: 兩者各 1 筆命中。

- [ ] **Step 4: 本機目視導覽列**

Run: `npm run dev`,瀏覽 `http://localhost:8788/wwdc26/`。
Expected: 頂端出現 `willy-notes` 品牌字 + 三個分頁(首頁 / 部落格 / WWDC26),其中「WWDC26」為當前分頁(有底色)。停掉 dev server。

- [ ] **Step 5: Commit**

```bash
git add public/nav.js public/wwdc26/index.html
git commit -m "Add shared site nav and mount it on the WWDC page"
```

---

### Task 4: 首頁 / 關於我(站根 `/`)

**Files:**
- Create: `public/index.html`(全新的個人首頁;與 Task 1 搬走的 WWDC 頁無關)

**Interfaces:**
- Consumes: `/nav.js`(Task 3)。
- Produces: 站根首頁,含導覽列、個人簡介、以及通往 `/blog/` 與 `/wwdc26/` 的卡片。

- [ ] **Step 1: 建立首頁**

Create `public/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>willy-notes</title>
<link rel="icon" href="/favicon.svg">
<link rel="apple-touch-icon" href="/favicon.svg">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>
  :root{
    --bg:#FAFAF7; --surface:#FFFFFF; --ink:#18181B; --muted:#71717A; --faint:#A1A1AA;
    --line:#E8E8E3; --accent:#3B5BDB; --accent-soft:#EEF1FC;
    --mono:"SF Mono",ui-monospace,"JetBrains Mono","Menlo",monospace;
    --ui:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang TC","Noto Sans TC",system-ui,sans-serif;
  }
  :root[data-theme="dark"]{
    --bg:#0E0E10; --surface:#191A1D; --ink:#ECECEE; --muted:#9A9AA2; --faint:#6B6B73;
    --line:#27272B; --accent:#8AA0F2; --accent-soft:#1C2138;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#0E0E10; --surface:#191A1D; --ink:#ECECEE; --muted:#9A9AA2; --faint:#6B6B73;
      --line:#27272B; --accent:#8AA0F2; --accent-soft:#1C2138;
    }
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font-family:var(--ui);line-height:1.55;-webkit-font-smoothing:antialiased;padding:0 20px 96px}
  .wrap{max-width:880px;margin:0 auto}
  a{color:inherit}
  .hero{padding:56px 0 32px}
  .eyebrow{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
  h1{font-size:32px;font-weight:680;letter-spacing:-.02em;line-height:1.12}
  .lede{color:var(--muted);font-size:16px;margin-top:12px;max-width:60ch}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
  @media (max-width:640px){.cards{grid-template-columns:1fr}}
  .card{display:block;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px;text-decoration:none;transition:border-color .15s ease}
  .card:hover{border-color:var(--faint)}
  .card h2{font-size:17px;font-weight:640;margin-bottom:6px}
  .card p{color:var(--muted);font-size:14px}
</style>
</head>
<body>
<div id="site-nav"></div>
<div class="wrap">
  <section class="hero">
    <div class="eyebrow">willy-notes</div>
    <h1>Willy 的筆記與作品</h1>
    <p class="lede">技術筆記、每日開發日誌,以及把資料自動整理成可瀏覽知識庫的實驗場。</p>
  </section>
  <div class="cards">
    <a class="card" href="/blog/">
      <h2>部落格 →</h2>
      <p>技術文章與每日開發日誌。</p>
    </a>
    <a class="card" href="/wwdc26/">
      <h2>WWDC26 →</h2>
      <p>WWDC26 session 自動整理的可瀏覽筆記。</p>
    </a>
  </div>
</div>
<script src="/nav.js"></script>
</body>
</html>
```

- [ ] **Step 2: 驗證首頁存在且掛了 nav**

Run:
```bash
grep -n 'id="site-nav"' public/index.html
grep -n '/nav.js' public/index.html
grep -n 'href="/wwdc26/"' public/index.html
```
Expected: 三行各 1 筆命中。

- [ ] **Step 3: 本機目視**

Run: `npm run dev`,瀏覽 `http://localhost:8788/`。
Expected: 顯示個人首頁 + 導覽列(此時「首頁」為當前分頁);兩張卡片分別連到 `/blog/`(Task 5 前會 404,正常)與 `/wwdc26/`(正常)。停掉 dev server。

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "Add personal home/about page at site root"
```

---

### Task 5: 部落格佔位頁(`/blog/`）

**Files:**
- Create: `public/blog/index.html`

**Interfaces:**
- Consumes: `/nav.js`(Task 3)。
- Produces: `/blog/` 可達的空狀態頁,讓導覽列的「部落格」不再是死連結;階段二會用 build 產生真正的列表。

- [ ] **Step 1: 建立 blog 佔位頁**

Create `public/blog/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>部落格 · willy-notes</title>
<link rel="icon" href="/favicon.svg">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>
  :root{
    --bg:#FAFAF7; --surface:#FFFFFF; --ink:#18181B; --muted:#71717A;
    --line:#E8E8E3; --accent:#3B5BDB; --accent-soft:#EEF1FC;
    --mono:"SF Mono",ui-monospace,"Menlo",monospace;
    --ui:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang TC","Noto Sans TC",system-ui,sans-serif;
  }
  :root[data-theme="dark"]{--bg:#0E0E10;--surface:#191A1D;--ink:#ECECEE;--muted:#9A9AA2;--line:#27272B;--accent:#8AA0F2;--accent-soft:#1C2138}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0E0E10;--surface:#191A1D;--ink:#ECECEE;--muted:#9A9AA2;--line:#27272B;--accent:#8AA0F2;--accent-soft:#1C2138}}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font-family:var(--ui);line-height:1.55;padding:0 20px 96px}
  .wrap{max-width:880px;margin:0 auto}
  a{color:inherit}
  .head{padding:48px 0 24px}
  h1{font-size:26px;font-weight:680;letter-spacing:-.02em}
  .empty{margin-top:24px;border:1px dashed var(--line);border-radius:14px;padding:40px 24px;text-align:center;color:var(--muted);font-size:15px}
</style>
</head>
<body>
<div id="site-nav"></div>
<div class="wrap">
  <section class="head"><h1>部落格</h1></section>
  <div class="empty">尚無文章。之後會由每日自動整理的草稿審閱後發佈於此。</div>
</div>
<script src="/nav.js"></script>
</body>
</html>
```

- [ ] **Step 2: 驗證**

Run:
```bash
grep -n 'id="site-nav"' public/blog/index.html
grep -n '/nav.js' public/blog/index.html
```
Expected: 兩行各 1 筆命中。

- [ ] **Step 3: 本機目視**

Run: `npm run dev`,瀏覽 `http://localhost:8788/blog/`。
Expected: 顯示「部落格」空狀態頁 + 導覽列(「部落格」為當前分頁)。停掉 dev server。

- [ ] **Step 4: Commit**

```bash
git add public/blog/index.html
git commit -m "Add blog placeholder page with empty state"
```

---

### Task 6: 詳解頁與 404 掛導覽列 + 全站連結巡檢

**Files:**
- Modify: `scripts/build-details.mjs`(詳解頁模板加掛載點 + nav.js),並重建
- Modify: `public/404.html`(加導覽列,若其樣式已定義 CSS 變數則直接掛)

**Interfaces:**
- Consumes: `/nav.js`。
- Produces: 詳解頁與 404 也有一致導覽列;完成全站導覽 smoke test。

- [ ] **Step 1: 詳解頁模板加導覽列**

`scripts/build-details.mjs` 的 HTML 模板中,把 `<body>` 起始改為含掛載點,並在 `</body>` 前載入 nav.js。

將模板裡的：
```
<body>
<div id="app"></div>
```
改為：
```
<body>
<div id="site-nav"></div>
<div id="app"></div>
```
並將：
```
<script src="/wwdc26/s/detail.js"></script>
</body>
```
改為：
```
<script src="/wwdc26/s/detail.js"></script>
<script src="/nav.js"></script>
</body>
```

- [ ] **Step 2: 重建詳解頁**

```bash
node scripts/build-details.mjs
grep -c 'id="site-nav"' public/wwdc26/s/101.html
grep -c '/nav.js' public/wwdc26/s/101.html
```
Expected: 兩個 grep 各印出 `1`。

- [ ] **Step 3: 檢視 404 是否有 CSS 變數可用**

Run: `grep -n -- '--bg\|--ink\|--line' public/404.html || echo "no vars"`
- 若有命中(404 已定義同名變數）：在 `public/404.html` 的 `<body>` 後加 `<div id="site-nav"></div>`,並在 `</body>` 前加 `<script src="/nav.js"></script>`。
- 若印出 `no vars`:在 `public/404.html` 的 `<head>` 內先加入最小變數區塊,再掛導覽列:
```html
<style>:root{--bg:#FAFAF7;--ink:#18181B;--muted:#71717A;--line:#E8E8E3;--accent-soft:#EEF1FC;--mono:ui-monospace,monospace}
:root[data-theme="dark"]{--bg:#0E0E10;--ink:#ECECEE;--muted:#9A9AA2;--line:#27272B;--accent-soft:#1C2138}</style>
```
再加 `<div id="site-nav"></div>`(body 起始後)與 `<script src="/nav.js"></script>`(`</body>` 前)。

- [ ] **Step 4: 驗證 404 掛好**

Run:
```bash
grep -c 'id="site-nav"' public/404.html
grep -c '/nav.js' public/404.html
```
Expected: 兩者各印出 `1`。

- [ ] **Step 5: 全站導覽 smoke test**

Run: `npm run dev`,依序走訪並確認導覽列在每頁都在、當前分頁高亮正確、連結不 404:
- `http://localhost:8788/` → 首頁(首頁高亮),卡片連到 `/blog/`、`/wwdc26/`
- `http://localhost:8788/blog/` → 部落格空狀態(部落格高亮)
- `http://localhost:8788/wwdc26/` → session 列表(WWDC26 高亮),點入任一詳解
- `http://localhost:8788/wwdc26/s/101`(或列表中任一 id）→ 詳解頁有導覽列,「返回」回到 `/wwdc26/`
- 亂打一個網址如 `http://localhost:8788/nope` → 404 有導覽列

Expected: 全部符合。停掉 dev server。

- [ ] **Step 6: Commit**

```bash
git add scripts/build-details.mjs public/wwdc26/s public/404.html
git commit -m "Add nav to detail pages and 404; finish site skeleton"
```

---

## 後續(不在本計畫)

- **階段二:部落格管線** — `scripts/build-blog.mjs`、`content/{posts,drafts}`、`posts.json`、`marked`、`preview`/`publish` 指令。另立計畫。
- **階段三:每日自動化** — `automation/config.json` + 每日 17:00 排程任務。另立計畫。
- **部署名稱** — 之後用 `wrangler` 把 Pages 專案名設為 `willy-notes`(→ `willy-notes.pages.dev`)。屬部署設定,不在本骨架計畫。
