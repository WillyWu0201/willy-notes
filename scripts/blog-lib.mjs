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
