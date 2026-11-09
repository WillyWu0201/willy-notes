// Build the digest pages: content/digests/{date}.json -> public/digest/{date}.html + index.html.
// Each day is split into four tabs (see digest-lib CATEGORIES). "AI 開發方式" items with a deep
// analysis get a card; everything else is a row with a short summary. Only http(s) links are
// published, and dropped items are never shown.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { layout, esc } from "./blog-lib.mjs";
import { CATEGORIES, categoryOf, isWebUrl } from "./digest-lib.mjs";

const OUT = "public/digest";
const DIGEST_DIR = "content/digests";
const INTRO = "每天早上自動整理 AI 開發方式、AI 產業動態、iOS／Apple、金融與虛擬資產的新文章；AI 開發方式每篇附重點、反思問題與延伸閱讀。";
const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

// Always four groups in tab order; deep = dev items that carry a deep analysis.
export function groupByCategory(items) {
  const groups = new Map(CATEGORIES.map((c) => [c.id, { deep: [], rows: [] }]));
  for (const i of items) {
    if (i.drop || !isWebUrl(i.url)) continue;
    const g = groups.get(categoryOf(i)) || groups.get("industry");
    (i.deep && categoryOf(i) === "dev" ? g.deep : g.rows).push(i);
  }
  return [...groups];
}

const count = (g) => g.deep.length + g.rows.length;
const total = (groups) => groups.reduce((n, [, g]) => n + count(g), 0);

export function defaultTab(groups) {
  const dev = groups.find(([id]) => id === "dev");
  if (dev && count(dev[1])) return "dev";
  return (groups.find(([, g]) => count(g)) || ["dev"])[0];
}

const src = (i) => `${esc(i.source)}${i.date ? ` · ${esc(i.date)}` : ""}`;
const list = (lines) => `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;

function furtherLine(f) {
  const head = isWebUrl(f.url) ? `<a href="${esc(f.url)}">${esc(f.title)}</a>` : `${esc(f.title)}（文中提到，未附連結）`;
  return `<li>${head}：${esc(f.note)}</li>`;
}

function deepCard(i) {
  const further = i.further?.length ? `<h4>延伸閱讀</h4><ul>${i.further.map(furtherLine).join("")}</ul>` : "";
  return `<div class="deep-card">
<div class="src">${src(i)}</div>
<h3 class="t"><a href="${esc(i.url)}">${esc(i.title)}</a></h3>
<p class="one">${esc(i.summary)}</p>
<h4>重點</h4>${list(i.points)}
<h4>反思問題</h4>${list(i.questions)}
${further}
</div>`;
}

function rows(items) {
  return `<ul class="digest-list">
${items.map((i) => `<li><a href="${esc(i.url)}">${esc(i.title)}</a>${i.summary ? `<p class="sum">${esc(i.summary)}</p>` : ""}<span class="src">${src(i)}</span></li>`).join("\n")}
</ul>`;
}

function panel(id, g) {
  if (!count(g)) return `<p class="empty">今天沒有</p>`;
  const other = g.rows.length ? `${id === "dev" ? "<h3>其他（影片、只有摘要）</h3>\n" : ""}${rows(g.rows)}` : "";
  return `${g.deep.map(deepCard).join("\n")}\n${other}`;
}

// Without JS every panel stays visible; with JS only the selected tab's panel shows.
const TAB_SCRIPT = `<script>
(function(){var box=document.querySelector(".digest-tabs");if(!box)return;
var panels=box.querySelectorAll(".tab-panel"),tabs=box.querySelectorAll("a.tab");
function show(){var id=location.hash.slice(1);if(!box.querySelector('.tab-panel[id="'+id+'"]'))id=box.dataset.default;
panels.forEach(function(p){p.hidden=p.id!==id;});
tabs.forEach(function(t){t.classList.toggle("on",t.getAttribute("href")==="#"+id);});}
tabs.forEach(function(t){t.addEventListener("click",function(e){e.preventDefault();history.replaceState(null,"",t.getAttribute("href"));show();});});
addEventListener("hashchange",show);show();})();
</script>`;

export function renderDay(day) {
  const groups = groupByCategory(day.items);
  const tabs = groups
    .map(([id, g]) => (count(g)
      ? `<a class="tab" href="#${id}">${esc(LABEL[id])} <b>${count(g)}</b></a>`
      : `<span class="tab off">${esc(LABEL[id])} <b>0</b></span>`))
    .join("");
  const panels = groups.map(([id, g]) => `<section class="tab-panel" id="${id}">\n${panel(id, g)}\n</section>`).join("\n");
  const body = `<div class="wrap"><article>
<h1 class="title">資訊摘要 · ${esc(day.date)}</h1>
<div class="meta"><span>${total(groups)} 篇</span></div>
<div class="body">
<p class="digest-intro">${INTRO}</p>
<div class="digest-tabs" data-default="${defaultTab(groups)}">
<nav class="tabs">${tabs}</nav>
${panels}
</div>
</div>
<a class="back" href="/digest/">← 回資訊摘要</a>
</article></div>
${TAB_SCRIPT}`;
  return layout(`資訊摘要 ${day.date} · willy-notes`, body);
}

export function renderIndex(days) {
  const items = days
    .map((d) => {
      const groups = groupByCategory(d.items);
      const counts = groups.filter(([, g]) => count(g)).map(([id, g]) => `${LABEL[id]} ${count(g)}`).join("、");
      return `<li>
<a class="t" href="/digest/${esc(d.date)}">資訊摘要 · ${esc(d.date)}</a>
<div class="d">${total(groups)} 篇</div>
<div class="s">${esc(counts)}</div>
</li>`;
    })
    .join("");
  const body = `<div class="wrap">
<div class="blog-head"><h1>資訊摘要</h1><p class="digest-intro">${INTRO}</p></div>
<ul class="post-list">${items || `<li class="s">尚無摘要。</li>`}</ul>
</div>`;
  return layout("資訊摘要 · willy-notes", body);
}

export function buildAll() {
  const days = (existsSync(DIGEST_DIR) ? readdirSync(DIGEST_DIR) : [])
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(DIGEST_DIR, f), "utf8")))
    .filter((d) => d.items.length)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  mkdirSync(OUT, { recursive: true });
  for (const d of days) writeFileSync(join(OUT, `${d.date}.html`), renderDay(d));
  writeFileSync(join(OUT, "index.html"), renderIndex(days));
  return days.length;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(`built ${buildAll()} digest pages`);
