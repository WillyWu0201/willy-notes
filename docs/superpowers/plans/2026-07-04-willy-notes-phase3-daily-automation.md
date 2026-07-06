# willy-notes 階段三:每日自動草稿排程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 平日 17:00 本機自動把當天 git commits + Claude session 整理成繁中開發日誌草稿寫進 `content/drafts/`,交由階段二的 `preview`/`publish` 審閱發佈。

**Architecture:** 決定性的 `scripts/daily-gather.mjs`(純函式 + orchestrator）把當天素材蒐集成 bundle 檔或印 `NO_CONTENT`;純函式用 `node:test` 測。排程 Claude agent(`create_scheduled_task`)跑 gather 後把 bundle 寫成日誌草稿。

**Tech Stack:** Node ESM `.mjs`、`node:test`、`node:child_process`(git)、階段二的 `scripts/blog-lib.mjs`(`readConfig`)、`create_scheduled_task`(Cowork 排程)。

## Global Constraints

- ESM(`.mjs`);純邏輯用 Node 內建 `node:test`;`npm test` = `node --test scripts/*.test.mjs`(glob 自動涵蓋新測試檔)。
- `contentDir` 一律由 `content.config.json` 經階段二 `readConfig()` 取得(單一來源,Obsidian 可搬);**不**在 `automation/config.json` 重複。
- `automation/config.json` 欄位:`repos`(陣列)、`sessionsDir`、`authorEmail`、`maxChars`。
- git 只取「commit 訊息(subject)+ 變更檔清單」,**不取完整 diff**。
- session 只留 user/assistant 的文字內容,跳過 tool_use/thinking/tool_result 與其他 meta 記錄。
- 素材包超過 `maxChars` 要裁切且**明確標註**,不靜默截斷。
- 完全沒內容 → 印 `NO_CONTENT`,不產空草稿。
- 排程:`cronExpression` `0 17 * * 1-5`、`notifyOnCompletion: true`、prompt 自包含。
- 草稿 frontmatter 對齊階段二(`title`/`date`/`summary`/`tags`);不設 `slug`(用日期)。
- 語言:繁體中文。
- 排程 prompt 寫死 repo 絕對路徑(見 §ops 依賴)。
- 每個 task 結束都要 commit(Task 5 除外,見該任務)。

---

### Task 1: 設定檔 + gitignore + `repoToProjectKey` / `matchesRepo`

**Files:**
- Create: `automation/config.json`
- Create: `scripts/daily-gather.mjs`
- Create: `scripts/daily-gather.test.mjs`
- Modify: `.gitignore`(加 `automation/.cache/`)

**Interfaces:**
- Produces:
  - `repoToProjectKey(repoPath: string)` → 專案 key(去尾斜線,`/`→`-`)。例:`/Users/willy/Developer/foo` → `-Users-willy-Developer-foo`
  - `matchesRepo(dirName: string, key: string)` → boolean(`dirName === key` 或 `dirName` 以 `key + "--"` 開頭,涵蓋 worktree 目錄)

- [ ] **Step 1: 建立自動化設定檔**

Create `automation/config.json`（`repos` 先放 willy-notes repo 當起點,使用者之後自填實際清單）:
```json
{
  "repos": ["/Users/willy/Developer/wwdc26-notes"],
  "sessionsDir": "~/.claude/projects",
  "authorEmail": "test001@tpisoftware.com",
  "maxChars": 40000
}
```

- [ ] **Step 2: `.gitignore` 加入素材包快取目錄**

在 `.gitignore` 末端加一行:
```
automation/.cache/
```

- [ ] **Step 3: 寫失敗測試**

Create `scripts/daily-gather.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { repoToProjectKey, matchesRepo } from "./daily-gather.mjs";

test("repoToProjectKey converts an absolute path to a project key", () => {
  assert.equal(repoToProjectKey("/Users/willy/Developer/foo"), "-Users-willy-Developer-foo");
});
test("repoToProjectKey strips a trailing slash", () => {
  assert.equal(repoToProjectKey("/Users/willy/Developer/foo/"), "-Users-willy-Developer-foo");
});
test("matchesRepo matches the exact key and worktree-prefixed dirs", () => {
  const key = "-Users-willy-Developer-foo";
  assert.equal(matchesRepo(key, key), true);
  assert.equal(matchesRepo(key + "--claude-worktrees-abc", key), true);
  assert.equal(matchesRepo("-Users-willy-Developer-foobar", key), false);
});
```

- [ ] **Step 4: 執行測試,確認失敗**

Run: `node --test scripts/daily-gather.test.mjs`
Expected: FAIL(`daily-gather.mjs` 尚無這些匯出,匯入即錯)。

- [ ] **Step 5: 建立 `daily-gather.mjs`(本 task 範圍的兩個函式)**

Create `scripts/daily-gather.mjs`:
```js
// Gather today's git commits + Claude session text into a bundle for the daily
// blog-draft scheduled task. Pure functions are exported for tests; the
// orchestrator (added in a later task) runs only when invoked as the entry point.

export function repoToProjectKey(repoPath) {
  return repoPath.replace(/\/+$/, "").replace(/\//g, "-");
}

export function matchesRepo(dirName, key) {
  return dirName === key || dirName.startsWith(key + "--");
}
```

- [ ] **Step 6: 執行測試,確認通過**

Run: `node --test scripts/daily-gather.test.mjs`
Expected: PASS(3 個測試全過)。

- [ ] **Step 7: Commit**

```bash
git add automation/config.json scripts/daily-gather.mjs scripts/daily-gather.test.mjs .gitignore
git commit -m "Add automation config and repo-to-project-key helpers with tests"
```

---

### Task 2: `parseGitLog` + `extractSession`

**Files:**
- Modify: `scripts/daily-gather.mjs`
- Modify: `scripts/daily-gather.test.mjs`

**Interfaces:**
- Produces:
  - `parseGitLog(text: string)` → `[{ hash, subject, files: string[] }]`。輸入格式:每筆 commit 以 `\x1e` 分隔;首行為 `hash\x1fsubject`,之後每行一個變更檔名。
  - `extractSession(jsonlText: string)` → `string`。逐行解析 JSON,只留 `type` 為 `user`/`assistant` 的文字內容(user 的 `message.content` 為字串或含 text block 的陣列;assistant 為含 text block 的陣列),跳過 thinking/tool_use/tool_result 與解析失敗的行;各段以角色前綴 `使用者: ` / `助手: `。

- [ ] **Step 1: 追加失敗測試**

在 `scripts/daily-gather.test.mjs` 末端追加:
```js
import { parseGitLog, extractSession } from "./daily-gather.mjs";

test("parseGitLog parses hash, subject and changed files", () => {
  const text = "\x1eabc123\x1fFix the thing\nsrc/a.js\nsrc/b.js\n\x1edef456\x1fAdd feature";
  const out = parseGitLog(text);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { hash: "abc123", subject: "Fix the thing", files: ["src/a.js", "src/b.js"] });
  assert.deepEqual(out[1], { hash: "def456", subject: "Add feature", files: [] });
});
test("parseGitLog returns [] for empty input", () => {
  assert.deepEqual(parseGitLog(""), []);
});
test("extractSession keeps user/assistant text and skips noise", () => {
  const lines = [
    JSON.stringify({ type: "user", message: { content: "幫我修這個 bug" } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "thinking", thinking: "hmm" }, { type: "text", text: "好的,我來修" }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: {} }] } }),
    JSON.stringify({ type: "mode", mode: "x" }),
    "not json",
  ].join("\n");
  const out = extractSession(lines);
  assert.match(out, /使用者: 幫我修這個 bug/);
  assert.match(out, /助手: 好的,我來修/);
  assert.doesNotMatch(out, /hmm/);       // thinking skipped
  assert.doesNotMatch(out, /tool_use|Bash/); // tool_use skipped
});
```

- [ ] **Step 2: 執行測試,確認失敗**

Run: `node --test scripts/daily-gather.test.mjs`
Expected: FAIL(新函式尚未匯出)。

- [ ] **Step 3: 實作兩個函式**

在 `scripts/daily-gather.mjs` 追加:
```js
export function parseGitLog(text) {
  return text
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const [hash, subject = ""] = lines[0].split("\x1f");
      const files = lines.slice(1).map((l) => l.trim()).filter(Boolean);
      return { hash, subject, files };
    });
}

export function extractSession(jsonlText) {
  const turns = [];
  for (const line of jsonlText.split("\n")) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type !== "user" && o.type !== "assistant") continue;
    const c = o.message && o.message.content;
    let text = "";
    if (typeof c === "string") text = c;
    else if (Array.isArray(c)) text = c.filter((b) => b && b.type === "text").map((b) => b.text).join("\n");
    text = text.trim();
    if (!text) continue;
    turns.push((o.type === "user" ? "使用者: " : "助手: ") + text);
  }
  return turns.join("\n\n");
}
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `node --test scripts/daily-gather.test.mjs`
Expected: PASS(含 Task 1 共 8 個測試)。

- [ ] **Step 5: Commit**

```bash
git add scripts/daily-gather.mjs scripts/daily-gather.test.mjs
git commit -m "Add git-log and session extraction parsers with tests"
```

---

### Task 3: `trim` + `renderBundle`

**Files:**
- Modify: `scripts/daily-gather.mjs`
- Modify: `scripts/daily-gather.test.mjs`

**Interfaces:**
- Produces:
  - `trim(text: string, cap: number)` → `string`。未超過 `cap` 原樣回傳;超過則截到 `cap` 字並附 `\n\n…(已裁切 N 字)`。
  - `renderBundle(date: string, sources)` → `string`。`sources` = `[{ repo, commits: [{hash,subject,files}], sessionText: string }]`。全部來源皆無 commit 且無 session 文字 → 回傳字串 `"NO_CONTENT"`;否則回傳每個 repo 分段(commits → session 重點)的 markdown。

- [ ] **Step 1: 追加失敗測試**

在 `scripts/daily-gather.test.mjs` 末端追加:
```js
import { trim, renderBundle } from "./daily-gather.mjs";

test("trim leaves short text unchanged and truncates long text with a note", () => {
  assert.equal(trim("short", 100), "short");
  const out = trim("abcdefghij", 4);
  assert.ok(out.startsWith("abcd"));
  assert.match(out, /已裁切 6 字/);
});
test("renderBundle returns NO_CONTENT when nothing is present", () => {
  assert.equal(renderBundle("2026-07-04", [{ repo: "/x", commits: [], sessionText: "" }]), "NO_CONTENT");
});
test("renderBundle renders commits and session per repo", () => {
  const out = renderBundle("2026-07-04", [
    { repo: "/x", commits: [{ hash: "abc", subject: "do", files: ["a.js"] }], sessionText: "使用者: hi" },
  ]);
  assert.match(out, /## \/x/);
  assert.match(out, /abc do \(a\.js\)/);
  assert.match(out, /使用者: hi/);
});
```

- [ ] **Step 2: 執行測試,確認失敗**

Run: `node --test scripts/daily-gather.test.mjs`
Expected: FAIL(新函式尚未匯出)。

- [ ] **Step 3: 實作兩個函式**

在 `scripts/daily-gather.mjs` 追加:
```js
export function trim(text, cap) {
  if (text.length <= cap) return text;
  const cut = text.length - cap;
  return text.slice(0, cap) + `\n\n…(已裁切 ${cut} 字)`;
}

export function renderBundle(date, sources) {
  const hasContent = sources.some((s) => (s.commits && s.commits.length) || (s.sessionText && s.sessionText.trim()));
  if (!hasContent) return "NO_CONTENT";
  let out = `# 素材包 · ${date}\n`;
  for (const s of sources) {
    out += `\n## ${s.repo}\n`;
    if (s.commits && s.commits.length) {
      out += `\n### commits\n`;
      for (const c of s.commits) out += `- ${c.hash} ${c.subject}${c.files.length ? ` (${c.files.join(", ")})` : ""}\n`;
    } else {
      out += `\n(今天無 commit)\n`;
    }
    if (s.sessionText && s.sessionText.trim()) out += `\n### session 重點\n${s.sessionText}\n`;
  }
  return out;
}
```

- [ ] **Step 4: 執行測試,確認通過**

Run: `node --test scripts/daily-gather.test.mjs`
Expected: PASS(含前面共 11 個測試)。

- [ ] **Step 5: Commit**

```bash
git add scripts/daily-gather.mjs scripts/daily-gather.test.mjs
git commit -m "Add bundle trimming and rendering (with NO_CONTENT) with tests"
```

---

### Task 4: orchestrator(main)+ `gather` script + 整合驗證

**Files:**
- Modify: `scripts/daily-gather.mjs`(加 run-if-main orchestrator)
- Modify: `package.json`(加 `gather` script)

**Interfaces:**
- Consumes: `repoToProjectKey`, `matchesRepo`, `parseGitLog`, `extractSession`, `trim`, `renderBundle`(本檔);`readConfig`(`./blog-lib.mjs`,回傳 `{ contentDir }`)。
- Produces: 執行 `node scripts/daily-gather.mjs [--date YYYY-MM-DD]` → 有內容則寫 `automation/.cache/daily-<date>.md` 並在 stdout 印 bundle 路徑與目標草稿路徑 `<contentDir>/drafts/<date>.md`;無內容則印 `NO_CONTENT`。

- [ ] **Step 1: 加入 orchestrator**

在 `scripts/daily-gather.mjs` 末端追加(純函式在上方、已於 Task 1–3 完成):
```js
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { readConfig } from "./blog-lib.mjs";

function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isSameLocalDay(mtime, dateStr) {
  const p = (n) => String(n).padStart(2, "0");
  const s = `${mtime.getFullYear()}-${p(mtime.getMonth() + 1)}-${p(mtime.getDate())}`;
  return s === dateStr;
}

function expandHome(p) {
  return p.startsWith("~/") ? resolve(process.env.HOME || "", p.slice(2)) : p;
}

function gitCommits(repo, date, authorEmail) {
  try {
    const out = execFileSync(
      "git",
      ["-C", repo, "log", `--since=${date} 00:00`, `--until=${date} 23:59`,
       `--author=${authorEmail}`, "--no-merges", "--pretty=format:%x1e%h%x1f%s", "--name-only"],
      { encoding: "utf8" }
    );
    return parseGitLog(out);
  } catch {
    return [];
  }
}

function sessionText(repo, date, sessionsDir) {
  const key = repoToProjectKey(repo);
  const root = expandHome(sessionsDir);
  let dirs = [];
  try {
    dirs = readdirSync(root).filter((d) => matchesRepo(d, key));
  } catch {
    return "";
  }
  const parts = [];
  for (const d of dirs) {
    const dirPath = join(root, d);
    let files = [];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const fp = join(dirPath, f);
      try {
        if (!isSameLocalDay(statSync(fp).mtime, date)) continue;
        const text = extractSession(readFileSync(fp, "utf8"));
        if (text.trim()) parts.push(text);
      } catch {
        continue;
      }
    }
  }
  return parts.join("\n\n");
}

function main() {
  const dateArg = process.argv.indexOf("--date");
  const date = dateArg !== -1 ? process.argv[dateArg + 1] : todayLocal();
  const { contentDir } = readConfig();
  const cfg = JSON.parse(readFileSync("automation/config.json", "utf8"));
  const maxChars = cfg.maxChars || 40000;

  const sources = cfg.repos.map((repo) => ({
    repo,
    commits: gitCommits(repo, date, cfg.authorEmail),
    sessionText: sessionText(repo, date, cfg.sessionsDir),
  }));

  const withSession = sources.filter((s) => s.sessionText.trim()).length || 1;
  const perCap = Math.floor(maxChars / withSession);
  for (const s of sources) s.sessionText = trim(s.sessionText, perCap);

  const bundle = renderBundle(date, sources);
  if (bundle === "NO_CONTENT") {
    console.log("NO_CONTENT");
    return;
  }
  mkdirSync("automation/.cache", { recursive: true });
  const bundlePath = join("automation/.cache", `daily-${date}.md`);
  writeFileSync(bundlePath, bundle);
  const draftPath = join(contentDir, "drafts", `${date}.md`);
  console.log(`BUNDLE: ${bundlePath}`);
  console.log(`DRAFT_TARGET: ${draftPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 2: 加 `gather` npm script**

在 `package.json` `"scripts"` 加入:
```json
"gather": "node scripts/daily-gather.mjs"
```

- [ ] **Step 3: 確認測試仍全綠(orchestrator 不應在 import 時執行)**

Run: `node --test scripts/daily-gather.test.mjs`
Expected: PASS(11 個測試;因 `import.meta.url` 守衛,匯入測試時 orchestrator 不執行,不會有 git/fs 副作用)。

- [ ] **Step 4: 整合驗證(對真實 config 跑今天)**

Run:
```bash
node scripts/daily-gather.mjs --date $(node -e "const d=new Date(),p=n=>String(n).padStart(2,'0');console.log(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()))")
```
Expected: 因為今天在 willy-notes repo 有 commit,應印出 `BUNDLE: automation/.cache/daily-<date>.md` 與 `DRAFT_TARGET: content/drafts/<date>.md`;開啟 bundle 檔應看到 commits 區段(可能也有 session 重點)。若某天完全沒內容則印 `NO_CONTENT`。

- [ ] **Step 5: 驗證無內容情境**

Run(用一個過去、確定沒 commit/session 的日期):
```bash
node scripts/daily-gather.mjs --date 2000-01-01
```
Expected: 印出 `NO_CONTENT`,且不建立 `automation/.cache/daily-2000-01-01.md`。

- [ ] **Step 6: Commit**

```bash
git add scripts/daily-gather.mjs package.json
git commit -m "Add daily-gather orchestrator and gather script"
```

---

### Task 5: 註冊排程任務 + 端到端(控制者/使用者動作,非 coding subagent)

> 此任務**不是**寫程式,而是用 `create_scheduled_task` 工具註冊一次性排程,並做端到端驗證。由控制者(主 agent)執行工具呼叫;請勿派 coding subagent。**無 code commit。**

**ops 依賴**:排程 prompt 寫死 repo 絕對路徑 `/Users/willy/Developer/wwdc26-notes`。若日後把資料夾改名為 `willy-notes`,需更新此任務 prompt 的路徑(或改名後再註冊)。

- [ ] **Step 1: 用 `create_scheduled_task` 註冊**

參數:
- `taskId`: `daily-blog-draft`
- `cronExpression`: `0 17 * * 1-5`
- `notifyOnCompletion`: `true`
- `description`: `平日 17:00 把當天 commits + session 整理成部落格草稿`
- `prompt`(自包含):
  ```
  你是 willy-notes 的每日開發日誌產生器。請完全在本機完成,產出繁體中文。

  1. 在 /Users/willy/Developer/wwdc26-notes 執行:node scripts/daily-gather.mjs
  2. 若輸出包含 NO_CONTENT:不要建立任何檔案,回報「今天沒有可整理的內容」,結束。
  3. 否則輸出會有兩行:BUNDLE: <素材包路徑> 與 DRAFT_TARGET: <目標草稿路徑>。
     - 若 DRAFT_TARGET 指向的檔案已存在:不要覆蓋,回報「今天的草稿已存在,略過」,結束。
     - 否則讀取 BUNDLE 檔,將它整理成一篇繁體中文開發日誌,寫到 DRAFT_TARGET。
  4. 草稿檔開頭必須是這個 YAML frontmatter(<date> 用 DRAFT_TARGET 檔名的日期):
     ---
     title: 開發日誌 · <date>
     date: <date>
     summary: (你寫的一句話摘要)
     tags: [當天有動到的專案名]
     ---
     之後用這三個小節組織內文:## 今天做了什麼 / ## 解決的問題 / ## 學到 / 值得記的。
  5. 回報:寫了哪個檔、標題與一句話摘要。內容只寫進草稿,不要發佈、不要 git commit。
  ```

- [ ] **Step 2: 確認已註冊**

用 `list_scheduled_tasks` 確認出現 `daily-blog-draft`,`cronExpression` 為 `0 17 * * 1-5`、`enabled`。

- [ ] **Step 3: 端到端(手動觸發一次)**

手動觸發 `daily-blog-draft`(或直接照 prompt 步驟跑一次)。預期:今天有 commit → 產出 `content/drafts/<今天>.md`,含正確 frontmatter 與三小節;`npm run preview` 後可在 `localhost:8788/blog/drafts/<今天>` 看到排版。若草稿已存在則回報略過。

---

## 收尾(全部 task 完成後)

- **建議**:待本機資料夾改名為 `willy-notes` 後,更新排程任務 prompt 內的路徑(或改名後才註冊 Task 5)。
- `automation/config.json` 的 `repos` 由使用者填入實際要追蹤的 repo 清單。
- 產出的草稿一律人工 `publish`(階段三不自動發佈)。

## 後續(不在本計畫)

- 三個階段完成後,willy-notes 個人網站骨架 + 部落格 + 每日自動化即完整。後續可視需要加標籤篩選、語法高亮、圖片管線等(皆為既有 spec 的非目標,另議)。
