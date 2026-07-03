# 交接給 Claude Code:把 WWDC26 筆記站部署上線

把這份檔案丟進專案資料夾,在裡面開 Claude Code,跟它說:「依照這份文件把站台部署到我的 Cloudflare + GitHub」。

---

## 背景(你不必重問我)

一個 WWDC session 筆記站,要求如下,**程式碼已經寫好在這個 repo 裡,不要重寫,只要接線 + 部署**:

- **瀏覽公開**:不登入就能看全部 session、篩選、搜尋。
- **個人標記(跨裝置)**:Google 登入後,星號只屬於該使用者,跨裝置同步。存在 KV 的 `interest:{email}`。
- **團隊認領(共享)**:認領一場後所有人都看得到誰負責。存在 KV 的 `claimed` 單一 key。
- **認證做在 Function 裡**(app 層 Google OIDC,`functions/api/auth/*`),**不要**用 Cloudflare Access。要能直接跑在 `*.pages.dev`、跟公司網域脫鉤。
- 全部跑在 Cloudflare 免費額度內(Pages + Functions + KV)。

技術棧:Cloudflare Pages(靜態 `public/` + Functions `functions/`)、Workers KV、Google OAuth。Repo 結構與檔案見 `README.md`。

---

## 前置(這些是「我(人類)」要先做的,Claude Code 請提示我完成)

1. `gh auth login` — 登入 GitHub CLI。
2. `wrangler login` — 登入 Cloudflare(會開瀏覽器)。
3. 準備一組 Anthropic API key(產生筆記用),等下用環境變數帶。
4. 確認已登入 Google Cloud Console(等下建 OAuth client)。

---

## Claude Code 可自動執行的步驟

> 用我的目錄為工作目錄。每一步做完回報結果,卡住就停下來問我。

### 1. 安裝 & 建 GitHub repo
```bash
npm install
gh repo create willy-notes --private --source=. --remote=origin --push
```
(repo 設 private 沒關係——站台是否公開由程式決定,跟 repo 可見性無關。)

### 2. 建 Cloudflare KV namespace,並把 id 寫回 wrangler.toml
```bash
npx wrangler kv namespace create NOTES_KV
```
把回傳的 `id` 取代 `wrangler.toml` 裡的 `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`。
(若 wrangler 版本較舊,指令是 `wrangler kv:namespace create NOTES_KV`。)

### 3. 第一次部署,取得 pages.dev 網址
```bash
npx wrangler pages project create willy-notes --production-branch main
npx wrangler pages deploy public --project-name willy-notes
```
記下輸出的 `https://willy-notes-xxx.pages.dev`(下一步要用)。

### 4.（這一步停下來,交給我做)建 Google OAuth client
Claude Code 請把以下指示列給我,等我貼回 Client ID 與 Client secret:

> 到 Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID
> - Application type:**Web application**
> - Authorized redirect URIs(兩個都加):
>   - `https://<上一步的 pages.dev 網址>/api/auth/callback`
>   - `http://localhost:8788/api/auth/callback`(本機開發用)
> - 建立後複製 **Client ID** 與 **Client secret**

### 5. 設定 Pages 環境變數(用我貼回的值)
```bash
npx wrangler pages secret put GOOGLE_CLIENT_ID     --project-name willy-notes
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name willy-notes
# SESSION_SECRET 用隨機值:
openssl rand -base64 32 | npx wrangler pages secret put SESSION_SECRET --project-name willy-notes
# 選填:限制只有公司網域能登入
# echo "cdcoverseas.com" | npx wrangler pages secret put ALLOWED_EMAIL_DOMAIN --project-name willy-notes
```
KV 綁定靠 `wrangler.toml` 的 `[[kv_namespaces]]`,不需在 dashboard 另設。

### 6. 重新部署讓 secret + KV 生效
```bash
npx wrangler pages deploy public --project-name willy-notes
```

### 7. 產生全部 session 的筆記(先小量試跑,確認解析 OK 再整批)
```bash
# 先只抓幾場、確認 fetch.ts 解析正常(看 .cache/raw/ 內容)
npm run fetch
# 內容沒問題後,整批摘要(會用我的 Anthropic 額度)
ANTHROPIC_API_KEY=sk-ant-... npm run notes
# 想省錢:前面加 SUMMARY_MODEL=claude-haiku-4-5-20251001
```
若 `fetch.ts` 某些欄位抓不到(Apple 改版),調整該檔的 regex 後重跑。

### 8. 提交並部署最終版
```bash
git add public/data/sessions.json wrangler.toml
git commit -m "Add full WWDC26 sessions + KV id"
git push
npx wrangler pages deploy public --project-name willy-notes
```

---

## 驗收(請幫我逐項確認)

- [ ] 開 pages.dev 網址,**不登入**就能看到 session 列表、能篩選 / 搜尋。
- [ ] 按「標記」→ 跳 Google 登入 → 星號亮起;**重新整理仍在**;用手機開同一帳號也看得到。
- [ ] 按「認領」→ 顯示我的名字;換另一個帳號登入,看得到「○○ 認領中」。
- [ ] `公開瀏覽` 與 `寫入需登入` 兩件事是分開的(登出後仍能瀏覽)。
- [ ] sessions.json 是全部場次,不是只有 3 場範例。

## 注意

- `claimed` 用單一 KV key,10 人併發沒問題;若要更嚴謹再拆成 `claimed:{id}`。
- 部署後若改用自有網域,記得回 Google OAuth client 把該網域的 `/api/auth/callback` 加進 redirect URIs。
