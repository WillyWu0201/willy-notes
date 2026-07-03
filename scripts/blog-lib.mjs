import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readConfig(root = process.cwd()) {
  const cfg = JSON.parse(readFileSync(resolve(root, "content.config.json"), "utf8"));
  let dir = cfg.contentDir || "content";
  if (dir.startsWith("~/")) dir = resolve(process.env.HOME || "", dir.slice(2));
  return { contentDir: resolve(root, dir) };
}

export function parseFrontmatter(raw) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split("\n")) {
    const mm = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!mm) continue;
    let val = mm[2].trim();
    if (/^\[.*\]$/.test(val)) {
      val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    data[mm[1]] = val;
  }
  return { data, body: raw.slice(m[0].length) };
}

export function deriveDate(data, filename) {
  if (data.date) return String(data.date).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(filename);
  if (m) return m[1];
  throw new Error(`No date: set 'date' in frontmatter or prefix filename with YYYY-MM-DD (${filename})`);
}

export function deriveSlug(data, filename) {
  if (data.slug) return String(data.slug).trim();
  return deriveDate(data, filename);
}

export function postFromFile(filename, data) {
  if (!data.title) throw new Error(`Missing 'title' in ${filename}`);
  const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
  return {
    title: String(data.title),
    date: deriveDate(data, filename),
    slug: deriveSlug(data, filename),
    summary: data.summary || "",
    tags,
  };
}

export function assertUniqueSlugs(posts) {
  const seen = new Set();
  for (const p of posts) {
    if (seen.has(p.slug)) throw new Error(`Duplicate slug "${p.slug}" — add a unique 'slug' in frontmatter`);
    seen.add(p.slug);
  }
}

const esc = (x) => String(x).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/blog/blog.css">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
</head>
<body>
<div id="site-nav"></div>
${bodyHtml}
<script src="/nav.js"></script>
</body>
</html>
`;
}

export function renderPost(post, bodyHtml) {
  const tags = (post.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("");
  const body = `<div class="wrap"><article>
<h1 class="title">${esc(post.title)}</h1>
<div class="meta"><span>${esc(post.date)}</span>${tags}</div>
<div class="body">${bodyHtml}</div>
<a class="back" href="/blog/">← 回部落格</a>
</article></div>`;
  return layout(`${post.title} · willy-notes`, body);
}

export function renderList(posts) {
  const items = posts
    .map((p) => `<li>
<a class="t" href="/blog/${esc(p.slug)}">${esc(p.title)}</a>
<div class="d">${esc(p.date)}</div>
${p.summary ? `<div class="s">${esc(p.summary)}</div>` : ""}
</li>`)
    .join("");
  const body = `<div class="wrap">
<div class="blog-head"><h1>部落格</h1></div>
<ul class="post-list">${items || `<li class="s">尚無文章。</li>`}</ul>
</div>`;
  return layout("部落格 · willy-notes", body);
}
