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
