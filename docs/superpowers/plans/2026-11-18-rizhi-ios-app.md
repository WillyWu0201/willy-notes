# 日知 iOS App — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 網站多輸出一份給 App 讀的 JSON 和兩個上架必備的頁面，再做出原生 iPhone App「日知」（含 Widget 和 iPhone Duo 版面），一路做到只剩 Apple 帳號相關步驟就能送審。

**Architecture:**
- 網站：`scripts/build-digest.mjs` 的 `buildAll()` 從同一份 `content/digests/{date}.json` 多寫 `public/digest/api/v1/` 的 JSON；新增 `public/app/privacy.html`、`public/app/support.html`。
- App：放在 `ios/`，手寫的 Xcode 專案（objectVersion 77，用資料夾同步群組，新檔案不用改專案檔）。`ios/Shared/` 同時編進 App 和 Widget。
- 資料流：`DigestAPI` 抓 JSON → `DigestCache` 存進 App Group → `DigestStore`（`@Observable`、`@MainActor`）給畫面用。收藏和已讀用 SwiftData。
- 版面看可用寬度：小於 700 pt 單欄（內文最寬 640 pt 置中）；700 pt 以上兩欄，在摺線分開。
- 測試：Swift Testing 測邏輯；XCUITest 測 §13 驗收。E2E 用 `ios/Fixtures/` 的範例資料（從 `content/digests/2026-11-18.json` 產生），App 在 DEBUG 建置讀 `JC_*` 環境變數改資料來源和時間。

**Tech Stack:** Node 18+ ESM、`node --test`；Xcode 27.1、iOS 27.1 SDK、Swift 6（嚴格並行檢查）、SwiftUI、SwiftData、WidgetKit、SafariServices、WebKit（SwiftUI `WebView`／`WebPage`）、UserNotifications、StoreKit、Swift Charts、Swift Testing、XCTest／XCUIAutomation。不用第三方套件。

**Spec:** `docs/superpowers/specs/2026-11-18-digest-ios-app-spec.html`（唯一依據，編號 S／F／R／D／P 都指這份）；`docs/superpowers/specs/2026-11-18-digest-ios-app-design.md`（同內容的文字版）。兩份有出入時以 `.html` 為準。

## Global Constraints

- Bundle ID：`com.willywu.jihchih`；Widget：`com.willywu.jihchih.widget`；App Group：`group.com.willywu.jihchih`；URL scheme：`jihchih`。
- 顯示名稱「日知」；版本 `1.0`，build `1`；最低 iOS 26.0；只做 iPhone（`TARGETED_DEVICE_FAMILY = 1`）；支援所有方向（D20）。
- 介面只有繁體中文、台灣用語（D13）。專案開發語言 `zh-Hant`，系統畫面（Safari 畫面的「完成」等）也會是中文。原文標題不翻譯。
- 資料網址寫死：`https://willy-notes.pages.dev/digest/api/v1/`。只有 DEBUG 建置才讀 `JC_API_BASE` 覆寫。
- 四個分類的順序和名稱固定：`dev`「AI 開發方式」、`industry`「AI 產業動態」、`apple`「iOS / Apple」、`finance`「金融與虛擬資產」。
- 「今天」一律用台北時間（`Asia/Taipei`）判斷（D10）。
- 我們自己畫面上的任何東西都不能讓讀者跳到其他 App。所有網址用 App 內的 `SFSafariViewController` 開（預設閱讀器模式），App Store 頁面用 `SKStoreProductViewController`。不准呼叫 `UIApplication.shared.open`，也不准放會開「設定」App 的按鈕（D12）。
- 全部用系統元件（R23）；唯一的例外是分類標籤（D26）。顏色用語意色，強調色是 `#3B5BDB`（淺色）／`#8AA0F2`（深色）。SF Symbols。可點範圍至少 44 pt。
- 文案（照抄）：
  - 通知內文「看看今天的資訊摘要」
  - 「今天的摘要還沒出來，這是 M月d日 的內容」
  - 「離線中，顯示 M/d HH:mm 更新的內容」
  - 「有新版 App，請更新」
  - 「今天沒有」
  - 「文中提到，未附連結」
  - 「這一類看完了 · 下一類：{分類} {N} 篇」
  - 「這支影片在講什麼」「閱讀原文」「開啟影片頁面」「想一想」「重點」「延伸閱讀」「一句話摘要」
  - 關於：「摘要由 AI 整理，可能有錯，請以原文為準。金融相關內容不構成投資建議。」
- 預設值：每日提醒關、時間 09:30；閱讀器模式開；內文字級「標準」。
- 每做一個自己判斷的決定，在 `docs/ios-app/decisions.md` 加一筆，跟著那次 commit。格式：`## 日期 · 階段 · 標題`，下面五項：遇到什麼問題／考慮過的做法／選了哪個、為什麼／選錯的代價／怎麼改回來。繁體中文、台灣用語。
- 不 push、不改 `automation/`、不改網站現有頁面、不手動跑 `npm run digest:publish` 或 wrangler。
- 模擬器：一般 iPhone 用「Jihchih 17 Pro Max」（iOS 27.2，`F1C511B4-8871-4969-AA33-677547B6A310`）；Duo 用「iPhone Duo」（iOS 27.1，`26CAD93A-D93B-4D06-BD2B-8ADE91EAC618`，這台已授權給 iOS Simulator 工具，可以切換開闔；同名的還有一台，所以 destination 一律用 `id=`）。iOS 27.1 runtime 只支援 iPhone Duo，所以一般 iPhone 用 27.2（已記進決策紀錄）。需要用 iOS Simulator 工具點按一般 iPhone 時（例如加 Widget），用已授權的「iPhone 17 Pro」（iOS 27.0，`51BBFDBA-1864-4295-AC44-457C8185AB86`）。
- 每個 iOS 任務的完成條件：`ios/scripts/test.sh unit` 全過、該任務新增的 UI 測試在兩台模擬器都過、`ios/scripts/test.sh release` 編譯成功。

## Review Focus

1. **同一天有兩篇網址相同的文章** → id 重複，SwiftUI 清單會錯亂。網站輸出 JSON 時，同一天依 id 去重，只留第一篇 → Task 1 測試 `buildApi dedupes items with the same id within a day`。
2. **一篇文章的格式壞了**（缺 `title`，或 `deep: true` 但沒有 `points`）→ 只略過那一篇，不能整天空白（失敗條件第 5 條）→ Task 4 測試 `dayDecodingSkipsBrokenItems`、`deepItemWithoutPointsStillDecodes`。
3. **手機不在台灣時區**（例如美西晚上，台北已經是隔天早上）→ 「今天」照台北時間算，不顯示「還沒出來」 → Task 5 測試 `todayUsesTaipeiNotDeviceZone`。
4. **索引讀得到，但那一天的 JSON 讀不到**（404 或斷線）→ 有快取用快取並顯示離線提示，沒有快取就顯示「重試」，不能閃退或整頁空白 → Task 6 測試 `dayFetchFailureFallsBackToCachedDay`、`dayFetchFailureWithoutCacheReportsFailure`。
5. **延伸閱讀或原文網址含空白、非 ASCII 字元或不是 http(s)** → `URL(string:)` 失敗時當成「文中提到，未附連結」，不能閃退 → Task 4 測試 `furtherWithInvalidURLHasNoLink`。

---

## 檔案結構

| 檔案 | 責任 |
|---|---|
| `scripts/digest-api.mjs`（新） | `itemId`、`videoOf`、`buildApi`、`writeApi`：把每天的摘要轉成 App 用的 JSON |
| `scripts/digest-api.test.mjs`（新） | 上面每條規則的測試 |
| `scripts/build-digest.mjs`（改） | `buildAll()` 多呼叫 `writeApi("public/digest/api/v1", days)` |
| `scripts/build-app-fixtures.mjs`（新） | 從 11/17、11/18 的真實資料產生 `ios/Fixtures/` |
| `scripts/app-pages.mjs`、`scripts/app-pages.test.mjs`（新） | 用網站的 `layout()` 產生隱私權政策和支援頁 |
| `public/app/privacy.html`、`public/app/support.html`（新，產生的） | `/app/privacy`、`/app/support` |
| `package.json`（改） | 加 `build:app-fixtures`、`build:app-pages` |
| `docs/ios-app/decisions.md`（新） | 決策紀錄 |
| `ios/Jihchih.xcodeproj/` | 手寫的專案檔和共用 scheme |
| `ios/Config/` | `Jihchih-Info.plist`（URL scheme）、`JihchihWidget-Info.plist`、兩個 `.entitlements` |
| `ios/Shared/` | App 和 Widget 共用：資料模型、API、快取、台北時間、分組、深層連結 |
| `ios/Jihchih/` | App：畫面、狀態、SwiftData、Safari、播放器、提醒、資產、隱私清單 |
| `ios/JihchihWidget/` | Widget：小、中尺寸、隱私清單 |
| `ios/JihchihTests/` | Swift Testing 單元測試 |
| `ios/JihchihUITests/` | XCUITest E2E（含 `Duo/`） |
| `ios/Fixtures/` | E2E 和單元測試的範例資料 |
| `ios/scripts/test.sh` | 統一的測試指令：`unit`、`ui phone`、`ui duo`、`release`、`all` |
| `ios/scripts/make-icon.swift` | 產生淺色、深色、單色的 1024 px App 圖示 |
| `docs/ios-app/release-checklist.md`、`app-store-listing.md`、`acceptance.md`、`screenshots/` | 上架準備的文件和截圖 |

---

## 第一階段：網站輸出 JSON

### Task 1: App 用的 JSON 和範例資料

**Files:**
- Create: `scripts/digest-api.mjs`, `scripts/digest-api.test.mjs`, `scripts/build-app-fixtures.mjs`, `docs/ios-app/decisions.md`
- Modify: `scripts/build-digest.mjs`（`buildAll()` 多一行）, `package.json`（`"build:app-fixtures": "node scripts/build-app-fixtures.mjs"`）
- Generate: `public/digest/api/v1/*.json`, `ios/Fixtures/api/v1/{index,2026-11-17,2026-11-18}.json`, `ios/Fixtures/needs-update/api/v1/{index,2026-11-18}.json`

**Interfaces:**
- Consumes: `CATEGORIES`, `categoryOf`, `isWebUrl`（`scripts/digest-lib.mjs`）、`groupByCategory`（`scripts/build-digest.mjs`，決定每篇歸哪一類和 deep，跟網頁一致）。
- Produces:
  - `itemId(url: string): string`：`sha256(url)` 的 hex 前 16 碼。
  - `videoOf(url: string): {provider:"youtube", id:string} | null`：只認 `youtube.com/watch?v=`（含 `www.`、`m.`）、`youtu.be/`、`youtube.com/shorts/`，id 必須是 11 碼 `[A-Za-z0-9_-]`。
  - `toTaipeiIso(iso: string): string`：`"2026-11-18T01:01:52.522Z"` → `"2026-11-18T09:01:52+08:00"`。
  - `buildApi(days, {minimumAppVersion = "1.0"} = {}): { index, files: Map<date, dayJson> }`，`days` 是 `content/digests` 讀出來、由新到舊的陣列。
  - `writeApi(dir: string, days, opts?)`：寫 `index.json` 和每天一個 `{date}.json`，並刪掉 `dir` 裡已經不在 `days` 的 `{date}.json`。
- JSON 格式照規格 §7，另外**加**一個欄位：每天的 JSON 有 `generatedAt`（台北時間，`+08:00`），讓 App 顯示那一天的更新時間（規格允許只加欄位）。`index.generatedAt` 用最新一天的 `generatedAt`，所以內容沒變就不會產生新的 commit。

- [ ] **Step 1: 寫失敗的測試** `scripts/digest-api.test.mjs`，用跟 `build-digest.test.mjs` 同一份假資料的寫法：
  - `itemId is the first 16 hex chars of sha256(url)`：`itemId("https://simonwillison.net/2026/Nov/17/datasette-lite/")` 等於 Node `createHash("sha256")` 算出來的前 16 碼，長度 16。
  - `videoOf recognises the three YouTube forms and nothing else`：`watch?v=9RKrSF9d2SE`、`https://youtu.be/9RKrSF9d2SE?t=3`、`https://www.youtube.com/shorts/9RKrSF9d2SE` 都得到 `{provider:"youtube", id:"9RKrSF9d2SE"}`；`https://www.youtube.com/@AIEngineer`、`https://vimeo.com/1`、`not a url` 都是 `null`。
  - `buildApi index lists categories, days newest first, and per-category counts`：`schemaVersion: 1`、`minimumAppVersion: "1.0"`、`categories` 等於 `CATEGORIES`、每天的 `counts` 四類都有（0 也要有）、`total` 等於 counts 加總、`generatedAt` 是 `+08:00` 格式。
  - `buildApi day items skip dropped and non-http items and match the web page grouping`：用 `build-digest.test.mjs` 的 `day`，`items` 的標題順序是 `["Agentic <Verification>", "Talk", "GPT-6", "穩定幣"]`，`category` 依序是 `dev, dev, industry, finance`。
  - `buildApi maps fields: publishedOn, nullable summary, deep-only fields, further url only when http`：deep 的那篇有 `points/questions/further`，`further[1]` 沒有 `url` 鍵；非 deep 的那篇沒有 `points` 鍵；沒有 `date` 的那篇 `publishedOn === null`；沒有 `summary` 的那篇 `summary === null`；`video` 對 YouTube 那篇是物件、其他是 `null`。
  - `buildApi dedupes items with the same id within a day`：同一天放兩篇同網址，只輸出第一篇，`total` 也只算一篇。
  - `writeApi writes index and day files and removes stale day files`：寫到 `mkdtempSync` 的資料夾；先放一個 `2020-01-01.json`，寫完它就不見了。

- [ ] **Step 2: 跑測試確認失敗**
  Run: `node --test scripts/digest-api.test.mjs`
  Expected: FAIL（`Cannot find module './digest-api.mjs'`）

- [ ] **Step 3: 實作 `scripts/digest-api.mjs`**，用 `groupByCategory(day.items)` 決定每篇的類別和順序（dev 先 deep 後其他，跟網頁一樣），`deep` 只在 `groupByCategory` 把它放進 `g.deep` 時才是 `true`。`further` 每筆輸出 `{title, note}`，`url` 只在 `isWebUrl` 時才加。

- [ ] **Step 4: 跑測試確認通過**
  Run: `node --test scripts/digest-api.test.mjs`
  Expected: PASS

- [ ] **Step 5: 接上 `buildAll()`**：在寫完 HTML 之後呼叫 `writeApi(join(OUT, "api/v1"), days)`。補一個測試到 `scripts/build-digest.test.mjs`：`buildAll writes the app JSON next to the pages`——在暫存資料夾裡放一份 `content/digests/2026-11-09.json`，`process.chdir` 進去跑 `buildAll()`，確認 `public/digest/api/v1/index.json` 和 `2026-11-09.json` 存在（測完 chdir 回來）。

- [ ] **Step 6: 寫 `scripts/build-app-fixtures.mjs`**：讀 `content/digests/2026-11-17.json`、`2026-11-18.json`，用 `buildApi` 產生：
  - `ios/Fixtures/api/v1/`：`index.json`（只列這兩天）、兩個日期檔。
  - `ios/Fixtures/needs-update/api/v1/`：`index.json`（只列 11/18，`minimumAppVersion: "99.0"`）、`2026-11-18.json`。
  JSON 用兩格縮排、結尾換行。

- [ ] **Step 7: 產生並檢查輸出**
  Run: `npm run build:digest && npm run build:app-fixtures && npm test`
  Expected: `built 11 digest pages`；`npm test` 全過；`public/digest/api/v1/2026-11-18.json` 有 15 篇，`counts` 是 `{"dev":2,"industry":12,"apple":0,"finance":1}`；影片那篇的 `video.id` 是 `9RKrSF9d2SE`。

- [ ] **Step 8: 建立 `docs/ios-app/decisions.md`**，先寫入下面幾筆（日期 2026-11-18）：
  1. 每天的 JSON 多一個 `generatedAt` 欄位。
  2. `index.generatedAt` 用最新一天的時間，不用建置時間。
  3. 同一天網址相同的文章去重。
  4. 一般 iPhone 測試用 iOS 27.2 的 17 Pro Max，因為 27.1 runtime 只有 Duo。
  5. Apple 的 Duo 設計指引頁（HIG）、`developer.apple.com/documentation/swiftui`、`preparing-your-app-for-iphone-duo` 這次只讀得到標題，`uikit/supporting-iphone-duo` 是 404。讀得到的是 Tech Talk 111461 的逐字稿、論壇 847644、三篇開發者文章。

- [ ] **Step 9: Commit**

```bash
git add scripts/digest-api.mjs scripts/digest-api.test.mjs scripts/build-digest.mjs scripts/build-digest.test.mjs scripts/build-app-fixtures.mjs package.json public/digest/api ios/Fixtures docs/ios-app/decisions.md
git commit -m "Publish the digest as JSON for the 日知 app"
```

### Task 2: 隱私權政策和支援頁

**Files:**
- Create: `scripts/app-pages.mjs`, `scripts/app-pages.test.mjs`
- Generate: `public/app/privacy.html`, `public/app/support.html`
- Modify: `package.json`（`"build:app-pages": "node scripts/app-pages.mjs"`）

**Interfaces:**
- Consumes: `layout(title, bodyHtml)`、`esc`（`scripts/blog-lib.mjs`）。
- Produces: `renderPrivacy(): string`、`renderSupport(): string`、`buildAppPages(outDir = "public/app")`。

- [ ] **Step 1: 寫失敗的測試** `scripts/app-pages.test.mjs`：
  - `privacy page states no data collection, the only server, local reminders and YouTube`：包含「不收集任何個人資料」「沒有帳號」「不追蹤」「willy-notes.pages.dev」「本機」「YouTube」，並且有連結 `https://policies.google.com/privacy`，聯絡信箱 `willy.xcoder@gmail.com` 是 `mailto:` 連結。
  - `support page has the contact email and the three FAQs`：包含 `mailto:willy.xcoder@gmail.com`，以及三個問題：X 的文章要先登入、影片不能播、內容沒有更新（說明每天 09:00 台北時間更新，靠作者的電腦執行，偶爾會晚）。
  - `pages use the site layout`：`<html lang="zh-Hant">`、`/blog/blog.css`、`<title>` 分別是「日知 隱私權政策 · willy-notes」「日知 支援 · willy-notes」。
- [ ] **Step 2: 跑 `node --test scripts/app-pages.test.mjs`**，Expected: FAIL。
- [ ] **Step 3: 實作**。內文照規格 §8 和設計文件 §4.2 寫，用 `<div class="wrap"><article>…</article></div>` 包，跟部落格文章頁同一套樣式。加一行「最後更新：2026-11-18」。
- [ ] **Step 4: 產生頁面並跑全部測試**
  Run: `npm run build:app-pages && npm test`
  Expected: 兩個檔案產生；`npm test` 全過。
- [ ] **Step 5: 用本機伺服器確認**：`preview_start` 名稱 `willy-notes`（`.claude/launch.json` 已有），打開 `/app/privacy`、`/app/support`、`/digest/api/v1/index.json`，三個都是 200，頁面有網站的導覽列。
- [ ] **Step 6: Commit**

```bash
git add scripts/app-pages.mjs scripts/app-pages.test.mjs public/app package.json
git commit -m "Add the 日知 privacy and support pages"
```

### Task 3（控制者執行，不派 subagent）: 網站合併進 main

- [ ] `npm test` 全過後：`git -C /Users/twinb00589136/Developer/willy-notes merge --ff-only claude/rizhi-ios-app-270120`。main 已經往前走時，先在 worktree 把本分支 rebase 到 main 上（只動本分支），再 ff。
- [ ] 在主資料夾跑 `npm test`，全過。確認 `git -C … status --porcelain -- public functions lib wrangler.toml scripts/build-digest.mjs scripts/blog-lib.mjs scripts/digest-lib.mjs` 是空的（不會擋到 09:00 的部署）。不碰 `automation/config.json`、`content/drafts/`。

---

## 第二階段：閱讀核心

### Task 4: Xcode 專案骨架、資料模型和解碼

**Files:**
- Create: `ios/Jihchih.xcodeproj/project.pbxproj`, `ios/Jihchih.xcodeproj/xcshareddata/xcschemes/Jihchih.xcscheme`, `ios/Config/Jihchih-Info.plist`, `ios/Config/JihchihWidget-Info.plist`, `ios/Config/Jihchih.entitlements`, `ios/Config/JihchihWidget.entitlements`, `ios/scripts/test.sh`, `ios/README.md`
- Create: `ios/Jihchih/JihchihApp.swift`（先只放 `TabView` 和四個空分頁）, `ios/Jihchih/Assets.xcassets`（`AccentColor` 淺 `#3B5BDB`、深 `#8AA0F2`；`AppIcon` 先空著）, `ios/JihchihWidget/JihchihWidgetBundle.swift`（一個顯示「日知」的佔位 Widget）
- Create: `ios/Shared/Models/DigestModels.swift`, `ios/JihchihTests/DigestDecodingTests.swift`, `ios/JihchihTests/Support/Fixtures.swift`, `ios/Fixtures/edge/*.json`, `ios/JihchihUITests/Support/AppLauncher.swift`, `ios/JihchihUITests/SmokeTests.swift`
- Modify: `.gitignore`（加 `xcuserdata/`、`*.xcresult`、`ios/.build/`）

**專案檔的決定**（手寫，`objectVersion = 77`）：
- 四個 target：`Jihchih`（App）、`JihchihWidget`（WidgetKit extension，嵌入 App 的 PlugIns）、`JihchihTests`（unit，host 是 App）、`JihchihUITests`（UI，target 是 App）。
- 用 `PBXFileSystemSynchronizedRootGroup`：`Jihchih/` → App；`JihchihWidget/` → Widget；`Shared/` → App 和 Widget 都有；`JihchihTests/`、`JihchihUITests/` 各自。`Config/`、`Fixtures/`、`scripts/` 不進任何 target。
- 共用設定：`IPHONEOS_DEPLOYMENT_TARGET = 26.0`、`TARGETED_DEVICE_FAMILY = 1`、`SWIFT_VERSION = 6.0`、`SWIFT_STRICT_CONCURRENCY = complete`、`MARKETING_VERSION = 1.0`、`CURRENT_PROJECT_VERSION = 1`、`GENERATE_INFOPLIST_FILE = YES`、`CODE_SIGN_STYLE = Automatic`、`DEVELOPMENT_TEAM` 留空、`developmentRegion = zh-Hant`、`knownRegions = (zh-Hant, Base)`。
- App：`INFOPLIST_FILE = Config/Jihchih-Info.plist`（只放 `CFBundleURLTypes`，scheme `jihchih`），`INFOPLIST_KEY_CFBundleDisplayName = 日知`、`INFOPLIST_KEY_UILaunchScreen_Generation = YES`、`INFOPLIST_KEY_UISupportedInterfaceOrientations` 四個方向、`INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO`、`INFOPLIST_KEY_LSApplicationCategoryType = public.app-category.news`、`CODE_SIGN_ENTITLEMENTS = Config/Jihchih.entitlements`（App Group）。
- Widget：`INFOPLIST_FILE = Config/JihchihWidget-Info.plist`（`NSExtension` → `NSExtensionPointIdentifier = com.apple.widgetkit-extension`），`INFOPLIST_KEY_CFBundleDisplayName = 日知`，`CODE_SIGN_ENTITLEMENTS = Config/JihchihWidget.entitlements`，`SKIP_INSTALL = YES`。
- Scheme `Jihchih`：Build 含 App 和 Widget；Test 含兩個測試 target；Debug 跑測試，Archive 用 Release。

**`ios/scripts/test.sh`**（`set -euo pipefail`，從 repo 任何位置都能跑）：
- `unit` → `xcodebuild test -project ios/Jihchih.xcodeproj -scheme Jihchih -destination 'platform=iOS Simulator,name=Jihchih 17 Pro Max,OS=27.2' -only-testing:JihchihTests`
- `ui phone|duo` → 同上，`-only-testing:JihchihUITests`，duo 用 `id=26CAD93A-D93B-4D06-BD2B-8ADE91EAC618`；phone 用 `id=F1C511B4-8871-4969-AA33-677547B6A310`。
- `release` → `xcodebuild build -project ios/Jihchih.xcodeproj -scheme Jihchih -configuration Release -destination generic/platform=iOS CODE_SIGNING_ALLOWED=NO`
- `all` → `unit`、`ui phone`、`ui duo`、`release` 依序跑。
- 結果檔放 `ios/.build/results/<名稱>.xcresult`，跑之前刪掉舊的。最後印出 `xcrun xcresulttool get test-results summary` 的通過／失敗／略過數。

**Interfaces（`ios/Shared/Models/DigestModels.swift`，全部 `Codable, Hashable, Sendable`）：**
- `struct DigestCategory { let id: String; let label: String }`
- `struct DigestDaySummary { let date: String; let total: Int; let counts: [String: Int] }`
- `struct DigestIndex { let schemaVersion: Int; let generatedAt: Date?; let minimumAppVersion: String; let categories: [DigestCategory]; let days: [DigestDaySummary] }`（`days` 用逐筆解碼，壞的略過）
- `struct FurtherReading { let title: String; let url: URL?; let note: String? }`（`url` 不是合法 http(s) 時為 `nil`）
- `struct DigestVideo { let provider: String; let id: String }`
- `struct DigestItem: Identifiable { let id: String; let category: String; let title: String; let url: URL; let source: String; let publishedOn: String?; let summary: String?; let deep: Bool; let points: [String]; let questions: [String]; let further: [FurtherReading]; let video: DigestVideo? }`（缺的陣列解成 `[]`；`video` 只有 `provider == "youtube"` 才保留；`url` 不是 http(s) 時整篇解碼失敗）
- `enum ItemKind: String, Codable, Sendable { case deep, video, article }`，`DigestItem.kind`：`deep` 優先，再來有 `video` 是 `.video`，其他 `.article`。
- `struct DigestDay { let schemaVersion: Int; let date: String; let generatedAt: Date?; let items: [DigestItem] }`（`items` 逐筆解碼，壞的略過，同 id 只留第一篇）
- `enum DigestDecoding { static func decoder() -> JSONDecoder }`（ISO 8601 日期，含 `+08:00`）
- 測試用：`Fixtures.url(_ relativePath: String) -> URL`（以 `#filePath` 找到 `ios/Fixtures/`）、`Fixtures.data(_:) -> Data`。
- UI 測試用：`AppLauncher.launch(fixture: Fixture = .standard, now: String = "2026-11-18T10:00:00+08:00", reset: Bool = true, extraEnvironment: [String: String] = [:]) -> XCUIApplication`；`enum Fixture { case standard, needsUpdate, unreachable }`，對應 `ios/Fixtures/api/v1/`、`ios/Fixtures/needs-update/api/v1/`、`file:///nonexistent/jihchih/`。

**邊界範例檔 `ios/Fixtures/edge/`**（手寫）：
- `day-edge.json`：`summary: null` 的一篇；影片一篇；`further` 一筆沒 `url`、一筆 `url` 是 `"not a url"`；一篇 `category: "crypto"`；一篇缺 `title`；一篇 `deep: true` 但沒有 `points`；一篇多了不認得的欄位 `"mood": "x"`；兩篇同網址。
- `index-schema2.json`：`schemaVersion: 2`、多一個分類 `{"id":"crypto","label":"加密貨幣"}`、多一個不認得的欄位。

- [ ] **Step 1: 建專案骨架**（上面的專案檔、scheme、Config、空的 App 和 Widget、`test.sh`），`ios/scripts/test.sh release` 和在 Jihchih 17 Pro Max 上的 Debug 建置都成功。
- [ ] **Step 2: 寫失敗的測試** `DigestDecodingTests`（`@Suite`）：
  - `decodesRealIndex`：`Fixtures/api/v1/index.json` → 2 天，第一天 `2026-11-18`，`total == 15`，`counts["industry"] == 12`，`minimumAppVersion == "1.0"`。
  - `decodesRealDay`：`2026-11-18.json` → 15 篇；deep 那篇 `points.count == 5`、`questions.count == 3`、`further.count == 5`；影片那篇 `kind == .video`、`video?.id == "9RKrSF9d2SE"`；`generatedAt` 是台北 09:01。
  - `nullSummaryDecodesAsNil`、`furtherWithoutURLHasNoLink`、`furtherWithInvalidURLHasNoLink`、`unknownCategoryIsKept`（`category == "crypto"`）、`unknownFieldsAreIgnored`。
  - `dayDecodingSkipsBrokenItems`：缺 `title` 的那篇不在結果裡，其他都在。
  - `deepItemWithoutPointsStillDecodes`：`points == []`。
  - `duplicateIdsKeepFirst`。
  - `schemaVersion2IndexStillDecodes`：`schemaVersion == 2`，`categories.count == 5`。
- [ ] **Step 3: 跑 `ios/scripts/test.sh unit`**，Expected: FAIL（型別不存在）。
- [ ] **Step 4: 實作 `DigestModels.swift`**，逐筆解碼用一個私有的 `LossyArray<T>`（每筆 `try?`）。
- [ ] **Step 5: 跑 `ios/scripts/test.sh unit`**，Expected: PASS。
- [ ] **Step 6: 寫 `SmokeTests.testLaunchShowsFourTabs`**：用 `AppLauncher.launch()`，`app.tabBars.buttons` 有「今天」「過去」「收藏」「設定」。在兩台模擬器都跑過（`test.sh ui phone`、`test.sh ui duo`）。
- [ ] **Step 7: 決策紀錄**加「專案檔手寫、用資料夾同步群組」「`Shared/` 同時編進 App 和 Widget」「單篇壞掉只略過那篇」。
- [ ] **Step 8: Commit** `git add ios .gitignore docs/ios-app/decisions.md && git commit -m "Add the 日知 Xcode project and digest models"`

### Task 5: 台北時間、分組和其他純邏輯

**Files:**
- Create: `ios/Shared/Logic/TaipeiCalendar.swift`, `ios/Shared/Logic/DayGrouping.swift`, `ios/Shared/Logic/AppVersion.swift`, `ios/Jihchih/Logic/RefreshPolicy.swift`, `ios/Jihchih/Logic/StatusBanner.swift`, `ios/Jihchih/Logic/TextSizeLevel.swift`
- Test: `ios/JihchihTests/TaipeiCalendarTests.swift`, `DayGroupingTests.swift`, `AppVersionTests.swift`, `RefreshPolicyTests.swift`, `StatusBannerTests.swift`, `TextSizeLevelTests.swift`

**Interfaces:**
- `enum TaipeiCalendar`：`static let timeZone`（`Asia/Taipei`）；`static func dayString(for date: Date) -> String`（`yyyy-MM-dd`）；`static func titleDate(_ day: String) -> String`（`"11月18日 星期三"`）；`static func monthDay(_ day: String) -> String`（`"11月17日"`）；`static func shortDate(_ day: String) -> String`（`"11/17"`）；`static func time(_ date: Date) -> String`（`"09:01"`）；`static func shortDateTime(_ date: Date) -> String`（`"11/18 09:01"`）；`static func longDate(_ day: String) -> String`（`"2026 年 11 月 17 日"`）；`static func weekday(_ day: String) -> String`（`"週三"`）。格式都用 `zh_Hant_TW` 和台北時區。
- `struct CategorySection: Identifiable, Hashable { let id: String; let label: String; let deep: [DigestItem]; let others: [DigestItem]; var count: Int; var items: [DigestItem] }`（`items` = deep 後接 others）
- `enum DayGrouping`：
  - `static func sections(for day: DigestDay, categories: [DigestCategory]) -> [CategorySection]`：照 `categories` 的順序，每一類都有（0 篇也有）；文章的類別不在 `categories` 裡就略過；每類 deep 在前、其他在後，保持 JSON 順序。
  - `static func defaultCategory(_ sections: [CategorySection]) -> String?`：`dev` 有文章就選它，否則第一個有文章的，全空時回傳第一類。
  - `static func nextCategory(after id: String, in sections: [CategorySection]) -> CategorySection?`：後面第一個有文章的；沒有就 `nil`。
  - `static func nextItem(after itemID: String, in sections: [CategorySection]) -> DigestItem?`：同一類裡排在後面的那篇；最後一篇回傳 `nil`。
- `enum AppVersion { static func isOlder(_ current: String, than minimum: String) -> Bool }`：用點分隔的數字逐段比，缺的段當 0（`"1.0"` 對 `"1.0.0"` 不算較舊）。
- `enum RefreshPolicy { static let interval: TimeInterval = 15 * 60; static func shouldRefresh(lastRefresh: Date?, now: Date) -> Bool }`
- `enum StatusBanner: Equatable { case offline(updatedAt: Date); case stale(latestDay: String); case updateAvailable }`，`var text: String`（照 Global Constraints 的文案）；`static func current(isOffline: Bool, updatedAt: Date?, latestDay: String?, today: String, needsUpdate: Bool) -> StatusBanner?`。一次只回傳一條，優先順序：離線 > 今天還沒更新 > 需要更新（寫進決策紀錄）。
- `enum TextSizeLevel: Int, CaseIterable, Identifiable { case small = 0, standard, large, extraLarge }`，`label`（小、標準、大、特大），`func adjusted(_ base: DynamicTypeSize) -> DynamicTypeSize`：在 `DynamicTypeSize.allCases` 裡位移 -1、0、+1、+2，超出範圍就停在兩端（D23）。

- [ ] **Step 1: 寫失敗的測試**（重點斷言）：
  - `todayUsesTaipeiNotDeviceZone`：`2026-11-17T17:30:00Z`（台北 11/18 01:30、美西 11/17）→ `"2026-11-18"`。
  - `formatsMatchSpec`：`titleDate("2026-11-18") == "11月18日 星期三"`、`shortDate == "11/18"`、`monthDay == "11月18日"`、`weekday("2026-11-15") == "週日"`、`shortDateTime(09:01 台北) == "11/18 09:01"`。
  - `sectionsKeepFixedOrderIncludingEmpty`：真實 11/18 → id 依序 `dev, industry, apple, finance`，counts `2, 12, 0, 1`；`dev` 的 `items.first` 是 deep 那篇。
  - `unknownCategoryWithLabelIsShown`、`categoryMissingFromIndexIsSkipped`（用 `day-edge.json` + `index-schema2.json`）。
  - `defaultCategoryIsDevWhenItHasItems`、`defaultCategorySkipsEmptyDev`（dev 0 篇時選 industry）、`defaultCategoryWhenAllEmptyIsFirst`。
  - `nextCategorySkipsEmpty`：11/18 的 `industry` 之後是 `finance`（跳過 0 篇的 apple）；`finance` 之後是 `nil`。
  - `nextItemWithinCategory`：deep 那篇的下一篇是影片那篇；影片那篇的下一篇是 `nil`。
  - `appVersionComparison`：`isOlder("1.0", than: "1.0") == false`、`isOlder("1.0", than: "1.1") == true`、`isOlder("1.10", than: "1.9") == false`、`isOlder("1.0", than: "1.0.0") == false`。
  - `refreshAfterFifteenMinutes`：`nil` → true；14 分 59 秒 → false；15 分 → true。
  - `bannerPriority`：離線又過期 → `.offline`；只過期 → `.stale("2026-11-17")`，`text == "今天的摘要還沒出來，這是 11月17日 的內容"`；`.offline` 的 `text == "離線中，顯示 11/18 09:01 更新的內容"`；都沒有 → `nil`。
  - `textSizeShiftsAroundSystemSize`：`.large` 的 small → `.medium`、extraLarge → `.xxLarge`；`.xSmall` 的 small 還是 `.xSmall`；`.accessibility5` 的 extraLarge 還是 `.accessibility5`。
- [ ] **Step 2: 跑 `ios/scripts/test.sh unit`**，Expected: FAIL。
- [ ] **Step 3: 實作**上面的型別。
- [ ] **Step 4: 跑 `ios/scripts/test.sh unit`**，Expected: PASS。
- [ ] **Step 5: Commit**（含決策紀錄的「提示的優先順序」）`git commit -m "Add Taipei dates, grouping and banner rules"`

### Task 6: 抓資料、快取和 DigestStore

**Files:**
- Create: `ios/Shared/Data/AppGroup.swift`, `ios/Shared/Data/DigestAPI.swift`, `ios/Shared/Data/DigestCache.swift`, `ios/Jihchih/Support/LaunchOptions.swift`, `ios/Jihchih/Data/DigestStore.swift`
- Test: `ios/JihchihTests/DigestCacheTests.swift`, `ios/JihchihTests/DigestStoreTests.swift`

**Interfaces:**
- `enum AppGroup { static let id = "group.com.willywu.jihchih"; static var containerURL: URL }`：App Group 的資料夾；拿不到（`nil`）時退回 App 自己的 Application Support。
- `protocol DigestFetching: Sendable { func fetch(_ path: String) async throws -> Data }`（`path` 是 `"index.json"` 或 `"2026-11-18.json"`）
- `struct DigestAPI: DigestFetching { static let productionBase = URL(string: "https://willy-notes.pages.dev/digest/api/v1/")!; init(base: URL = productionBase, session: URLSession = .shared) }`：http 狀態不是 2xx 就丟錯；`file://` 網址（範例資料）回應不是 `HTTPURLResponse` 時直接當成功。逾時 15 秒。
- `struct DigestCache: Sendable { init(directory: URL); func save(_ data: Data, as name: String) throws; func load(_ name: String) -> Data?; func modificationDate(_ name: String) -> Date?; func prune(today: String, keepDays: Int = 30) throws; static var shared: DigestCache }`（`shared` 在 `AppGroup.containerURL/Library/Application Support/digest/`）。`prune` 刪掉日期早於「今天 − 30 天」的 `{date}.json`，`index.json` 不動。
- `struct LaunchOptions`（只在 `#if DEBUG` 讀環境變數，Release 一律是預設值）：`apiBase: URL?`（`JC_API_BASE`）、`now: Date?`（`JC_NOW`）、`reset: Bool`（`JC_RESET=1`）、`playerForcedError: Int?`（`JC_PLAYER_FORCE_ERROR`）、`reminderTime: String?`（`JC_REMINDER_TIME`，`HH:mm`）；`static let current`；`func nowDate() -> Date`。
- `@MainActor @Observable final class DigestStore`：
  - `init(fetcher: any DigestFetching, cache: DigestCache, now: @escaping @Sendable () -> Date)`
  - 狀態：`index: DigestIndex?`、`days: [String: DigestDay]`、`isOffline: Bool`、`isLoading: Bool`、`hasLoadFailure: Bool`（沒有快取又抓不到）、`lastRefresh: Date?`
  - 衍生：`latestDay: String?`、`today: String`、`needsUpdate: Bool`（`AppVersion.isOlder(Bundle 版本, than: index.minimumAppVersion)`）、`banner: StatusBanner?`、`categories: [DigestCategory]`
  - `func start() async`：先讀快取的 index 和最新一天（讀者先看到東西，F3），再 `refresh()`。
  - `func refresh() async`：抓 `index.json` → 存快取 → 抓最新一天 → 存快取 → `prune` → `isOffline = false`、`lastRefresh = now()`；任何一步失敗就 `isOffline = true`，保留快取的內容；完全沒有內容時 `hasLoadFailure = true`。成功後通知 Widget 重新整理（Task 17 才接上 `WidgetCenter`，這裡先留一個 `onRefreshed: (() -> Void)?`）。
  - `func day(_ date: String) async -> DigestDay?`：先看記憶體、再抓網路（成功就存快取）、失敗讀快取。
  - `func refreshIfStale() async`：`RefreshPolicy.shouldRefresh` 才 refresh。

- [ ] **Step 1: 寫失敗的測試**（`DigestStore` 用假的 `DigestFetching`：一個 `[String: Result<Data, Error>]` 的 actor 或 `Mutex` 包著的字典；快取用暫存資料夾）：
  - `cacheSavesLoadsAndPrunes`：存 `2026-10-01.json`、`2026-11-18.json`，`prune(today: "2026-11-18")` 後只剩 11/18 和 `index.json`。
  - `startShowsCacheBeforeNetwork`：快取裡有 11/17，網路回 11/18 → `start()` 結束後 `latestDay == "2026-11-18"`、`isOffline == false`。
  - `offlineFallsBackToCache`：快取有 index 和 11/18，網路全部丟 `URLError(.notConnectedToInternet)` → `days["2026-11-18"]?.items.count == 15`、`isOffline`、`banner == .offline(updatedAt: 09:01)`。
  - `noCacheAndOfflineReportsFailure`：`hasLoadFailure == true`、`days.isEmpty`。
  - `dayFetchFailureFallsBackToCachedDay`、`dayFetchFailureWithoutCacheReportsFailure`（`day("2026-11-17")` 回傳 `nil`）。
  - `staleWhenLatestIsNotTodayInTaipei`：`now` 是 11/19 10:00 台北 → `banner == .stale(latestDay: "2026-11-18")`。
  - `needsUpdateFromMinimumAppVersion`：用 `Fixtures/needs-update` → `needsUpdate == true`、`banner == .updateAvailable`。
- [ ] **Step 2: 跑 `ios/scripts/test.sh unit`**，Expected: FAIL。
- [ ] **Step 3: 實作**。`JihchihApp` 用 `LaunchOptions.current` 建 `DigestStore`（`apiBase` 有值就用它，`now` 用 `LaunchOptions.current.nowDate`），用 `.environment(store)` 往下傳。`reset` 為真時，在建任何東西之前刪掉快取資料夾。
- [ ] **Step 4: 跑 `ios/scripts/test.sh unit`**，Expected: PASS。
- [ ] **Step 5: Commit** `git commit -m "Fetch, cache and serve the digest"`

### Task 7: 「今天」畫面、分類標籤、文章卡片和 App 內 Safari

**Files:**
- Create: `ios/Jihchih/App/RootView.swift`, `ios/Jihchih/App/AppRouter.swift`, `ios/Jihchih/Safari/SafariView.swift`, `ios/Jihchih/Safari/SafariPresenter.swift`, `ios/Jihchih/Day/DayScreen.swift`, `ios/Jihchih/Day/CategoryChips.swift`, `ios/Jihchih/Day/ItemCard.swift`, `ios/Jihchih/Day/DayNavigation.swift`, `ios/Jihchih/Day/TodayTab.swift`, `ios/Jihchih/Support/ReadableWidth.swift`
- Modify: `ios/Jihchih/JihchihApp.swift`
- Test: `ios/JihchihTests/SafariConfigurationTests.swift`, `ios/JihchihUITests/TodayTests.swift`, `ios/JihchihUITests/StayInAppTests.swift`

**Interfaces:**
- `enum AppTab: Hashable { case today, past, bookmarks, settings }`；`@MainActor @Observable final class AppRouter { var tab: AppTab = .today }`（Task 16、17 會加深層連結）。
- `@MainActor @Observable final class SafariPresenter { var url: URL?; func open(_ url: URL) }`，在 `RootView` 用 `.fullScreenCover` 顯示 `SafariView`，並把環境的 `\.openURL` 換成 `OpenURLAction { presenter.open($0); return .handled }`，讓 `Link` 和 `Text` 裡的連結也走 App 內 Safari。
- `struct SafariView: UIViewControllerRepresentable { let url: URL; let readerMode: Bool; static func configuration(readerMode: Bool) -> SFSafariViewController.Configuration }`（`entersReaderIfAvailable = readerMode`，`barCollapsingEnabled = true`）。按「完成」時清掉 `presenter.url`。`readerMode` 讀 `@AppStorage("readerMode")`，預設 `true`。
- `@MainActor @Observable final class DayNavigation { var category: String?; var path: [ItemRoute] = []; var scrolledItemID: String? }`；`struct ItemRoute: Hashable { let date: String; let itemID: String }`。每個分頁自己持有一個（放在 `TodayTab` 的 `@State`），切換版面時狀態不會掉（Task 19 會用到）。
- `struct DayScreen: View { let date: String; let title: String; @Bindable var navigation: DayNavigation }`：
  - 標題用系統大標題；副標題 `.navigationSubtitle("11月18日 星期三 · 15 篇 · 09:01 更新")`。過去某一天的標題用 `TaipeiCalendar.monthDay`，副標題同格式。
  - `List`（`insetGrouped`），第一個區塊放狀態提示（Task 13）和 `CategoryChips`，之後每篇文章一個 `Section`（「每篇一塊圓角區塊」）。`dev` 有 deep 時加區塊標題「深度分析」「其他」。
  - 0 篇的分類顯示「今天沒有」。最後一個有文章的分類以外，清單最後一塊是「這一類看完了 · 下一類：AI 產業動態 12 篇」按鈕，點了切到那一類並捲到最上面。
  - 下拉重新整理（`.refreshable { await store.refresh() }`）。
  - 點文章：deep、video → `navigation.path.append(ItemRoute)`；article → `safari.open(item.url)`。
  - 內容最寬 640 pt 置中（`ReadableWidth` modifier），寬螢幕單欄時也一樣。
- `struct CategoryChips: View { let sections: [CategorySection]; @Binding var selection: String? }`：客製（D26）。可橫捲；選中的填 `Color.primary`、文字用背景色；其他是背景色底加 1 pt 細框；0 篇的用虛線框（`StrokeStyle(lineWidth: 1, dash: [4, 3])`），照樣可以點。每個標籤至少 44 pt 高，`accessibilityLabel("AI 開發方式，2 篇")`，選中的加 `.isSelected`。`accessibilityIdentifier("chip.<id>")`。
- `struct ItemCard: View { let item: DigestItem; let date: String }`：第一行「來源 · M/d」（沒有原文日期就只放來源）、標題（`.fontDesign(.serif)`，D25）、摘要（deep 最多 3 行、其他 2 行；`dynamicTypeSize.isAccessibilitySize` 時不限行數，寫進決策紀錄）。沒有摘要就不留空行。deep 卡底下一行「5 個重點 · 3 個反思問題 · 5 篇延伸閱讀」。影片卡在上方放深色底加 `play.fill` 的方塊，不載入縮圖（D28），並標「影片」。`accessibilityIdentifier("card.<id>")`；書籤、已讀狀態在 Task 11 加。
- 分頁列四個 `Tab`：今天（`sun.max`）、過去（`calendar`）、收藏（`bookmark`）、設定（`gearshape`）。

- [ ] **Step 1: 寫失敗的測試**
  - Unit `safariConfigurationFollowsReaderSetting`：`SafariView.configuration(readerMode: true).entersReaderIfAvailable == true`，`false` 時是 `false`。
  - UI `TodayTests`：
    - `testShowsLatestDayWithCategoryCounts`：導覽列標題「今天」；副標題含「11月18日 星期三 · 15 篇 · 09:01 更新」；四個標籤的 label 依序含「AI 開發方式，2 篇」「AI 產業動態，12 篇」「iOS / Apple，0 篇」「金融與虛擬資產，1 篇」；預設選中 `chip.dev`。
    - `testDevListsDeepFirst`：`dev` 底下第一張卡是 Datasette 那篇，有「深度分析」「其他」區塊標題。
    - `testSwitchingCategoriesShowsTheirItems`：點 `chip.industry` → 12 張卡；點 `chip.apple` → 「今天沒有」。
    - `testNextCategoryFooterSwitches`：在 `industry` 捲到底，點「這一類看完了 · 下一類：金融與虛擬資產 1 篇」→ `chip.finance` 是選中狀態。
    - `testPullToRefreshKeepsContent`：下拉後卡片還在。
  - UI `TodayTests.testUsesSystemTabAndNavigationBars`：`app.tabBars.count == 1`、`app.navigationBars["今天"].exists`（R23，系統元件）。
  - UI `StayInAppTests.testArticleOpensInAppSafari`：在 `industry` 點第一張卡 → 出現 Safari 畫面（找得到「完成」按鈕），`app.state == .runningForeground`，`XCUIApplication(bundleIdentifier: "com.apple.mobilesafari").state != .runningForeground`；按「完成」回到列表。
- [ ] **Step 2: 跑 unit 和 `test.sh ui phone`**，Expected: 新測試 FAIL。
- [ ] **Step 3: 實作**上面的畫面。
- [ ] **Step 4: 跑 `test.sh unit`、`test.sh ui phone`、`test.sh ui duo`**，Expected: PASS（Duo 闔上時是單欄，跟一般 iPhone 同一套）。
- [ ] **Step 5: 用模擬器截圖看一次淺色和深色**（`xcrun simctl ui <id> appearance dark`），跟規格 S1、S2 對照，版面、順序、文案一致。
- [ ] **Step 6: Commit** `git commit -m "Add the Today screen with category chips and cards"`

### Task 8: 詳情頁（深度分析、一般文章）和內文字級

**Files:**
- Create: `ios/Jihchih/Detail/ItemDetailScreen.swift`, `ios/Jihchih/Detail/DetailSections.swift`, `ios/Jihchih/Detail/TextSizeMenu.swift`
- Modify: `ios/Jihchih/Day/DayScreen.swift`（`navigationDestination(for: ItemRoute.self)`）
- Test: `ios/JihchihUITests/DetailTests.swift`

**Interfaces:**
- `struct ItemDetailScreen: View { let date: String; let item: DigestItem; var onSelectNext: ((DigestItem) -> Void)? }`：
  - 內容依序（R3、R19）：「AI 開發方式 · 深度分析」（類別 · 種類）、標題（襯線）、來源、「2026 年 11 月 17 日 · simonwillison.net」、「一句話摘要」區塊（淡藍底，`Color.accentColor.opacity(0.08)`）、「重點 5」用 01–05 編號、「想一想」加小字「反思問題 · 3 題」，淡黃底區塊，Q1–Q3 編號、「延伸閱讀 5」：有網址的是按鈕，點了用 App 內 Safari 開；沒網址的後面加「文中提到，未附連結」。
  - 文末「下一篇 · AI 開發方式」卡片（`DayGrouping.nextItem`），點了換成那一篇（deep／video 換內容，article 用 Safari 開）。最後一篇不顯示。
  - 一般文章（Task 19 兩欄時用、闔上時接續用）：類別、標題、來源 · 日期、「摘要」區塊、底部「閱讀原文」。
  - 底部工具列：「閱讀原文」（`.borderedProminent`，`accessibilityIdentifier("detail.readOriginal")`）。影片的按鈕在 Task 15 加。
  - 導覽列右邊：`TextSizeMenu`（Aa）、收藏、分享（收藏和分享在 Task 11 接上；這個任務先放 `ShareLink(item: item.url)`）。
  - 導覽列下方閱讀進度條：`ProgressView(value:)`，值由 `onScrollGeometryChange` 算（`contentOffset.y / (contentSize.height - containerSize.height)`，限制在 0…1）。
  - 文章內容（摘要、重點、想一想、延伸閱讀）套 `.dynamicTypeSize(level.adjusted(systemSize))`；標題和導覽列不受影響（R20）。內容最寬 640 pt 置中。
- `struct TextSizeMenu: View`：系統 `Menu` 裡放 `Picker`，四級（小、標準、大、特大），存在 `@AppStorage("textSize")`（`TextSizeLevel.rawValue`，預設 `1`）。`accessibilityIdentifier("detail.textSize")`。

- [ ] **Step 1: 寫失敗的 UI 測試** `DetailTests`：
  - `testDeepDetailShowsAllSections`：點 Datasette 卡 → 看得到「一句話摘要」「重點」「01」「05」「想一想」「Q1」「Q3」「延伸閱讀」「Datasette Lite」；`detail.readOriginal` 存在。
  - `testFurtherReadingOpensInApp`：點「Datasette Lite」→ Safari 畫面、App 還在前景。
  - `testReadOriginalOpensInApp`：點「閱讀原文」→ 同上。
  - `testNextArticleGoesToFollowingItem`：deep 頁文末有「下一篇」且標題是「2026 in LLMs — Simon Willison, Datasette」；點了之後標題換成影片那篇。
  - `testTextSizeMenuOffersFourLevels`：點 Aa → 「小」「標準」「大」「特大」都在，選「特大」後選單再打開時「特大」是勾選的。
- [ ] **Step 2: 跑 `test.sh ui phone`**，Expected: FAIL。
- [ ] **Step 3: 實作**。
- [ ] **Step 4: 跑 `test.sh unit`、`ui phone`、`ui duo`**，Expected: PASS。截圖對照 S3。
- [ ] **Step 5: Commit** `git commit -m "Add the article detail screen and text size levels"`

### Task 9: 「過去」

**Files:**
- Create: `ios/Jihchih/Past/PastTab.swift`, `ios/Jihchih/Past/PastDayRow.swift`, `ios/Jihchih/Logic/WeekGrouping.swift`, `ios/Shared/Logic/CategoryColor.swift`
- Test: `ios/JihchihTests/WeekGroupingTests.swift`, `ios/JihchihUITests/PastTests.swift`

**Interfaces:**
- `struct WeekGroup: Identifiable, Hashable { let id: String; let title: String; let days: [DigestDaySummary] }`
- `enum WeekGrouping { static func groups(_ days: [DigestDaySummary], today: String) -> [WeekGroup] }`：週一開始；今天所在的週叫「這一週」，前一週「上一週」，更早的用「11/3 – 11/9」（那一週的週一到週日）。保持由新到舊。
- `enum CategoryColor { static func color(for id: String) -> Color }`：`dev` 強調色、`industry` `.orange`、`apple` `.gray`、`finance` `.green`、其他 `.secondary`。`static func shortLabel(for id: String, label: String) -> String`：開發、產業、Apple、金融；其他用完整名稱。
- `PastTab`：`NavigationStack`，大標題「過去」，副標題最新一天的「2026 年 11 月」。上方是四類顏色圖例，下面依 `WeekGroup` 分區塊。每天一列：日（`18`）、`週三`、「15 篇」、今天加「今天」、Swift Charts 水平堆疊長條（隱藏座標軸和圖例，高 8 pt）、「開發 2 · 產業 12 · 金融 1」（0 篇的不列）。不顯示「數量異常」（D29）。點一列 → `DayScreen(date:)`，該頁有自己的 `DayNavigation`。`accessibilityIdentifier("past.<date>")`。
- `DayScreen` 拿不到那一天（`store.day(date)` 是 `nil`）時顯示 `ContentUnavailableView`「讀不到這一天的內容」加「重試」。

- [ ] **Step 1: 寫失敗的測試**：
  - `weekGroupsStartOnMonday`：日期 11/18（三）、11/17、11/16（一）、11/15（日）、11/09（日）、11/03（一），today `2026-11-18` → 三組：「這一週」[18, 17, 16]、「上一週」[15]、「11/3 – 11/9」[9, 3]。
  - `shortLabelsForKnownCategories`。
  - UI `testPastListsDaysAndOpensOne`：「過去」分頁有 `past.2026-11-18`（含「15 篇」「今天」）和 `past.2026-11-17`（「14 篇」）；點 11/17 → 標題「11月17日」，`chip.industry` 的 label 含「12 篇」。
- [ ] **Step 2–4: 跑測試確認失敗 → 實作 → 跑 `unit`、`ui phone`、`ui duo` 全過**，截圖對照 S6。
- [ ] **Step 5: Commit** `git commit -m "Add the Past tab"`

---

## 第三階段：收藏、已讀、離線、手勢

### Task 10: SwiftData 的收藏和已讀

**Files:**
- Create: `ios/Jihchih/Library/LibraryModels.swift`, `ios/Jihchih/Library/Library.swift`
- Modify: `ios/Jihchih/JihchihApp.swift`（建 `ModelContainer`，位置 `Application Support/Library.store`；`LaunchOptions.reset` 時先刪掉）
- Test: `ios/JihchihTests/LibraryTests.swift`

**Interfaces:**
- `@Model final class Bookmark { @Attribute(.unique) var itemID: String; var savedAt: Date; var day: String; var kindRaw: String; var payload: Data }`；`var item: DigestItem?`（解 `payload`）、`var kind: ItemKind`。
- `@Model final class ReadMark { @Attribute(.unique) var itemID: String; var readAt: Date }`
- `@MainActor enum Library`（都收 `ModelContext`）：
  - `isBookmarked(_ id: String, in:) -> Bool`、`toggleBookmark(_ item: DigestItem, day: String, now: Date, in:)`（存整篇 JSON，R6）、`removeBookmark(_ id: String, in:)`
  - `isRead(_ id: String, in:) -> Bool`、`markRead(_ id: String, now: Date, in:)`（已讀就不改時間）、`markUnread(_ id: String, in:)`、`readCount(of ids: [String], in:) -> Int`
  - `pruneReadMarks(now: Date, in:)`：刪掉 `readAt` 早於 90 天前的（R7）。App 啟動時呼叫一次。

- [ ] **Step 1: 寫失敗的測試**（`ModelConfiguration(isStoredInMemoryOnly: true)`）：
  - `bookmarkStoresFullItem`：收藏 deep 那篇後 `Bookmark.item` 的 `points`、`questions`、`further` 都跟原本一樣，`kind == .deep`。
  - `toggleTwiceRemoves`。
  - `markReadIsIdempotent`：第二次 `markRead` 不改 `readAt`。
  - `markUnreadRemoves`、`readCountCountsOnlyGivenIds`。
  - `pruneRemovesOlderThan90Days`：89 天前的留著，91 天前的刪掉。
- [ ] **Step 2–4: 失敗 → 實作 → `test.sh unit` 通過。**
- [ ] **Step 5: Commit** `git commit -m "Store bookmarks and read marks with SwiftData"`

### Task 11: 已讀狀態、書籤、滑動手勢、長按選單、進度圓環

**Files:**
- Create: `ios/Jihchih/Day/ItemActions.swift`（滑動、選單、無障礙動作共用的一組動作）, `ios/Jihchih/Day/ProgressGauge.swift`
- Modify: `ios/Jihchih/Day/ItemCard.swift`, `ios/Jihchih/Day/DayScreen.swift`, `ios/Jihchih/Detail/ItemDetailScreen.swift`
- Test: `ios/JihchihUITests/ReadAndGestureTests.swift`

**決定：**
- 卡片：未讀有藍點（`Circle` 8 pt，強調色）；已讀標題用 `.secondary`、沒有藍點。右上角書籤按鈕（`bookmark`／`bookmark.fill`，44 pt 點擊範圍，`accessibilityIdentifier("bookmark.<id>")`，label「收藏」／「取消收藏」）。
- 卡片無障礙：`accessibilityElement(children: .combine)` 之外，label 開頭依序加「未讀」「影片」「深度分析」（R14），例如「未讀，深度分析，Running the full…」。
- 滑動（R17、D21）：往右（leading，`allowsFullSwipe: true`）一個按鈕「標為已讀」／「標為未讀」；往左（trailing，`allowsFullSwipe: true`）「收藏」／「取消收藏」在前、「分享」在後。分享用 `ShareLink`。
- 長按：`contextMenu` 有收藏（或取消收藏）、分享、標為已讀（或標為未讀）。
- 無障礙動作：`accessibilityActions` 放同樣三個。
- 打開詳情頁或用 Safari 開原文時自動標為已讀（R7）。Duo 自動顯示的那篇例外（Task 19 處理）。
- 進度圓環（R18、D24）：`ToolbarItem(placement: .topBarTrailing)` 放 `Gauge(value: read, in: 0...total)`，`.gaugeStyle(.accessoryCircularCapacity)`，中間顯示已讀篇數；不能點。label「已讀 3 篇，共 15 篇」，`accessibilityIdentifier("gauge.progress")`。過去某一天顯示那一天的進度。
- 詳情頁的收藏、分享按鈕接上 `Library`。
- 「過去」點進某一天時，往右滑和系統返回手勢有沒有衝突要在模擬器上試（R17 最後一條）：從螢幕左邊緣開始往右拖是返回，從卡片中間開始往右拖是標為已讀。兩者都能用就保留；有衝突就照規格把那個畫面的已讀改放到往左滑。結果寫進決策紀錄。

- [ ] **Step 1: 寫失敗的 UI 測試** `ReadAndGestureTests`：
  - `testSwipeRightMarksReadAndBack`：在 `industry` 第一張卡往右滑到底 → 卡片 label 不再以「未讀」開頭、圓環 label「已讀 1 篇，共 15 篇」；再滑一次 → 回到「未讀」、「已讀 0 篇」。
  - `testSwipeLeftShowsBookmarkAndShare`：往左滑一半 → 看得到「收藏」「分享」；點「收藏」→ `bookmark.<id>` 的 label 變「取消收藏」。
  - `testFullSwipeLeftBookmarks`。
  - `testLongPressMenu`：長按 → 「收藏」「分享」「標為已讀」三項；點「標為已讀」→ 卡片已讀。
  - `testBookmarkButtonToggles`。
  - `testOpeningDetailMarksRead`：點 deep 卡進詳情再返回 → 那張卡已讀、圓環「已讀 1 篇」。
  - `testOpeningArticleMarksRead`：點一般文章、按「完成」→ 已讀。
  - `testPastDaySwipeAndBackGesture`：從「過去」點 11/17，在卡片中間往右滑 → 標為已讀；從左邊緣往右拖 → 回到「過去」列表。
  - `testAccessibilityActionsExist`：用 XCUIAutomation 在 iOS 27 的 `XCUIDevice.shared.voiceOverService`（能用的話）或改用單元層級的檢查，確認卡片有「收藏」「分享」「標為已讀」三個動作。做法寫進決策紀錄。
- [ ] **Step 2–4: 失敗 → 實作 → `unit`、`ui phone`、`ui duo` 全過。**截圖對照 S9、S18。
- [ ] **Step 5: Commit** `git commit -m "Add read state, swipe actions and the progress gauge"`

### Task 12: 「收藏」分頁

**Files:**
- Create: `ios/Jihchih/Bookmarks/BookmarksTab.swift`, `ios/Jihchih/Bookmarks/BookmarkCard.swift`, `ios/Jihchih/Logic/BookmarkFilter.swift`
- Test: `ios/JihchihTests/BookmarkFilterTests.swift`, `ios/JihchihUITests/BookmarksTests.swift`

**Interfaces:**
- `enum BookmarkFilter: String, CaseIterable, Identifiable { case all, deep, video, article }`，`label`（全部、深度、影片、文章）；`func matches(_ kind: ItemKind) -> Bool`；`static func counts(_ kinds: [ItemKind]) -> [BookmarkFilter: Int]`。
- `BookmarksTab`：`NavigationStack`，大標題「收藏」，副標題「4 篇 · 全部可離線閱讀」。上方系統分段控制（`Picker` `.segmented`），每段「全部 4」。`@Query(sort: \Bookmark.savedAt, order: .reverse)`。每張卡：種類（深度分析／影片／文章）、來源 · 類別、標題、「已存在手機 · 今天收藏」（今天、昨天，或「11/16 收藏」，用台北時間）。往左滑「移除」（`role: .destructive`，`allowsFullSwipe: true`）；書籤按鈕也能移除。清單底下小字「往左滑可以移除；收藏不會過期」。點卡片：deep、video 進詳情頁（用存下來的 `payload`，不用網路）；article 用 Safari 開。空的時候用 `ContentUnavailableView`「還沒有收藏」。

- [ ] **Step 1: 寫失敗的測試**：
  - `filterCountsAndMatching`：`[.deep, .deep, .video, .article]` → 全部 4、深度 2、影片 1、文章 1。
  - UI `testBookmarksFilterAndCounts`：收藏 deep、影片、一篇一般文章 → 「收藏」分頁副標題「3 篇 · 全部可離線閱讀」；「深度 1」段只剩 deep 那篇。
  - UI `testBookmarksAndReadSurviveRelaunch`：收藏一篇、標一篇已讀 → `app.terminate()` → 用 `reset: false` 重開 → 收藏還在、那篇還是已讀（R6、R7，§13）。
  - UI `testBookmarkedDeepOpensOffline`：收藏 deep → 重開，`fixture: .unreachable`、`reset: false` → 收藏分頁點它 → 「重點」「想一想」都在。
  - UI `testSwipeToRemoveBookmark`。
- [ ] **Step 2–4: 失敗 → 實作 → `unit`、`ui phone`、`ui duo` 全過。**截圖對照 S7。
- [ ] **Step 5: Commit** `git commit -m "Add the Bookmarks tab with filters"`

### Task 13: 離線、狀態提示、更新提示和自動更新時機

**Files:**
- Create: `ios/Jihchih/Day/StatusBannerView.swift`, `ios/Jihchih/Store/StoreProductView.swift`, `ios/Jihchih/Support/AppInfo.swift`
- Modify: `ios/Jihchih/Day/DayScreen.swift`, `ios/Jihchih/Day/TodayTab.swift`, `ios/Jihchih/JihchihApp.swift`
- Test: `ios/JihchihUITests/OfflineAndBannerTests.swift`

**決定：**
- 提示放在「今天」清單第一塊、分類標籤上面，一次一條（`store.banner`），樣式用系統的 `Label` 加 `.secondary` 底色區塊。`accessibilityIdentifier("banner.offline|stale|update")`。
- 完全沒有內容（`store.hasLoadFailure`）時整頁是 `ContentUnavailableView`：標題「連不上網路」、圖示 `wifi.slash`、說明「接上網路後再試一次。讀過一次以後，離線也能看上次的內容。」、按鈕「重試」（S10）。
- 更新時機（R12）：`start()` 在 App 啟動時；`scenePhase` 變成 `.active` 時呼叫 `refreshIfStale()`；下拉。
- 更新提示點了用 `SKStoreProductViewController`（`UIViewControllerRepresentable`，以 sheet 顯示）。`AppInfo.appStoreID: Int?` 先是 `nil`，上架清單要求建立 App 後填入；`nil` 時提示只顯示文字、不能點（寫進決策紀錄，並列入 release checklist）。

- [ ] **Step 1: 寫失敗的 UI 測試** `OfflineAndBannerTests`：
  - `testOfflineShowsCacheAndBanner`：先 `launch()` 一次（存快取）→ `terminate` → `launch(fixture: .unreachable, reset: false)` → 卡片還在，`banner.offline` 的文字是「離線中，顯示 11/18 09:01 更新的內容」。
  - `testNoCacheShowsRetry`：`launch(fixture: .unreachable)` → 「連不上網路」「重試」；點「重試」後畫面還在（不閃退）。
  - `testStaleBanner`：`launch(now: "2026-11-19T10:00:00+08:00")` → `banner.stale` 文字「今天的摘要還沒出來，這是 11月18日 的內容」。
  - `testUpdateBanner`：`launch(fixture: .needsUpdate)` → `banner.update` 文字「有新版 App，請更新」，內容照樣顯示。
- [ ] **Step 2–4: 失敗 → 實作 → `unit`、`ui phone`、`ui duo` 全過。**截圖對照 S10、S11。
- [ ] **Step 5: Commit** `git commit -m "Show cached content offline with status banners"`

### Task 14: 「設定」和「關於」

**Files:**
- Create: `ios/Jihchih/Settings/SettingsTab.swift`, `ios/Jihchih/Settings/AboutScreen.swift`, `ios/Jihchih/Support/SiteLinks.swift`
- Test: `ios/JihchihUITests/SettingsTests.swift`

**Interfaces / 決定：**
- `enum SiteLinks { static let digest = URL(string: "https://willy-notes.pages.dev/digest/")!; static let privacy = URL(string: "https://willy-notes.pages.dev/app/privacy")!; static let support = URL(string: "https://willy-notes.pages.dev/app/support")! }`
- `SettingsTab`：系統 `Form`，大標題「設定」。
  - 「閱讀」：「內文字級」列（右邊顯示目前那一級的名稱），下面 `Slider(0...3, step: 1)` 綁 `@AppStorage("textSize")`，兩端 `textformat.size.smaller`／`textformat.size.larger`；下面一段範例文字「每天早上幾分鐘，看完 AI 與 Apple 的新文章重點。」即時套用 `TextSizeLevel.adjusted`。「用閱讀器模式開原文」開關（`@AppStorage("readerMode")`，預設開）。
  - 「每日提醒」：開關和時間選擇器的位置先放好，Task 16 接上排程；這裡先綁 `@AppStorage("reminderOn")`（預設 `false`）和 `@AppStorage("reminderMinutes")`（預設 `570`）。關閉時時間選擇器 `.disabled(true)`。小字「由這支手機自己排程，打開時才會詢問通知權限。」
  - 「關於」：「關於日知」（推到 `AboutScreen`）、「資料來源」（Safari 開 `SiteLinks.digest`）、「隱私權政策」（`SiteLinks.privacy`）、「聯絡與支援」（`SiteLinks.support`）；區塊底下小字「摘要由 AI 整理，可能有錯，請以原文為準。金融相關內容不構成投資建議。」；最後一列「版本」顯示「1.0（1）」（從 Bundle 讀）。
- `AboutScreen`：說明日知是什麼、每天 09:00（台北時間）更新、四個分類、摘要是 AI 整理的導讀、全文請看原文、原文版權屬於各網站、金融內容不構成投資建議、聯絡信箱（`mailto:` 不行——會開「郵件」App；改成純文字顯示信箱並可長按複製，寫進決策紀錄）。
- 「設定」在寬螢幕單欄置中，最寬 640 pt。

- [ ] **Step 1: 寫失敗的 UI 測試** `SettingsTests`：
  - `testSettingsLinksStayInApp`：依序點「資料來源」「隱私權政策」「聯絡與支援」→ 每次都是 App 內 Safari，按「完成」回來。
  - `testAboutShowsDisclaimers`：「關於日知」頁含「可能有錯」「不構成投資建議」。
  - `testVersionRow`：「1.0（1）」存在。
  - `testTextSizeIsSharedWithReader`：在設定把滑桿拉到最右（label 變「特大」）→ 進 deep 詳情頁打開 Aa，「特大」是勾選的；在 Aa 選「小」→ 回設定，「內文字級」顯示「小」。
  - `testReaderModeDefaultsOn`：開關的 value 是 `1`。
  - `testReminderTimeDisabledWhenOff`：時間選擇器 `isEnabled == false`。
  - UI `AccessibilityTests`（新檔 `ios/JihchihUITests/AccessibilityTests.swift`，R14、§13「最大字級、深色模式、VoiceOver」）：
    - `testLargestTextSizeHasNoClippedText`：`launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]`，在今天、詳情、過去、收藏、設定各跑 `try app.performAccessibilityAudit(for: [.dynamicType, .textClipped])`。
    - `testDarkModeAudit`：`XCUIDevice.shared.appearance = .dark`，同五個畫面跑 `performAccessibilityAudit(for: [.contrast, .elementDetection, .hitRegion, .sufficientElementDescription])`；結束時切回 `.light`。
    - `testLightModeAudit`：同上，淺色。
    - 稽核抓到系統元件本身的問題（不是我們能改的）時，用 audit 的 issue handler 只略過那一條，並在決策紀錄寫明是哪一個元件。
- [ ] **Step 2–4: 失敗 → 實作 → `unit`、`ui phone`、`ui duo` 全過。**截圖對照 S8。
- [ ] **Step 5: Commit** `git commit -m "Add Settings and About"`

---

## 第四階段：影片、提醒、Widget

### Task 15: YouTube 嵌入播放器和退回

**Files:**
- Create: `ios/Jihchih/Video/VideoPlayerView.swift`, `ios/Jihchih/Video/YouTubeEmbed.swift`, `ios/Jihchih/Video/PlayerLinkPolicy.swift`
- Modify: `ios/Jihchih/Detail/ItemDetailScreen.swift`
- Test: `ios/JihchihTests/YouTubeEmbedTests.swift`, `ios/JihchihTests/PlayerLinkPolicyTests.swift`, `ios/JihchihUITests/VideoTests.swift`

**Interfaces / 決定：**
- `enum YouTubeEmbed`：
  - `static let baseURL = URL(string: "https://com.willywu.jihchih")!`（YouTube 要求 WebView 帶 Referer，值是小寫的 Bundle ID；用 `load(html:baseURL:)` 帶上）
  - `static func html(videoID: String) -> String`：載入 `https://www.youtube.com/iframe_api`，`new YT.Player` 用 `videoId`、`playerVars: {playsinline: 1, rel: 0, origin: "https://com.willywu.jihchih"}`，16:9 填滿。`onError` 時把 `location.href` 設成 `jihchih-player://error?code=<code>`；`onReady` 時設成 `jihchih-player://ready`。
  - `static func pageURL(videoID: String) -> URL`（`https://www.youtube.com/watch?v=<id>`）
- `enum PlayerEvent: Equatable { case ready; case failed(code: Int) }`
- `enum PlayerLinkDecision: Equatable { case allow; case cancel(PlayerEvent); case openInSafari(URL) }`
- `enum PlayerLinkPolicy { static func decide(url: URL, isMainFrame: Bool, isUserInitiatedNewWindow: Bool) -> PlayerLinkDecision }`：
  - `jihchih-player://ready` → `.cancel(.ready)`；`jihchih-player://error?code=150` → `.cancel(.failed(code: 150))`
  - 主框架的初始載入（`baseURL` 本身、`about:blank`）→ `.allow`
  - 子框架的 `youtube.com/embed/`、`youtube-nocookie.com`、`google.com`、`googlevideo.com`、`doubleclick.net`、`gstatic.com` 等播放器需要的 → `.allow`
  - 主框架要離開播放器頁，或要開新視窗（例如點 YouTube 標誌、影片標題）→ `.openInSafari(url)`（D11）
- `VideoPlayerView(videoID:)`：iOS 26 SwiftUI `WebView`，背後一個 `WebPage`，設定允許行內播放；`WebPage.NavigationDeciding` 用 `PlayerLinkPolicy`；`.openInSafari` 交給 `SafariPresenter`；收到 `.failed` 或 15 秒內沒有 `.ready` → 換成一句話「這支影片無法在 App 內播放，可以用下面的按鈕開啟影片頁面。」（`accessibilityIdentifier("player.fallback")`）。播放器 16:9，寬度跟內容一樣，至少 200×200 pt（YouTube 規定）。播放器上不疊任何東西。`accessibilityIdentifier("player.web")`。`LaunchOptions.playerForcedError` 有值時直接當成失敗（只在 DEBUG）。
- 影片詳情頁（S4）：播放器在最上面；「AI 開發方式 · 影片」、標題、來源；「這支影片在講什麼」區塊；底部「開啟影片頁面」（`.bordered` 次要樣式，`accessibilityIdentifier("detail.openVideo")`），用 Safari 開 `item.url`。沒有重點和想一想。

- [ ] **Step 1: 寫失敗的測試**：
  - `embedHTMLHasRequiredParameters`：含 `videoId: "9RKrSF9d2SE"`、`playsinline: 1`、`origin: "https://com.willywu.jihchih"`、`jihchih-player://error`。
  - `policyReportsReadyAndErrors`、`policyAllowsEmbedSubframes`、`policyOpensLogoClickInSafari`（主框架 `https://www.youtube.com/watch?v=9RKrSF9d2SE` → `.openInSafari`）、`policyOpensNewWindowInSafari`、`errorCodes101And150AreFailures`（都回 `.cancel(.failed)`）。
  - UI `testVideoDetailHasPlayerAndSummary`：點影片卡 → `player.web` 存在、「這支影片在講什麼」、`detail.openVideo` 存在、沒有「重點」。
  - UI `testEmbedFailureFallsBackToSafari`：`extraEnvironment: ["JC_PLAYER_FORCE_ERROR": "150"]` → `player.fallback` 出現；點「開啟影片頁面」→ App 內 Safari、App 在前景。
- [ ] **Step 2–4: 失敗 → 實作 → `unit`、`ui phone`、`ui duo` 全過。**
- [ ] **Step 5: 在模擬器實際播一次**（模擬器有網路）：開影片詳情頁、截圖確認播放器有出現 YouTube 畫面，不是錯誤 153。播不出來的話照 `docs/ios-app/decisions.md` 記下現象，並列入 release checklist 的實機確認項目（P6）。
- [ ] **Step 6: Commit** `git commit -m "Play YouTube videos in the app with a Safari fallback"`

### Task 16: 每日提醒

**Files:**
- Create: `ios/Jihchih/Reminder/ReminderScheduler.swift`, `ios/Jihchih/Reminder/NotificationRouting.swift`
- Modify: `ios/Jihchih/Settings/SettingsTab.swift`, `ios/Jihchih/JihchihApp.swift`
- Test: `ios/JihchihTests/ReminderSchedulerTests.swift`, `ios/JihchihUITests/ReminderTests.swift`

**Interfaces:**
- `protocol NotificationCentering: Sendable { func requestAuthorization() async throws -> Bool; func authorizationStatus() async -> UNAuthorizationStatus; func add(_ request: UNNotificationRequest) async throws; func removePendingNotificationRequests(withIdentifiers: [String]) }`；`UNUserNotificationCenter` 照這個介面包一層。
- `struct ReminderScheduler { static let identifier = "daily-reminder"; static let body = "看看今天的資訊摘要"; init(center: any NotificationCentering); func enable(minutes: Int) async -> ReminderResult; func reschedule(minutes: Int) async; func disable() }`；`enum ReminderResult { case scheduled, denied }`。觸發用 `UNCalendarNotificationTrigger(dateMatching: [hour, minute], repeats: true)`，用手機當地時間（提醒是給讀者自己的作息，寫進決策紀錄）。內容只有 `body`，沒有標題（系統會顯示 App 名稱「日知」，S13）。
- 設定頁：打開開關才問權限（R9）；`denied` 時開關回到關，下面顯示「通知權限已關閉。要使用每日提醒，請到 iPhone 的「設定」>「通知」>「日知」打開。」，沒有按鈕（D12）。改時間時重排。App 啟動時若 `reminderOn` 為真就重排一次。
- `NotificationRouting`：`UNUserNotificationCenterDelegate`，`didReceive` 時把 `AppRouter.tab` 設成 `.today`；`willPresent` 回傳 `[.banner, .list]`。
- `LaunchOptions.reminderTime`（DEBUG）在 `reset` 時寫進 `reminderMinutes`，讓 E2E 能把時間設成一分鐘後。

- [ ] **Step 1: 寫失敗的測試**：
  - `enableSchedulesDailyCalendarTrigger`：假的 center 收到一個 request，id `daily-reminder`，body「看看今天的資訊摘要」，trigger 是 `repeats == true` 的 `UNCalendarNotificationTrigger`，`hour == 9`、`minute == 30`（`minutes: 570`）。
  - `enableWhenDeniedReturnsDeniedAndSchedulesNothing`。
  - `disableRemovesPending`、`rescheduleReplacesTrigger`。
  - UI `testReminderDeniedTurnsSwitchOffWithExplanation`：`xcrun simctl privacy` 不能預設拒絕通知，所以在系統詢問時點「不允許」（用 springboard 的按鈕，中英文都試：`不允許`／`Don’t Allow`）→ 開關回到關、說明文字出現。
  - UI `testReminderFiresAndOpensToday`：`extraEnvironment: ["JC_REMINDER_TIME": <現在 + 1 分鐘，HH:mm>]`；打開開關、允許通知、切到「設定」以外的分頁再按 Home；等 springboard 出現「看看今天的資訊摘要」通知（最多 90 秒）；點通知 → App 在前景、「今天」分頁選中。
- [ ] **Step 2–4: 失敗 → 實作 → `unit`、`ui phone`、`ui duo` 全過。**（提醒測試每次重設模擬器的通知權限：`xcrun simctl privacy <id> reset all com.willywu.jihchih`，寫在 `test.sh ui` 開頭。）
- [ ] **Step 5: Commit** `git commit -m "Add the local daily reminder"`

### Task 17: Widget 和深層連結

**Files:**
- Create: `ios/Shared/Logic/DeepLink.swift`, `ios/Shared/Logic/WidgetContent.swift`, `ios/JihchihWidget/DigestWidget.swift`, `ios/JihchihWidget/DigestProvider.swift`, `ios/JihchihWidget/WidgetViews.swift`
- Modify: `ios/JihchihWidget/JihchihWidgetBundle.swift`, `ios/Jihchih/App/RootView.swift`（`.onOpenURL`）, `ios/Jihchih/App/AppRouter.swift`, `ios/Jihchih/Data/DigestStore.swift`（成功更新後 `WidgetCenter.shared.reloadAllTimelines()`）
- Test: `ios/JihchihTests/DeepLinkTests.swift`, `ios/JihchihTests/WidgetContentTests.swift`, `ios/JihchihUITests/DeepLinkTests.swift`

**Interfaces:**
- `enum DeepLink: Equatable { case today; case item(date: String, id: String); init?(url: URL); var url: URL }`：`jihchih://today`、`jihchih://item/2026-11-18/<id>`。
- `struct WidgetContent: Equatable { let date: String; let counts: [(label: String, count: Int)]（照分類順序）; let featured: FeaturedItem?; static func make(index: DigestIndex, day: DigestDay?) -> WidgetContent }`；`struct FeaturedItem: Equatable { let id: String; let label: String; let title: String; let summary: String? }`。`featured`：最新一天第一篇 deep；沒有 deep 時用 `industry` 的第一篇；都沒有是 `nil`。`label` 是「深度分析 · Simon Willison」或「AI 產業動態 · iThome」。
- `DigestProvider: TimelineProvider`：用 `DigestAPI` 抓 index 和最新一天，成功就寫進 `DigestCache.shared`；失敗讀快取；都沒有就顯示「打開日知看今天的摘要」。下次更新 `.after(now + 1 小時)`。`placeholder` 用固定的假內容。
- 小尺寸（S12）：「11/18 週三」，四類名稱和篇數，`widgetURL(DeepLink.today.url)`。中尺寸：標籤、標題、摘要（最多 2 行），`widgetURL(.item(...))`；沒有 `featured` 時回到 today。`containerBackground(.fill.tertiary, for: .widget)`。`supportedFamilies([.systemSmall, .systemMedium])`（D19）。
- App 收到連結：`AppRouter.handle(_ link: DeepLink)` → 切到「今天」、把那篇的類別設成目前分類、deep／video 推進詳情頁、article 用 App 內 Safari 開（跟點卡片一樣）。

- [ ] **Step 1: 寫失敗的測試**：
  - `deepLinkRoundTrips`、`deepLinkRejectsOtherSchemesAndShapes`（`https://…`、`jihchih://item/only-date` → `nil`）。
  - `widgetFeaturesFirstDeep`：真實 11/18 → `featured.title` 是 Datasette 那篇、`counts` 是 `[("AI 開發方式",2),("AI 產業動態",12),("iOS / Apple",0),("金融與虛擬資產",1)]`。
  - `widgetFallsBackToFirstIndustryItem`：11/17（沒有 deep）→ `featured.label` 以「AI 產業動態 · 」開頭。
  - UI `testWidgetLinkOpensDeepItem`：先 `launch()`，再 `app.open(URL(string: "jihchih://item/2026-11-18/<deep id>")!)` → 詳情頁「一句話摘要」出現、App 在前景。
  - UI `testWidgetLinkOpensToday`：先切到「設定」，`app.open(jihchih://today)` → 「今天」選中。
  - UI `StayInAppTests.testEveryTappableStaysInApp`（§13 第 5 條的清單）：依序點過——四個分頁、四個分類標籤、「下一類」、每種卡片（deep、影片、一般）、卡片書籤、長按選單三項、滑動按鈕（收藏、分享後關掉分享面板）、詳情頁的 Aa、收藏、分享、延伸閱讀、下一篇、閱讀原文、開啟影片頁面、狀態提示、過去的日期列、收藏的篩選和卡片、設定的每一列和開關、兩個深層連結。每點一次都斷言 `app.state == .runningForeground`，而且 Safari、YouTube、App Store、設定這幾個 App 都不在前景（`com.apple.mobilesafari`、`com.google.ios.youtube`、`com.apple.AppStore`、`com.apple.Preferences`）。清單同時寫進 `docs/ios-app/acceptance.md`。
- [ ] **Step 2–4: 失敗 → 實作 → `unit`、`ui phone`、`ui duo` 全過。**
- [ ] **Step 5: 在模擬器的主畫面放小、中兩個 Widget**（用 iOS Simulator 工具長按主畫面加入），截圖存到 `docs/ios-app/evidence/widget.png`；點中尺寸 Widget 會打開那篇文章。
- [ ] **Step 6: Commit** `git commit -m "Add the home screen widget and deep links"`

### Task 18（控制者執行）: 第四階段收尾的基準截圖

- [ ] 在 Jihchih 17 Pro Max 截下「今天」、詳情、影片、過去、收藏、設定的畫面（淺色），存在 scratchpad 當成「加入 Duo 之前」的基準，Task 20 完成後重拍比對（§13「一般 iPhone 上的畫面，跟加入 Duo 之前一樣」）。

---

## 第五階段：iPhone Duo

### Task 19: 依寬度切兩欄、摺線、開闔接續

**Files:**
- Create: `ios/Jihchih/Layout/AdaptiveColumns.swift`, `ios/Jihchih/Layout/TwoPaneLayout.swift`, `ios/Jihchih/Layout/FoldGuide.swift`
- Modify: `ios/Jihchih/Day/DayNavigation.swift`, `ios/Jihchih/Day/TodayTab.swift`, `ios/Jihchih/Day/DayScreen.swift`, `ios/Jihchih/Past/PastTab.swift`, `ios/Jihchih/Bookmarks/BookmarksTab.swift`, `ios/Jihchih/Detail/ItemDetailScreen.swift`
- Test: `ios/JihchihTests/AdaptiveColumnsTests.swift`, `ios/JihchihTests/DayNavigationTests.swift`

**Interfaces / 決定：**
- `enum AdaptiveColumns { static let twoColumnMinWidth: CGFloat = 700; static func isTwoColumn(width: CGFloat) -> Bool }`（D16，看寬度，不看機型和方向）。
- `TwoPaneLayout<Primary, Secondary>`：寬度 ≥ 700 時兩欄。iOS 27.1 以上先試 `ArrangementView { primary } secondary: { secondary }.arrangementViewStyle(.split)`；如果它不在摺線分開，或在非 Duo 的寬畫面（一般 iPhone 橫拿）表現不對，就改用 `HStack`：分界取 `GeometryProxy.reservedRegions(kind: .division)` 的 `frame.midX`（iOS 27.1+），拿不到時用寬度的一半。兩欄中間是系統 `Divider`。實際選哪個寫進決策紀錄（§13.6 留給實作者決定）。
- `FoldGuide`：只在 DEBUG，把 `.division` 區域做成一個隱形的無障礙元素（`accessibilityIdentifier("debug.fold")`），讓 UI 測試檢查有沒有元素跨過摺線。
- `DayNavigation` 加上：`selection: ItemRoute?`、`isAutoSelected: Bool`、`autoSelectionTouched: Bool`、`detailScrollOffset: CGFloat`，以及兩個轉換：
  - `func didBecomeTwoColumn(firstItem: ItemRoute?)`：`path` 有文章 → `selection = path.last`、`isAutoSelected = false`、`path = []`；沒有 → `selection = firstItem`、`isAutoSelected = true`、`autoSelectionTouched = false`。
  - `func didBecomeSingleColumn()`：`selection` 是讀者自己點的，或自動顯示但碰過（點過或捲過）→ `path = [selection]`；自動顯示且沒碰過 → `path = []`。之後 `selection = nil`。
  - `func select(_ route: ItemRoute)`（讀者點的，`isAutoSelected = false`）；`func touchAutoSelection()`（捲動或點右欄時呼叫，標為已讀）。
  - 切換分類時，兩欄模式下 `selection` 換成新分類的第一篇（自動）。
- 兩欄時：左欄是同一個列表（同一個 `List`，捲動位置保留在 `scrolledItemID`），目前那篇卡片加 2 pt 強調色外框（S15）；右欄是 `ItemDetailScreen`，一般文章也顯示在右邊（D15，用 Task 8 的一般文章版面）。自動顯示的那篇不標為已讀，讀者點了或捲了才標（R16）。
- 右欄詳情頁的捲動位置存在 `detailScrollOffset`，開闔換版面後用 `ScrollPosition` 捲回去（R16「讀到哪裡就在哪裡」）。
- 「過去」兩欄：左欄先是日期列表，點日期後左欄推進那一天的文章列表（同一個 `NavigationStack`），右欄顯示文章。「收藏」：左欄清單、右欄文章。「設定」：單欄置中，最寬 640 pt。
- 單欄時內文置中、最寬 640 pt（已在 Task 7 做好）。
- Safari 畫面、選單、分享面板開著時開闔不做任何處理（R16，由系統調整）。影片播放中開闔：右欄和詳情頁用同一個 `VideoPlayerView` 身分（`id(videoID)`）盡量不重建；做不到不中斷時，至少同一支影片還在。

- [ ] **Step 1: 寫失敗的測試**：
  - `twoColumnThreshold`：699 → false、700 → true、669 → false（展開後轉直）、951 → true、466、678 → false。
  - `becomingTwoColumnWithOpenArticleKeepsIt`、`becomingTwoColumnFromListAutoSelectsFirst`、`foldingWithUntouchedAutoSelectionShowsList`、`foldingWithTouchedAutoSelectionKeepsArticle`、`foldingWithUserSelectionPushesIt`。
- [ ] **Step 2–4: 失敗 → 實作 → `unit`、`ui phone`、`ui duo`（闔上狀態）全過。**一般 iPhone 的 UI 測試一條都不能改壞。
- [ ] **Step 5: Commit** `git commit -m "Add the two-column layout for wide windows and iPhone Duo"`

### Task 20: iPhone Duo 的 E2E 和姿態確認

**Files:**
- Create: `ios/JihchihUITests/Duo/DuoTestSupport.swift`, `ios/JihchihUITests/Duo/DuoClosedTests.swift`, `ios/JihchihUITests/Duo/DuoOpenTests.swift`, `ios/JihchihUITests/Duo/DuoTransitionTests.swift`, `docs/ios-app/evidence/duo/`（截圖）
- Modify: `ios/scripts/test.sh`（加 `duo-open`、`duo-interactive`）

**做法：** XCUIDevice 沒有開闔的 API（`XCUIAutomation.framework/Headers/XCUIDevice.h` 只有方向、外觀、按鈕），`simctl` 也沒有（只有 `io screenConfig`）。開闔由控制者用 iOS Simulator 工具的 `duo_pose`（closed／open／half_open）切換，測試本身判斷目前姿態並斷言：
- `DuoTestSupport`：`isDuo`（`UIDevice` 型號名稱或視窗大小 466×678／951×669 判斷）；`windowWidth(app)`；`waitForWidth(app, where:, timeout:)`；`assertNothingCrossesFold(app)`：所有可點元素和文字的 frame 都不跨過 `debug.fold` 的 frame。
- `DuoClosedTests`（寬度 < 700 且是 Duo 才跑，否則 `XCTSkip`）：直拿、橫拿（`XCUIDevice.shared.orientation = .landscapeLeft`，仍是單欄）都能點進文章、返回、切分類；截圖。
- `DuoOpenTests`（寬度 ≥ 700 才跑）：
  - `testTwoColumnsWithFirstItemAutoShown`：左欄列表、右欄是目前分類第一篇；那篇沒有被標為已讀（圓環「已讀 0 篇」）。
  - `testEveryKindShowsOnTheRight`：點一般文章 → 右欄出現標題、摘要、「閱讀原文」，沒有跳出 Safari；點「閱讀原文」才開 Safari（App 內）。
  - `testSelectionIsOutlined`：目前那張卡的 `accessibilityValue` 是「目前顯示」。
  - `testNothingCrossesTheFold`：今天、詳情、過去、收藏、設定都檢查。
  - `testPastAndBookmarksUseTwoColumns`、`testSettingsIsSingleCentered`。
  - `testRotatedUnfoldedIsSingleColumn`：轉成直的（`.portrait`，669 pt）→ 單欄、內文寬度 ≤ 640；轉回來 → 兩欄。
- `DuoTransitionTests`（只有 `TEST_RUNNER_JC_DUO_INTERACTIVE=1` 才跑；每個測試開頭印 `DUO-STEP: <要做的事>` 並等寬度變化最多 120 秒，控制者看到後用 `duo_pose` 開闔）：
  - `testUnfoldWhileOnListAutoShowsFirst`、`testUnfoldWhileReadingKeepsArticleAndPosition`（展開後右欄是同一篇，捲動位置差不到 40 pt，左欄那張有外框）、`testFoldAfterUserSelectionShowsArticle`、`testFoldWithUntouchedAutoSelectionShowsList`、`testCategoryAndListScrollSurviveFolding`。
  - 並排：控制者用 iOS Simulator 工具從底部把另一個 App（例如「設定」）拖到旁邊，測試 `testSideBySideIsSingleColumnAndUsable` 等到寬度約一半時，確認單欄、能進文章、能返回。做不到時改用手動截圖並寫進決策紀錄。
- 規格 §13.5 還沒確認的事（Safari 畫面在內螢幕、分頁列在外螢幕的位置、YouTube 開闔會不會中斷、App Store 要不要交 Duo 截圖）逐條截圖或記錄結果，寫進決策紀錄。

- [ ] **Step 1: 寫測試**（上面四個檔案）。
- [ ] **Step 2: 闔上狀態跑 `test.sh ui duo`**：一般測試和 `DuoClosedTests` 全過，`DuoOpenTests` 全部 skip。
- [ ] **Step 3: 控制者 `duo_pose open` 後跑 `test.sh duo-open`**（只跑 `JihchihUITests/DuoOpenTests`）：全過。
- [ ] **Step 4: 跑 `test.sh duo-interactive`**，控制者照 `DUO-STEP` 開闔：全過。
- [ ] **Step 5: 回到一般 iPhone 跑 `test.sh ui phone`**，並重拍 Task 18 的基準畫面比對，差異只在測試時間造成的內容（應該沒有差異）。
- [ ] **Step 6: Commit** `git commit -m "Verify iPhone Duo postures and fold continuity"`

---

## 第六階段：上架準備

### Task 21: 隱私清單、圖示、上架前檢查

**Files:**
- Create: `ios/Jihchih/PrivacyInfo.xcprivacy`, `ios/JihchihWidget/PrivacyInfo.xcprivacy`, `ios/scripts/make-icon.swift`, `ios/Jihchih/Assets.xcassets/AppIcon.appiconset/{Contents.json, AppIcon-Light.png, AppIcon-Dark.png, AppIcon-Tinted.png}`, `ios/JihchihTests/ReleaseConfigurationTests.swift`

**決定：**
- 兩份隱私清單：`NSPrivacyTracking = false`、`NSPrivacyTrackingDomains = []`、`NSPrivacyCollectedDataTypes = []`；`NSPrivacyAccessedAPITypes`：`NSPrivacyAccessedAPICategoryUserDefaults` 理由 `CA92.1`，`NSPrivacyAccessedAPICategoryFileTimestamp` 理由 `C617.1`（§9）。
- 圖示（P5）：1024×1024，藍底 `#3B5BDB`、白色「日」字外框（直立的圓角長方形外框）、中間一橫 `#FFD43B`；深色版底 `#14161F`、外框 `#8AA0F2`、中間一橫照樣黃色；單色版灰階（系統會染色）。`make-icon.swift` 用 CoreGraphics 畫，`swift ios/scripts/make-icon.swift ios/Jihchih/Assets.xcassets/AppIcon.appiconset` 產生三個 PNG；`Contents.json` 用單一尺寸 1024 的 universal iOS 圖示，加 `luminosity: dark` 和 `tinted` 兩個 appearance。
- `ReleaseConfigurationTests`（讀 App 的 `Bundle.main`）：`CFBundleDisplayName == "日知"`、`CFBundleIdentifier == "com.willywu.jihchih"`、`ITSAppUsesNonExemptEncryption == false`、`CFBundleShortVersionString == "1.0"`、`PrivacyInfo.xcprivacy` 在 bundle 裡且能讀出兩個 API 類別；`UIApplication.shared.open` 在專案原始碼裡出現 0 次（用 `#filePath` 找到 `ios/` 掃 `.swift`）。

- [ ] **Step 1: 寫 `ReleaseConfigurationTests`**，跑 `test.sh unit` 確認隱私清單那條失敗。
- [ ] **Step 2: 加兩份隱私清單、產生圖示**，跑 `test.sh unit` 通過；`test.sh release` 成功，並用 `plutil -p` 確認 Release 產物 `Jihchih.app` 和 `PlugIns/JihchihWidget.appex` 都有 `PrivacyInfo.xcprivacy`，`Assets.car` 裡有 AppIcon（`xcrun assetutil --info`）。
- [ ] **Step 3: 跑 app-store-preflight-skills 掃一次**，有問題就修，結果寫進決策紀錄。
- [ ] **Step 4: 在模擬器主畫面截圖**淺色、深色、單色圖示（`xcrun simctl ui` 切外觀；單色在主畫面「自訂」裡選「染色」），存到 `docs/ios-app/evidence/icon-*.png`。
- [ ] **Step 5: Commit** `git commit -m "Add privacy manifests and the app icon"`

### Task 22: 截圖、App Store 頁面草稿、上架清單、驗收紀錄

**Files:**
- Create: `ios/JihchihUITests/ScreenshotTests.swift`, `docs/ios-app/screenshots/*.png`, `docs/ios-app/app-store-listing.md`, `docs/ios-app/release-checklist.md`, `docs/ios-app/acceptance.md`

- [ ] **Step 1: 截圖**：`ScreenshotTests` 只在 `TEST_RUNNER_JC_SCREENSHOT_DIR` 有值時跑，依序存成 PNG：`01-today.png`（今天 · AI 開發方式）、`02-deep.png`（深度分析詳情）、`03-video.png`（影片詳情，用 `JC_PLAYER_FORCE_ERROR` 以外的正常狀態；播放器載不到時改用不含播放器的畫面並記錄）、`04-industry.png`（AI 產業動態、有已讀和收藏）、`05-past.png`、`06-bookmarks.png`、`07-settings.png`。在 Jihchih 17 Pro Max 上先 `xcrun simctl status_bar <id> override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`。確認每張是 1320×2868（`sips -g pixelWidth -g pixelHeight`）。
- [ ] **Step 2: `app-store-listing.md`**（規格 §10）：名稱「日知」（備案「日知 · AI 摘要」）、副標題（30 字元內）、描述（這是什麼、每天 09:00 台北時間更新、四個分類、AI 整理的摘要和導讀、閱讀全文會打開原文網站、離線、收藏、提醒、Widget）、關鍵字（100 字元內，逗號分隔，附字元數）、類別「新聞」、支援網址、隱私權政策網址、App 隱私標示「不收集資料」、年齡分級的建議、給審查人員的備註（每天 09:00 更新、不需要帳號、X 要登入但不是必要功能、摘要是用自己的話寫的導讀、影片用 YouTube 官方嵌入播放器）、截圖清單。用 speak-human-tw skill 去一次 AI 味。
- [ ] **Step 3: `release-checklist.md`**：讓使用者照著做就能送審，順序是：
  1. P1 加入 Apple Developer Program（個人或組織的差別）。
  2. 在 Certificates, Identifiers & Profiles 建 App ID `com.willywu.jihchih`（勾 App Groups）、`com.willywu.jihchih.widget`（勾 App Groups）、App Group `group.com.willywu.jihchih`。
  3. App Store Connect 建立 App（名稱「日知」被用掉時用備案）、主要語言繁體中文、Bundle ID、SKU；把 App 的 Apple ID 填進 `ios/Jihchih/Support/AppInfo.swift` 的 `appStoreID`。
  4. Xcode 的 Signing & Capabilities 選自己的 Team（兩個 target），或在 `project.pbxproj` 填 `DEVELOPMENT_TEAM`。
  5. Archive、Validate、上傳（Xcode Organizer，或 asc 指令）。
  6. TestFlight：內部測試、加同事。
  7. P6 實機確認：YouTube 能播（沒有錯誤 153）、開闔時影片會不會中斷、摺線手感、Safari 畫面在內螢幕的樣子、Widget、提醒準時、飛航模式。
  8. App 資訊：類別新聞、隱私權政策網址、App 隱私標示「不收集資料」、P7 年齡分級（兩種答法和結果：答「不受限制的網頁瀏覽：是」→ 16+；答「否」→ 依其他題目，預計 4+；附上建議和理由）、價格免費、地區全選後取消中國大陸（P4）。
  9. 版本頁：截圖（`docs/ios-app/screenshots/`）、描述、關鍵字、支援網址、給審查人員的備註（從 `app-store-listing.md` 複製）、出口合規（已在 Info.plist 設 `ITSAppUsesNonExemptEncryption = NO`）。
  10. 送審；被退件的處理方式。
  11. P8 第三方內容授權要決定的事、P9 流程要不要搬到雲端的提醒。
  12. 還沒確認的事：App Store 要不要另外交 iPhone Duo 截圖（Duo 外螢幕 1398×2034、內螢幕 2007×2853；送審前看 App Store Connect 有沒有要求）。
  以及 Simulator 工具的 App Resizability skill 匯出指令沒有執行（需要使用者自己同意），附上指令。
- [ ] **Step 4: `acceptance.md`**：規格 §13 每一條一列：項目、證據（測試名稱和結果、截圖路徑、指令輸出）、狀態（通過／需要實機或 Apple 帳號，列在 release checklist 第幾步）。
- [ ] **Step 5: Commit** `git commit -m "Add screenshots, the App Store listing draft and the release checklist"`

### Task 23（控制者執行）: 全部驗證、整體審查、合併

- [ ] 跑 `npm test`、`ios/scripts/test.sh all`、`duo-open`、`duo-interactive`，數字寫進 `acceptance.md`。
- [ ] 派一個審查 subagent 看整個分支（對照規格書）。修完再跑一次全部測試。
- [ ] `git -C /Users/twinb00589136/Developer/willy-notes merge --ff-only claude/rizhi-ios-app-270120`（main 往前走了就先 rebase 本分支），在主資料夾跑 `npm test`。
- [ ] 用繁體中文回報：做了什麼、測試數字、決策紀錄重點、使用者要做的事。
