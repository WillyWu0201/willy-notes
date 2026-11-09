// Step 1b of the daily digest: for each item in content/digests/{date}.json that has no
// analysis yet, fetch the article's text and outbound links into a bundle that Claude reads:
// .cache/digest/{date}/items/{index}.json. Pure functions are exported for tests.
//
// Run:  node scripts/digest-prep.mjs [--date YYYY-MM-DD]
// Prints "BUNDLE: <dir> TODO: <n>", or "NO_NEW" when there is nothing to analyse.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { decode, fetchText } from "./feed-digest.mjs";
import { isWebUrl } from "./digest-lib.mjs";

export const DEEP_MIN_CHARS = 1500;
export const TEXT_MAX_CHARS = 30000;

const DROP_TAGS = ["script", "style", "nav", "header", "footer", "aside", "svg", "noscript", "form"];

function region(html) {
  for (const tag of ["article", "main"]) {
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (m) return m[1];
  }
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  return body ? body[1] : html;
}

// Main text and the outbound links inside it (the article's citations).
export function extractArticle(html, baseUrl) {
  let part = region(html);
  for (const tag of DROP_TAGS) part = part.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi"), " ");
  const links = [];
  for (const [, href] of part.matchAll(/<a\b[^>]*?\bhref="([^"]*)"/gi)) {
    if (href.startsWith("#")) continue;
    let url;
    try { url = new URL(decode(href), baseUrl).href; } catch { continue; }
    if (isWebUrl(url) && !links.includes(url)) links.push(url);
  }
  const text = decode(part.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return { text, links };
}

export function extractVideoDescription(html) {
  const m = html.match(/"shortDescription":("(?:[^"\\]|\\.)*")/);
  return m ? JSON.parse(m[1]) : "";
}

export const isVideo = (url) => /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/)/.test(url);

// article is null when the fetch failed. Deep analysis needs full text and is never done for videos.
export function prepEntry(item, index, article) {
  const text = (article?.text || "").slice(0, TEXT_MAX_CHARS);
  return {
    index, url: item.url, title: item.title, source: item.source, date: item.date ?? null,
    curated: !!item.curated,
    deep: !!article && !isVideo(item.url) && text.length >= DEEP_MIN_CHARS,
    text, links: article?.links || [],
  };
}

// Items already analysed (summary) or dropped are not prepared again.
export function prepTargets(items) {
  return items.flatMap((item, i) => (item.summary || item.drop ? [] : [i]));
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  const dateArg = process.argv.indexOf("--date");
  const date = dateArg !== -1 ? process.argv[dateArg + 1] : todayLocal();
  const dayPath = join("content/digests", `${date}.json`);
  const day = existsSync(dayPath) ? JSON.parse(readFileSync(dayPath, "utf8")) : { items: [] };
  const targets = prepTargets(day.items);
  if (!targets.length) return console.log("NO_NEW");

  const dir = join(".cache/digest", date);
  mkdirSync(join(dir, "items"), { recursive: true });
  for (const i of targets) {
    const item = day.items[i];
    let article = null;
    let fetchError;
    try {
      const html = await fetchText(item.url);
      article = isVideo(item.url) ? { text: extractVideoDescription(html), links: [] } : extractArticle(html, item.url);
    } catch (e) {
      fetchError = e.message;
    }
    const entry = prepEntry(item, i, article);
    if (fetchError) entry.fetchError = fetchError;
    writeFileSync(join(dir, "items", `${i}.json`), JSON.stringify(entry, null, 2) + "\n");
    console.log(`  [${i}] ${entry.deep ? "deep" : "short"} ${item.title}${fetchError ? `（抓取失敗：${fetchError}）` : ""}`);
  }
  console.log(`BUNDLE: ${dir} TODO: ${targets.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
