// Build the 日知 app's privacy policy and support pages into public/app/.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { layout } from "./blog-lib.mjs";

const EMAIL = "willy.xcoder@gmail.com";
const MAIL = `<a href="mailto:${EMAIL}">${EMAIL}</a>`;
const UPDATED = "2026-11-18";

const page = (title, heading, inner) => layout(title, `<div class="wrap"><article>
<h1 class="title">${heading}</h1>
<div class="meta"><span>最後更新：${UPDATED}</span></div>
<div class="body">
${inner}
</div>
</article></div>`);

export function renderPrivacy() {
  return page("日知 隱私權政策 · willy-notes", "日知 隱私權政策", `<p>日知是一個每天整理 AI 與科技文章摘要的 App。以下說明它如何處理你的資料。</p>
<h2>不收集資料</h2>
<p>日知不收集任何個人資料。沒有帳號，不追蹤你，也沒有分析工具和廣告。</p>
<h2>App 連到哪裡</h2>
<p>App 只會連到 willy-notes.pages.dev，取得每天的摘要內容。摘要裡的原文和影片，由各自的網站提供，你點開時會在 App 內的 Safari 畫面中載入，資料如何處理依該網站的規定。</p>
<h2>存在手機裡的東西</h2>
<p>收藏、已讀狀態和設定只存在你的手機本機，不會上傳。</p>
<p>每日提醒是排程在手機本機的通知，不經過任何伺服器。</p>
<h2>影片</h2>
<p>影片使用 YouTube 的嵌入播放器播放。播放時 YouTube 和 Google 可能依照他們的隱私權政策收集資料，詳見 <a href="https://policies.google.com/privacy">Google 隱私權政策</a>。</p>
<h2>聯絡我</h2>
<p>有任何問題，請寄信到 ${MAIL}。</p>`);
}

export function renderSupport() {
  return page("日知 支援 · willy-notes", "日知 支援", `<p>使用上遇到問題，或有任何建議，請寄信到 ${MAIL}。</p>
<h2>常見問題</h2>
<h3>X（Twitter）的文章打不開，要我登入？</h3>
<p>X 的內容需要登入才能看。App 內的 Safari 畫面和手機上的 Safari 是分開的，所以要在 App 裡登入一次 X，之後就會記住。</p>
<h3>影片不能播放？</h3>
<p>有些影片的擁有者關閉了嵌入播放，App 裡就播不了。請點「開啟影片頁面」，到 YouTube 觀看。</p>
<h3>內容沒有更新？</h3>
<p>摘要每天 09:00（台北時間）更新。整理工作是在作者自己的電腦上執行，所以偶爾會晚一點。今天的摘要還沒出來時，App 會顯示「今天的摘要還沒出來」和日期，同時保留前一天的內容給你看。</p>`);
}

export function buildAppPages(outDir = "public/app") {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "privacy.html"), renderPrivacy());
  writeFileSync(join(outDir, "support.html"), renderSupport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildAppPages();
  console.log("built app pages");
}
