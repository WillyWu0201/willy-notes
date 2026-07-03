# willy-notes 個人網站 — 設計文件

- 日期:2026-07-03
- 狀態:設計已與使用者確認,待寫實作計畫
- 現有專案:WWDC26 開發者筆記(Cloudflare Pages 靜態站 + Functions)

---

## 1. 目標

把現有的 WWDC26 筆記站,升級成一個**以 markdown + git 為核心的個人網站** `willy-notes`,WWDC 筆記成為其中一個分頁。網站承載三件事:

- **A. 首頁 / 關於我** — 介紹 Willy 是誰。
- **B. 部落格** — 持續發佈的技術文章 / 筆記。
- **D. 知識庫 / 收藏** — 「自動整理」型內容,WWDC26 是第一個、也是目前唯一的收藏。

搭配一條**本機每日自動化**:平日 17:00 自動把當天的工作內容整理成一篇部落格**草稿**,經人工審閱後發佈。

**不做**(YAGNI):線上編輯後台、資料庫、登入保護(部落格寫作端)、通用「收藏」框架。

---

## 2. 網站結構(路由)

沿用 Cloudflare Pages 靜態站,子網域改為 `willy-notes.pages.dev`(未來可掛自訂網域)。

```
public/
  index.html          ← 新:首頁 / 關於我(A)
  blog/
    index.html        ← 新:部落格列表(B)
    {slug}.html       ← 新:每篇文章(由 markdown build)
  wwdc26/
    index.html        ← 搬移自現在的 public/index.html
    s/{id}.html       ← 搬移自現在的 public/s/{id}.html
  data/
    sessions.json     ← 不動
    posts.json        ← 新:文章索引(build 產生)
  favicon.svg         ← 不動
  404.html            ← 不動
```

- **共用導覽列**:`首頁 · 部落格 · WWDC26 · 關於`,由 build 腳本注入每頁,單一來源避免各頁不一致。
- **WWDC 從 `/` 搬到 `/wwdc26/`**,詳解頁一併搬到 `/wwdc26/s/`;需更新彼此的內部連結與 `build-details.mjs` 的輸出路徑。
- 「知識庫/收藏(D)」現階段只是首頁上一張 WWDC26 卡片,不建通用框架。

---

## 3. 內容管線(markdown → 靜態頁)

### 3.1 內容資料夾(Obsidian 友善、可搬移)

```
content/                ← 由 config 指定路徑,可整包搬走
  posts/                ← 已發佈文章(.md)
  drafts/               ← 每日自動產的草稿,未發佈
```

**設計約束(為了日後接 Obsidian):**

- 內容一律**標準 markdown + YAML frontmatter**(Obsidian 原生格式),不使用會讓 Obsidian 無法解析的自訂語法。
- frontmatter 欄位:`title` / `date` / `tags` / `summary` / `draft`(布林,可選)。
- **內容路徑集中在單一 config**(見 §4.2 的 `contentDir`),所有腳本都從那裡讀。日後要把 `content/` 搬進 Obsidian vault,只需把 `contentDir` 改成該 vault 的絕對路徑,其餘不動。
- `contentDir` 可以在 repo 內(預設 `content`)或 repo 外(絕對路徑);因為 build 與排程都在本機執行,內容不需存在於部署的 repo 裡。

### 3.2 Build

新增 `scripts/build-blog.mjs`:

- 讀 `{contentDir}/posts/*.md` → 用模板(沿用現有詳解頁樣式)產出 `public/blog/{slug}.html`。
- 產出列表頁 `public/blog/index.html` 與索引 `public/data/posts.json`。
- markdown → HTML 使用輕量套件 `marked`(唯一新增執行相依)。
- `slug` 規則:取自檔名(`YYYY-MM-DD-標題`)去掉日期前綴,或由 frontmatter 指定。

### 3.3 審稿 → 發佈流程

1. `npm run preview` — build(含 drafts)並本機預覽,看得到排版後的樣子。
2. 直接編輯 `{contentDir}/drafts/YYYY-MM-DD.md` 到滿意。
3. `npm run publish YYYY-MM-DD` — 把該檔從 `drafts/` 移到 `posts/`、重 build、`wrangler pages deploy`。

draft 只在本機預覽,不會出現在已發佈的列表 / `posts.json` 中。

---

## 4. 每日自動草稿(本機排程)

### 4.1 機制

使用 Claude Code 內建的 scheduled task(`create_scheduled_task`),**跑在本機 app 內**:

- cron:`0 17 * * 1-5`(平日 17:00,本機時區)。
- 任務存於 `~/.claude/scheduled-tasks/{taskId}/SKILL.md`,prompt 需**完全自包含**(每次全新 agent、無先前對話記憶)。
- 完成時通知(`notifyOnCompletion`)。

**Caveat(已與使用者確認接受):** 此類排程「app 開著時才會跑」;若 17:00 時 app 未開,會在**下次開啟 app 時補跑**——草稿不會遺失,只會延後。因此**不需要** launchd / shell script / headless `claude -p`。

### 4.2 設定檔

`automation/config.json`(使用者可隨時調整,不動程式):

```json
{
  "contentDir": "content",
  "repos": [
    "/Users/willy/Developer/repo-a",
    "/Users/willy/Developer/repo-b"
  ],
  "sessionsDir": "~/.claude/projects",
  "authorEmail": "test001@tpisoftware.com"
}
```

- `contentDir` — §3.1 的單一來源;build 腳本與排程任務都讀它。支援 `~` 展開與相對/絕對路徑。
- `repos` — 要掃描 commit 的 repo 清單。
- `sessionsDir` — Claude session 逐字稿根目錄。

### 4.3 任務每次執行的步驟

1. 讀 `automation/config.json`。
2. 對每個 `repos[i]` 跑 `git log --since=今天0點 --author=<authorEmail>`,取當天 commit 訊息與 diff 摘要。
3. 掃 `sessionsDir` 底下**今天修改過(mtime 為今日)**的 `*.jsonl`,萃取當天處理的主題(避免讀全部 762 個檔造成 token 爆量)。
4. 綜合成一篇 markdown 草稿(標題、當天重點、做了什麼、學到什麼),含 §3.1 frontmatter。
5. 寫入 `{contentDir}/drafts/YYYY-MM-DD.md`。
6. 完成通知使用者。

---

## 5. 邊界、隱私與錯誤處理

- **隱私**:session 逐字稿可能含公司/敏感內容。整條產草稿流程都在**本機**、草稿**留在本機**,使用者**審閱並 `publish` 後才會上線**——在此之前無任何外流。
- **沒內容的日子**:當天無 commit 且無 session → **不產空草稿、不發通知**。
- **Mac / app 未開**:當日跳過(依 §4.1 於下次開 app 補跑),不做補跑以外的處理。
- **repo 路徑無效**:略過該 repo 並在草稿中註記,不中斷整體。
- **可手動測**:排程任務可手動觸發,不必等到 17:00。

---

## 6. 分階段實作(各自可獨立上線)

1. **階段一:網站骨架** — 首頁/關於 + 共用導覽列 + WWDC 搬到 `/wwdc26/`(含內部連結與 `build-details.mjs` 調整)+ 空的 blog 區。
2. **階段二:部落格管線** — `build-blog.mjs`、列表頁、`posts.json`、`preview` 與 `publish` 指令(此時已能手寫文章發佈)。
3. **階段三:每日自動化** — `automation/config.json` + 產草稿排程任務。

每個階段完成即為一個可驗證里程碑。

---

## 7. 驗證方式

- **Build 腳本**:對範例 markdown 跑 `build-blog.mjs`,確認 HTML 輸出與 `posts.json` 正確。
- **導覽列**:巡所有頁面,確認連結正確、`/wwdc26/` 與 `/wwdc26/s/` 可達。
- **publish 流程**:對一篇測試草稿跑 `npm run publish`,確認檔案搬移 + 上線。
- **排程任務**:手動觸發一次,確認能讀 config、掃 commit/session、產出草稿於 `drafts/`。
- **contentDir 可搬移性**:把 `contentDir` 改成另一個絕對路徑,確認 build 與排程都跟著走。

---

## 8. 非目標 / 待議

- 線上編輯後台、資料庫、部落格寫作端登入保護 — 不做。
- 通用「收藏」框架 — 不做,之後有第二個收藏再議。
- 自訂網域 — 之後可加,現階段用 `willy-notes.pages.dev`。
- Obsidian 的 wikilink `[[...]]` / 附件資料夾整合 — 本次僅確保格式相容與路徑可搬,不做深度整合。
