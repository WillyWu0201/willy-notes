# willy-notes 階段三:每日自動草稿排程 — 設計文件

- 日期:2026-07-04
- 狀態:設計已與使用者確認,待寫實作計畫
- 前置:階段一(骨架)、階段二(部落格管線)已完成並上線。`content/drafts/` + `preview`/`publish` 已可用。

---

## 1. 目標

平日 17:00 在本機自動把「當天的 git commits + 當天的 Claude session」整理成一篇**繁體中文開發日誌草稿**,寫進 `content/drafts/`,等使用者用階段二的 `preview` / `publish` 審閱發佈。

**架構(兩部分)**:
1. **`scripts/daily-gather.mjs`(決定性、可測)** — 蒐集當天素材成一份 bundle 檔,或回報 `NO_CONTENT`。
2. **排程 Claude agent(`create_scheduled_task`)** — 跑 gather,把 bundle 寫成有 frontmatter 的日誌草稿。蒐集是決定性的、好測;寫作交給 LLM。

**不做**(YAGNI):自動 publish(一律人工審)、跨機同步、圖片、完整 diff 分析。

---

## 2. 機制與設定

### 2.1 排程機制

用 Claude Code 內建 `create_scheduled_task`,**跑在本機 app 內**:
- `cronExpression`: `0 17 * * 1-5`(平日 17:00 本機時區)。
- `notifyOnCompletion`: `true`。
- 任務存於 `~/.claude/scheduled-tasks/{taskId}/SKILL.md`,prompt 完全自包含(每次全新 agent)。
- **Caveat(已確認接受)**:app 開著才會跑;17:00 未開則**下次開 app 補跑**,草稿不遺失只延後。補跑用「實際執行當天」的日期。

### 2.2 設定檔

沿用階段二的 `content.config.json`(`contentDir` 單一來源),另加**自動化專用**設定:

`automation/config.json`:
```json
{
  "repos": ["/Users/willy/Developer/wwdc26-notes"],
  "sessionsDir": "~/.claude/projects",
  "authorEmail": "test001@tpisoftware.com",
  "maxChars": 40000
}
```
- `contentDir` **不放這裡**,由 `content.config.json` 提供(`daily-gather.mjs` 透過階段二的 `readConfig()` 取得,維持單一來源、Obsidian 可搬)。
- `repos` — 要掃 commit 的 repo 清單(使用者自填實際路徑)。
- `sessionsDir` — Claude session 逐字稿根目錄。
- `authorEmail` — `git log --author` 過濾用。
- `maxChars` — 素材包字元上限(裁切門檻)。

---

## 3. `scripts/daily-gather.mjs`

### 3.1 輸入與日期

- 讀 `content.config.json`(`contentDir`)+ `automation/config.json`。
- 日期預設「今天(本機)」;`--date YYYY-MM-DD` 可覆寫(測試用)。

### 3.2 git 蒐集(每個 repo)

```
git -C <repo> log --since="<date> 00:00" --until="<date> 23:59" --author=<authorEmail> --no-merges --stat
```
- 取當天、該作者、非 merge 的 commit:**訊息 + 變更檔清單(--stat)**;**不取完整 diff**。
- repo 無效 / 非 git / 當天無 commit → 當作空,bundle 註記,不中斷。

### 3.3 session 蒐集

- repo 路徑 → 專案 key:`/Users/willy/Developer/foo` → `-Users-willy-Developer-foo`;在 `sessionsDir/` 找**以該 key 為前綴**的專案目錄(涵蓋 worktree 目錄如 `-...-foo--claude-worktrees-xxx`)。
- 取這些目錄中**今天 mtime** 的 `*.jsonl`,逐行解析,**只留使用者訊息 + 助手回覆的文字**;跳過 tool_use / tool_result / 大型輸出 / `mode`、`last-prompt` 等 meta 與無法解析的行。

### 3.4 裁切(不靜默)

- 素材包總字元超過 `maxChars` → **平均裁切**各來源,並在被裁處明確標註「(已裁切 N 字)」。

### 3.5 產出

- 有內容:寫 bundle 到 `automation/.cache/daily-<date>.md`(gitignore),結構為「每個 repo:commits → session 重點」;stdout **印出 bundle 路徑與目標草稿路徑**(`<contentDir>/drafts/<date>.md`,支援 contentDir 被搬移)。
- 無內容(所有 repo 皆無 commit 且無 session 文字)→ 不寫 bundle,stdout 印 `NO_CONTENT`。

---

## 4. 排程任務(agent prompt)

`create_scheduled_task` 註冊,`prompt` 自包含,大意:

> 在 `<willy-notes repo 絕對路徑>` 執行 `node scripts/daily-gather.mjs`。
> 若 stdout 含 `NO_CONTENT` → 不產草稿,回報「今天沒有可整理的內容」。
> 否則:讀它印出的 bundle 檔;若**目標草稿檔已存在** → 不覆蓋,回報「今天的草稿已存在,略過」;否則把 bundle 整理成一篇**繁體中文開發日誌**,寫到印出的目標草稿路徑,回報完成。

### 4.1 草稿格式(符合階段二 frontmatter)

```markdown
---
title: 開發日誌 · <date>
date: <date>
summary: (一句話摘要)
tags: [當天有動到的專案名]
---

## 今天做了什麼
(依專案 / 主題整理)

## 解決的問題
...

## 學到 / 值得記的
...
```
- 不設 `slug` → 依階段二預設用日期,網址 `/blog/<date>`。

### 4.2 ops 依賴(重要)

排程 prompt **寫死 repo 絕對路徑**。若日後把資料夾 `wwdc26-notes` 改名為 `willy-notes`,此任務路徑會失效。**建議:資料夾改名後再註冊排程**;若已註冊,改名後手動更新任務 prompt 的路徑。

---

## 5. 邊界與隱私

- **隱私**:蒐集、產草稿全在本機,草稿留在本機,`publish` 前不外流。
- **已存在的草稿不覆蓋**:避免補跑/重跑蓋掉已編輯內容。
- **沒內容不產空草稿**、不發吵人通知。
- session 逐字稿只在本機、只讀今天 mtime 的檔,避免掃全部(目前 700+ 檔)造成 token 爆量。

---

## 6. 測試

- `daily-gather.mjs` 拆出純函式,用 `node:test`:
  - `repoToProjectKey(path)` — 路徑轉專案 key(含 worktree 前綴比對)。
  - `parseGitLog(text)` — 解析 `git log --stat` 輸出成結構。
  - `extractSession(jsonlText)` — 樣本行萃取對話文字、跳過 tool/meta/壞行。
  - `trim(text, cap)` — 超過上限有裁切且加註記。
  - 空輸入 → `NO_CONTENT` sentinel。
- 整合:對真實 config 跑 `node scripts/daily-gather.mjs --date <今天>`,目視 bundle。
- 端到端:**手動觸發排程任務一次**,確認產出草稿於 `content/drafts/`、格式正確、`preview` 看得到。

---

## 7. 檔案總覽

- 新增:`scripts/daily-gather.mjs`、`scripts/daily-gather.test.mjs`、`automation/config.json`、`automation/.cache/`(gitignore)
- 修改:`.gitignore`(加 `automation/.cache/`)、`package.json`(加 `gather` 便捷 script,選用)
- 一次性動作:用 `create_scheduled_task` 註冊 `daily-blog-draft` 任務(見 §4)
- 不動:`build-blog.mjs`、`blog-lib.mjs`(僅 import `readConfig`)、`publish.mjs`、`content.config.json`
