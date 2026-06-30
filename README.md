# WWDC26 開發者筆記

一個把 WWDC session 自動整理成可瀏覽筆記、並讓團隊標記與認領的站台。

- **瀏覽公開**:任何人(不登入)都能看全部 session、篩選、搜尋。
- **個人標記(跨裝置)**:用 Google 登入後,星號標記只屬於你,換手機也記得。
- **團隊認領(共享)**:認領一場後,所有人都看得到誰負責,避免重複。
- 全部跑在 Cloudflare 免費額度內(Pages + Functions + KV + Google 登入)。

---

## 架構

```
Apple WWDC 頁面 ──► scripts/fetch.ts ──► .cache/raw/*.json
（含逐字稿 transcript）                        │
                          scripts/summarize.ts (呼叫 Claude)
                                              │
                                   public/data/sessions.json
                                              │
                       scripts/build-details.mjs
                                              │
                                   public/s/{id}.html（每場詳解頁）
                                              │
        Cloudflare Pages ── 靜態站(public/) + Functions(functions/api/*)
                                              │
                              Workers KV ── interest:{email}（個人）
                                          └─ claimed（團隊共享)
```

- 認證做在 **Function 裡**(app 層 Google OIDC),不依賴 Cloudflare Access — 所以放在 `*.pages.dev` 上也能跑,且跟公司網域 / 白名單脫鉤。
- 瀏覽不需登入;只有「寫入」(標記 / 認領)會在第一次觸發 Google 一次性登入。

---

## 先備

- Node 18+(腳本用)
- 一個 Cloudflare 帳號(免費)
- 一個 Google Cloud 專案(免費,用來開 OAuth client)

```bash
npm install
```

範例資料已附在 `public/data/sessions.json`(3 場),所以還沒跑 pipeline 也能先部署看效果。

---

## 一、產生筆記(可先跳過)

```bash
# 抓取所有 session 原料到 .cache/raw/（含逐字稿 transcript；增量,跑過的會跳過）
npm run fetch

# 用 Claude 摘要成 public/data/sessions.json（增量）
ANTHROPIC_API_KEY=sk-ant-... npm run summarize

# 兩步一起
ANTHROPIC_API_KEY=sk-ant-... npm run notes

# 產生每場詳解頁 public/s/{id}.html（資料變更後重跑）
node scripts/build-details.mjs
```

- 想省錢把 `SUMMARY_MODEL=claude-haiku-4-5-20251001` 加在前面即可。
- `scripts/fetch.ts` 的解析是針對目前 Apple 頁面結構寫的;若某欄位抓不到,調整檔案裡的 regex 即可。

### sessions.json 每場的欄位

`summarize.ts` 會請 Claude 依逐字稿產出固定 schema。除了基本欄位(`gloss` / `category` / `takeaway` / `points` / `apis` / `audience`,及對應的 `_en` 英文版),還包含兩個閱讀用欄位:

- **`summary`** — 2–4 段連貫敘述的「整場整理」,可獨立閱讀並一鍵分享給同事(詳解頁上方有「複製分享」按鈕)。
- **`deepdive`** — 逐章節分析,每筆 `{ t, title, body }` 對齊該場 `chapters`(無章節的 Keynote / Lab / Daily 為空陣列)。

兩者各有英文版 `summary_en` / `deepdive_en`;詳解頁切到 EN 時優先用英文,缺漏時回退中文。`deepdive` 必須與 `chapters` 的 `t`/`title` 完全對齊,所以 `build-details.mjs` 之前若 Apple 更新了章節,記得先重跑 `npm run fetch`(清 `.cache/raw` 重抓)讓兩者一致。

## 二、建立 Google OAuth client

1. 到 Google Cloud Console → APIs & Services → **Credentials** → Create Credentials → **OAuth client ID** → Application type: **Web application**。
2. **Authorized redirect URIs** 先填你的 pages.dev callback(部署後拿到網址再回來補也行):
   `https://<你的專案>.pages.dev/api/auth/callback`
3. 記下 **Client ID** 與 **Client secret**。

## 三、建立 KV namespace

```bash
npx wrangler kv namespace create NOTES_KV
```

把回傳的 `id` 貼進 `wrangler.toml` 的 `[[kv_namespaces]]`。

## 四、部署

兩條路,擇一:

**A. Cloudflare Pages Git 整合(最簡單,建議)**
1. 把這個 repo 推到你自己的 GitHub。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → 連結這個 repo。
3. Build 設定:Build command 留空,**Build output directory = `public`**。
4. 之後每次 `git push` 自動部署。

**B. 直接用 Wrangler**
```bash
npm run deploy
```

## 五、設定環境變數 / 綁定

在 Pages 專案 → **Settings**:

- **Environment variables**(把後兩個設為 Secret/加密):
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`(Secret)
  - `SESSION_SECRET`(Secret,隨機長字串:`openssl rand -base64 32`)
  - `ALLOWED_EMAIL_DOMAIN`(選填,例如 `cdcoverseas.com`,限制只有該網域能登入)
- **Functions → KV namespace bindings**:`NOTES_KV` → 你剛建立的 namespace(走 Git 整合部署時需在這裡綁;用 `wrangler` 部署則讀 `wrangler.toml`)。

設定 / 命令列方式也行:
```bash
npx wrangler pages secret put GOOGLE_CLIENT_SECRET
npx wrangler pages secret put SESSION_SECRET
```

部署拿到正式 `*.pages.dev` 網址後,記得回 Google OAuth client 把 **redirect URI** 對齊,再重部署一次。

---

## 本機開發

```bash
# 把 secrets 放進 .dev.vars（已被 gitignore）
cat > .dev.vars <<'EOF'
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
EOF

npm run dev   # wrangler pages dev，本機同時跑 Functions
```
本機 callback 用 `http://localhost:8788/api/auth/callback`,記得也加進 Google 的 redirect URIs。

---

## 檔案結構

```
public/
  index.html              前端(瀏覽 / 篩選 / 標記 / 認領)
  data/sessions.json      筆記資料(pipeline 產出;含 summary / deepdive 與 _en 英文版)
  s/{id}.html             每場詳解頁(build-details.mjs 產出)
  s/detail.js, detail.css 詳解頁共用渲染與樣式
functions/api/
  me.ts                   目前登入者
  interest.ts             個人標記(GET/POST,需登入)
  claimed.ts              團隊認領(GET 公開 / POST 需登入)
  auth/login.ts           轉去 Google
  auth/callback.ts        交換 code、簽 session cookie
  auth/logout.ts          清除 session
lib/auth.ts               session JWT、cookie、Google id_token 解碼
scripts/
  fetch.ts                抓 Apple 頁面(含逐字稿)
  summarize.ts            呼叫 Claude 產 schema(含 summary / deepdive)
  build-details.mjs       由 sessions.json 產每場詳解頁 public/s/{id}.html
wrangler.toml             Pages 輸出 + KV 綁定
```
