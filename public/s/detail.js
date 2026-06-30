// Renders one session detail page from the embedded JSON island. Shared by every /s/{id}.html.
const D = JSON.parse(document.getElementById("d").textContent);
const s = D.s, related = D.related || [];

const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const md = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const fmt = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
const CAT_EN = { swift: "Swift", uikit: "UIKit", swiftui: "SwiftUI", testing: "Testing", ai: "AI & ML", design: "Design", appstore: "App Store", graphics: "Graphics & Games", visionos: "visionOS", other: "Other" };
const TT = {
  zh: { back: "← 返回清單", watch: "看原片 ↗", highlights: "重點", chapters: "章節", deepdive: "逐章節詳解", apis: "關鍵 API / 框架", audience: "適合誰看", code: "範例程式碼", related: "相關場次", none: "(無)", src: "資料來源" },
  en: { back: "← Back to list", watch: "Watch ↗", highlights: "Highlights", chapters: "Chapters", deepdive: "Deep dive", apis: "Key APIs / Frameworks", audience: "Who should watch", code: "Sample code", related: "Related sessions", none: "(none)", src: "Source" },
};

function curLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q) return q;
  const h = new URLSearchParams(location.hash.replace(/^#/, "")).get("lang");
  if (h) return h;
  try { return localStorage.getItem("lang") || "zh"; } catch (e) { return "zh"; }
}
let lang = curLang() === "en" ? "en" : "zh";
const T = () => TT[lang];
function L(field) {
  if (lang === "en") {
    if (field === "points") return s.points_en || s.points;
    if (field === "categoryLabel") return CAT_EN[s.category] || s.categoryLabel;
    return s[field + "_en"] || s[field];
  }
  return field === "categoryLabel" ? s.categoryLabel : s[field];
}
const langParam = () => (lang === "en" ? "?lang=en" : "");

function catColor(cat) {
  return { swift: "#F05138", uikit: "#3B5BDB", swiftui: "#7F77DD", testing: "#16A34A", ai: "#BA7517", design: "#D4537E" }[cat] || "#888780";
}
function effectiveTheme() { const a = document.documentElement.getAttribute("data-theme"); return a || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }

function render() {
  const t = T();
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  const safeUrl = /^https?:\/\//i.test(s.url) ? s.url : "#";
  const chapters = (s.chapters || []).map(([sec, name]) =>
    `<a href="${esc(safeUrl)}?time=${encodeURIComponent(sec)}" target="_blank" rel="noopener"><span class="t">${fmt(sec)}</span><span>${esc(name)}</span></a>`).join("");
  const points = L("points").map((p) => `<li class="${p.hot ? "hot" : ""}">${md(p.text)}</li>`).join("");
  const dd = (lang === "en" ? (s.deepdive_en || s.deepdive) : s.deepdive) || [];
  const deepdive = dd.map((d) =>
    `<div class="dd-item"><a class="dd-h" href="${esc(safeUrl)}?time=${encodeURIComponent(d.t)}" target="_blank" rel="noopener"><span class="t">${fmt(d.t)}</span><span>${esc(d.title)}</span></a><p>${md(d.body)}</p></div>`).join("");
  const apis = (s.apis || []).map((a) => `<span class="api">${esc(a)}</span>`).join("");
  const code = (s.code || []).map((b) => `<pre><code>${esc(b)}</code></pre>`).join("");
  const rel = related.map((r) =>
    `<a href="/s/${esc(r.id)}${langParam()}"><span class="rid">${esc(r.id)}</span><span class="rt">${esc(r.title)}</span><div class="rg">${esc(lang === "en" ? (r.gloss_en || r.gloss) : r.gloss)}</div></a>`).join("");

  document.getElementById("app").innerHTML = `<div class="wrap">
    <div class="top">
      <a class="back" href="/${lang === "en" ? "#lang=en" : ""}">${t.back}</a>
      <div class="tools">
        <button class="tbtn" id="langBtn">${lang === "en" ? "中" : "EN"}</button>
        <button class="tbtn" id="themeBtn">${effectiveTheme() === "dark" ? "☀️" : "🌙"}</button>
      </div>
    </div>
    <div class="head-row">
      <span class="sid">${esc(s.id)}</span>
      <span class="dur">${fmt(s.duration)}</span>
      <span class="cat"><span class="cdot" style="background:${catColor(s.category)}"></span>${esc(L("categoryLabel"))}</span>
    </div>
    <h1>${esc(s.title)}</h1>
    <div class="gloss">${esc(L("gloss"))}</div>
    <p class="takeaway">${md(L("takeaway"))}</p>
    <a class="watch" href="${esc(safeUrl)}" target="_blank" rel="noopener">${t.watch}</a>

    <div class="label">${t.highlights}</div>
    <ul class="points">${points}</ul>

    <div class="label">${t.chapters}</div>
    <div class="chapters">${chapters || '<span class="audience">' + t.none + "</span>"}</div>

    ${deepdive ? `<div class="label">${t.deepdive}</div><div class="deepdive">${deepdive}</div>` : ""}

    <div class="label">${t.apis}</div>
    <div class="apis">${apis || '<span class="audience">' + t.none + "</span>"}</div>

    <div class="label">${t.audience}</div>
    <p class="audience">${md(L("audience"))}</p>

    ${code ? `<div class="label">${t.code}</div>${code}` : ""}

    ${rel ? `<div class="label">${t.related}</div><div class="related">${rel}</div>` : ""}

    <footer>${t.src}: <a href="${esc(safeUrl)}" target="_blank" rel="noopener">developer.apple.com/videos/wwdc2026/${esc(s.id)}</a></footer>
  </div>`;

  document.getElementById("langBtn").addEventListener("click", () => {
    lang = lang === "en" ? "zh" : "en";
    try { localStorage.setItem("lang", lang); } catch (e) {}
    const u = new URL(location.href); if (lang === "en") u.searchParams.set("lang", "en"); else u.searchParams.delete("lang");
    history.replaceState(null, "", u);
    render();
  });
  document.getElementById("themeBtn").addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    render();
  });
}

render();
