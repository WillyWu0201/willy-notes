// Build the digest pages: content/digests/{date}.json -> public/digest/{date}.html + index.html.
// Only titles and links to the original articles are published.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { layout, esc } from "./blog-lib.mjs";

const OUT = "public/digest";
const INTRO = "每天自動追蹤 AI、iOS／Apple、金融與虛擬資產相關來源，只列出命中關鍵字的新文章，標題連到原文。";

// URLs come from scraped sites, so only http(s) links are published (no javascript: etc.).
const isWebUrl = (u) => {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};

// Each item goes under its first matched group; groups follow the keyword order in feeds.json.
export function groupItems(items, groupOrder) {
  const groups = new Map(groupOrder.map((g) => [g, []]));
  for (const i of items.filter((i) => isWebUrl(i.url))) {
    const g = i.groups[0];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(i);
  }
  return [...groups].filter(([, list]) => list.length);
}

const total = (groups) => groups.reduce((n, [, list]) => n + list.length, 0);

export function renderDay(day, groupOrder) {
  const groups = groupItems(day.items, groupOrder);
  const sections = groups
    .map(([g, list]) => `<h2>${esc(g)}</h2>
<ul class="digest-list">
${list.map((i) => `<li><a href="${esc(i.url)}">${esc(i.title)}</a><span class="src">${esc(i.source)}${i.date ? ` · ${esc(i.date)}` : ""}</span></li>`).join("\n")}
</ul>`)
    .join("\n");
  const body = `<div class="wrap"><article>
<h1 class="title">資訊摘要 · ${esc(day.date)}</h1>
<div class="meta"><span>${total(groups)} 篇</span></div>
<div class="body">
<p class="digest-intro">${INTRO}</p>
${sections}
</div>
<a class="back" href="/digest/">← 回資訊摘要</a>
</article></div>`;
  return layout(`資訊摘要 ${day.date} · willy-notes`, body);
}

export function renderIndex(days, groupOrder) {
  const items = days
    .map((d) => {
      const groups = groupItems(d.items, groupOrder);
      const counts = groups.map(([g, list]) => `${g} ${list.length}`).join("、");
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

function main() {
  const cfg = JSON.parse(readFileSync("automation/feeds.json", "utf8"));
  const groupOrder = Object.keys(cfg.keywords);
  const dir = cfg.outputDir;
  const days = (existsSync(dir) ? readdirSync(dir) : [])
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .filter((d) => d.items.length)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  mkdirSync(OUT, { recursive: true });
  for (const d of days) writeFileSync(join(OUT, `${d.date}.html`), renderDay(d, groupOrder));
  writeFileSync(join(OUT, "index.html"), renderIndex(days, groupOrder));
  console.log(`built ${days.length} digest pages`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
