// Fetch the sources in automation/feeds.json (sites without RSS + noisy official feeds),
// keep only new items that hit a keyword, and write content/digests/{date}.md + .json.
// Pure functions are exported for tests; main() runs only when invoked as the entry point.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// CDATA unwrap → strip tags → decode entities → strip decoded tags → collapse whitespace
function clean(s = "") {
  const raw = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ");
  return decode(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tagContent(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Read the date as written by the publisher (no timezone shifting).
export function parseLooseDate(text) {
  if (!text) return null;
  let m = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return ymd(m[1], m[2], m[3]);
  m = text.match(new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RE}\\s+(\\d{4})\\b`, "i"));
  if (m) return ymd(m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, m[1]);
  m = text.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i"));
  if (m) return ymd(m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, m[2]);
  return null;
}

// English keywords match as whole words (plural allowed); CJK keywords match as substrings.
export function buildMatcher(groups) {
  const rules = [];
  for (const [group, words] of Object.entries(groups)) {
    for (const word of words) {
      const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const re = /^[\x00-\x7f]+$/.test(word)
        ? new RegExp(`(?<![A-Za-z0-9])${esc}(?:s|es)?(?![A-Za-z0-9])`, "i")
        : new RegExp(esc, "i");
      rules.push({ group, word, re });
    }
  }
  return (text) => {
    const hits = rules.filter((r) => r.re.test(text));
    return { groups: [...new Set(hits.map((h) => h.group))], keywords: [...new Set(hits.map((h) => h.word))] };
  };
}

export function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)\b[^>]*>[\s\S]*?<\/\1>/gi) || [];
  return blocks.map((b) => {
    const title = clean(tagContent(b, "title"));
    const linkAttrs = [...b.matchAll(/<link\b([^>]*)>/gi)].map((m) => m[1]).filter((a) => /\bhref=/.test(a));
    const alt = linkAttrs.find((a) => !/\brel=/.test(a) || /\brel="alternate"/.test(a)) || linkAttrs[0];
    const url = alt ? decode(alt.match(/\bhref="([^"]+)"/)[1]) : clean(tagContent(b, "link"));
    const date = parseLooseDate(tagContent(b, "pubDate") || tagContent(b, "updated") || tagContent(b, "published") || tagContent(b, "dc:date"));
    const summary = clean(tagContent(b, "description") || tagContent(b, "summary")).slice(0, 500);
    return { title, url, date, text: `${title} ${summary}`.trim() };
  }).filter((i) => i.url);
}

// Listing pages: keep anchors whose absolute URL matches `pattern`. A card is often split
// into several anchors to the same URL (title, summary), so merge their text per URL, take
// the first heading as the title (else the longest text), and drop short nav links.
export function extractLinks(html, baseUrl, pattern) {
  const re = new RegExp(pattern);
  const byUrl = new Map();
  for (const m of html.matchAll(/<a\b[^>]*?\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(decode(m[1]), baseUrl).href; } catch { continue; }
    if (!re.test(url)) continue;
    const entry = byUrl.get(url) || { heading: null, texts: [] };
    const text = clean(m[2]);
    if (text && !entry.texts.includes(text)) entry.texts.push(text);
    const heading = m[2].match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    if (heading && !entry.heading) entry.heading = clean(heading[1]);
    byUrl.set(url, entry);
  }
  return [...byUrl].map(([url, e]) => {
    const text = e.texts.join(" ");
    const longest = e.texts.reduce((a, b) => (b.length > a.length ? b : a), "");
    return { title: (e.heading || longest).slice(0, 160), url, date: parseLooseDate(text), text };
  }).filter((i) => i.title.length >= 15);
}

function slugTitle(url) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  try { return decodeURIComponent(slug).replace(/[-_]+/g, " "); } catch { return slug.replace(/[-_]+/g, " "); }
}

// Sitemaps have no titles, so the URL slug stands in for one (enough for keyword matching).
export function parseSitemap(xml, pattern) {
  const re = new RegExp(pattern);
  const out = [];
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const url = clean(tagContent(block, "loc"));
    if (!re.test(url)) continue;
    const title = slugTitle(url);
    out.push({ title, url, date: parseLooseDate(tagContent(block, "lastmod")), text: title });
  }
  return out;
}

export function extractYouTube(html) {
  const m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  if (!m) throw new Error("找不到 ytInitialData");
  const out = new Map();
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    const v = o.lockupViewModel;
    const title = v?.metadata?.lockupMetadataViewModel?.title?.content;
    if (v?.contentId && title && !out.has(v.contentId)) {
      out.set(v.contentId, { title, url: `https://www.youtube.com/watch?v=${v.contentId}`, date: null, text: title });
    }
    Object.values(o).forEach(walk);
  })(JSON.parse(m[1]));
  return [...out.values()];
}

// support.apple.com/100100: rows of [name (linked when it has CVEs), available for, release date].
export function parseAppleSecurity(html) {
  const out = [];
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]);
    const href = cells[0]?.match(/href="([^"]+)"/);
    if (cells.length < 3 || !href) continue;
    const title = clean(cells[0]);
    const url = new URL(decode(href[1]), "https://support.apple.com/").href;
    out.push({ title, url, date: parseLooseDate(clean(cells[2])), text: `${title} ${clean(cells[1])}` });
  }
  return out;
}

function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Sites sometimes reformat their links (doubled or trailing slashes, www., host case). Compare a
// normalised form, or a reformatted feed makes every old post look new (Eugene Yan, 2026-11-15).
export function seenKey(url) {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
    return `${host}${path}${u.search}`;
  } catch {
    return url;
  }
}

// First run for a source (no saved state): seed everything as seen and only surface items
// dated within the last `days`, so the first digest isn't the whole archive. Later runs surface
// unseen items, but still never ones dated before that window (undated items pass).
export function selectNew(items, prevSeen, today, days = 7) {
  const firstRun = prevSeen === undefined;
  const known = new Set((prevSeen || []).map(seenKey));
  const cutoff = shiftDate(today, -days);
  const fresh = items.filter((i) =>
    firstRun ? i.date && i.date >= cutoff : !known.has(seenKey(i.url)) && (!i.date || i.date >= cutoff));
  const seen = [...new Set([...(prevSeen || []), ...items.map((i) => i.url)])];
  return { fresh, seen: seen.slice(-5000), firstRun };
}

// A source with `groups` is matched only against those keyword groups, so a general security
// feed adds only 金融資安 hits instead of every article that mentions AI.
export function keywordsFor(keywords, src) {
  if (!src.groups) return keywords;
  return Object.fromEntries(Object.entries(keywords).filter(([group]) => src.groups.includes(group)));
}

// Curated sources (`all`) are kept whole and marked curated; others must hit a keyword.
export function pickHits(fresh, src, match) {
  const hits = fresh.map((i) => ({ ...i, ...match(i.text) }));
  if (!src.all) return hits.filter((i) => i.groups.length);
  return hits.map((i) => ({ ...i, groups: i.groups.length ? i.groups : ["AI"], curated: true }));
}

function statusText(s) {
  if (s.error) return `失敗：${s.error}`;
  if (s.parsed === 0) return "⚠ 解析不到資料（可能網站改版）";
  if (s.firstRun) return "首次執行，已建立基準";
  return "正常";
}

const mdEscape = (s) => s.replace(/([[\]\\])/g, "\\$1");

export function renderDigest(date, items, statuses) {
  let out = `# 資訊摘要 · ${date}\n\n`;
  if (!items.length) {
    out += "今天沒有命中關鍵字的新文章。\n";
  } else {
    out += `命中關鍵字的新文章共 ${items.length} 篇。\n`;
    const bySource = new Map();
    for (const i of items) {
      if (!bySource.has(i.source)) bySource.set(i.source, []);
      bySource.get(i.source).push(i);
    }
    for (const [source, list] of bySource) {
      out += `\n## ${source}\n\n`;
      for (const i of list) {
        out += `- [${mdEscape(i.title)}](${i.url.replace(/\)/g, "%29")})${i.date ? ` · ${i.date}` : ""} · ${i.groups.join("、")}\n`;
      }
    }
  }
  out += "\n## 來源狀態\n\n| 來源 | 解析 | 新文章 | 命中 | 狀態 |\n|---|---|---|---|---|\n";
  for (const s of statuses) out += `| ${s.name} | ${s.parsed} | ${s.fresh} | ${s.matched} | ${statusText(s)} |\n`;
  return out;
}

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const UA = "Mozilla/5.0 (compatible; willy-notes-digest/0.1; +https://willy-notes.pages.dev)";
const PARSERS = {
  rss: (body) => parseFeed(body),
  links: (body, src) => extractLinks(body, src.url, src.match),
  sitemap: (body, src) => parseSitemap(body, src.match),
  youtube: (body) => extractYouTube(body),
  "apple-security": (body) => parseAppleSecurity(body),
};

function todayLocal() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9,zh-TW;q=0.8" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// One retry: YouTube now and then serves a page without ytInitialData.
async function load(src) {
  try {
    return PARSERS[src.type](await fetchText(src.url), src);
  } catch {
    return PARSERS[src.type](await fetchText(src.url), src);
  }
}

async function main() {
  const dateArg = process.argv.indexOf("--date");
  const date = dateArg !== -1 ? process.argv[dateArg + 1] : todayLocal();
  const cfg = JSON.parse(readFileSync("automation/feeds.json", "utf8"));
  const state = existsSync(cfg.statePath) ? JSON.parse(readFileSync(cfg.statePath, "utf8")) : {};

  const results = await Promise.all(cfg.sources.map(async (src) => {
    try {
      const items = await load(src);
      const { fresh, seen, firstRun } = selectNew(items, state[src.id], date, src.firstRunDays ?? 7);
      if (items.length) state[src.id] = seen; // a broken parser must not wipe the baseline
      const hits = pickHits(fresh, src, buildMatcher(keywordsFor(cfg.keywords, src)));
      return {
        status: { name: src.name, parsed: items.length, fresh: fresh.length, matched: hits.length, firstRun },
        hits: hits.map((h) => ({
          source: src.name, title: h.title, url: h.url, date: h.date, groups: h.groups, keywords: h.keywords,
          ...(h.curated ? { curated: true } : {}),
        })),
      };
    } catch (e) {
      return { status: { name: src.name, parsed: 0, fresh: 0, matched: 0, error: e.message }, hits: [] };
    }
  }));

  // Running twice on the same day appends to that day's digest instead of replacing it.
  const jsonPath = join(cfg.outputDir, `${date}.json`);
  const prev = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, "utf8")).items : [];
  const known = new Set(prev.map((i) => i.url));
  const items = [...prev, ...results.flatMap((r) => r.hits).filter((i) => !known.has(i.url))];
  const statuses = results.map((r) => r.status);

  mkdirSync(cfg.outputDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify({ date, generatedAt: new Date().toISOString(), items, sources: statuses }, null, 2) + "\n");
  const mdPath = join(cfg.outputDir, `${date}.md`);
  writeFileSync(mdPath, renderDigest(date, items, statuses));
  mkdirSync(dirname(cfg.statePath), { recursive: true });
  writeFileSync(cfg.statePath, JSON.stringify(state));

  console.log(`DIGEST: ${mdPath}（${items.length} 篇）`);
  for (const s of statuses) console.log(`  ${s.name}: ${statusText(s)} 解析=${s.parsed} 新=${s.fresh} 命中=${s.matched}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
