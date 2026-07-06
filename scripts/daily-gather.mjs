// Gather today's git commits + Claude session text into a bundle for the daily
// blog-draft scheduled task. Pure functions are exported for tests; the
// orchestrator (added in a later task) runs only when invoked as the entry point.

export function repoToProjectKey(repoPath) {
  return repoPath.replace(/\/+$/, "").replace(/\//g, "-");
}

export function matchesRepo(dirName, key) {
  return dirName === key || dirName.startsWith(key + "--");
}

export function parseGitLog(text) {
  return text
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const [hash, subject = ""] = lines[0].split("\x1f");
      const files = lines.slice(1).map((l) => l.trim()).filter(Boolean);
      return { hash, subject, files };
    });
}

export function extractSession(jsonlText) {
  const turns = [];
  for (const line of jsonlText.split("\n")) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type !== "user" && o.type !== "assistant") continue;
    if (o.isMeta) continue;
    const c = o.message && o.message.content;
    let text = "";
    if (typeof c === "string") text = c;
    else if (Array.isArray(c)) text = c.filter((b) => b && b.type === "text").map((b) => b.text).join("\n");
    text = text.trim();
    if (!text) continue;
    turns.push((o.type === "user" ? "使用者: " : "助手: ") + text);
  }
  return turns.join("\n\n");
}

export function trim(text, cap) {
  if (text.length <= cap) return text;
  const cut = text.length - cap;
  return text.slice(0, cap) + `\n\n…(已裁切 ${cut} 字)`;
}

export function renderBundle(date, sources) {
  const hasContent = sources.some((s) => (s.commits && s.commits.length) || (s.sessionText && s.sessionText.trim()));
  if (!hasContent) return "NO_CONTENT";
  let out = `# 素材包 · ${date}\n`;
  for (const s of sources) {
    out += `\n## ${s.repo}\n`;
    if (s.commits && s.commits.length) {
      out += `\n### commits\n`;
      for (const c of s.commits) out += `- ${c.hash} ${c.subject}${c.files.length ? ` (${c.files.join(", ")})` : ""}\n`;
    } else {
      out += `\n(今天無 commit)\n`;
    }
    if (s.sessionText && s.sessionText.trim()) out += `\n### session 重點\n${s.sessionText}\n`;
  }
  return out;
}

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { readConfig } from "./blog-lib.mjs";

function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isSameLocalDay(mtime, dateStr) {
  const p = (n) => String(n).padStart(2, "0");
  const s = `${mtime.getFullYear()}-${p(mtime.getMonth() + 1)}-${p(mtime.getDate())}`;
  return s === dateStr;
}

function expandHome(p) {
  return p.startsWith("~/") ? resolve(process.env.HOME || "", p.slice(2)) : p;
}

function gitCommits(repo, date, authorEmail) {
  try {
    const out = execFileSync(
      "git",
      ["-C", repo, "log", `--since=${date} 00:00`, `--until=${date} 23:59`,
       `--author=${authorEmail}`, "--no-merges", "--pretty=format:%x1e%h%x1f%s", "--name-only"],
      { encoding: "utf8" }
    );
    return parseGitLog(out);
  } catch {
    return [];
  }
}

function sessionText(repo, date, sessionsDir) {
  const key = repoToProjectKey(repo);
  const root = expandHome(sessionsDir);
  let dirs = [];
  try {
    dirs = readdirSync(root).filter((d) => matchesRepo(d, key));
  } catch {
    return "";
  }
  const parts = [];
  for (const d of dirs) {
    const dirPath = join(root, d);
    let files = [];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const fp = join(dirPath, f);
      try {
        if (!isSameLocalDay(statSync(fp).mtime, date)) continue;
        const text = extractSession(readFileSync(fp, "utf8"));
        if (text.trim()) parts.push(text);
      } catch {
        continue;
      }
    }
  }
  return parts.join("\n\n");
}

function main() {
  const dateArg = process.argv.indexOf("--date");
  const date = dateArg !== -1 ? process.argv[dateArg + 1] : todayLocal();
  const { contentDir } = readConfig();
  const cfg = JSON.parse(readFileSync("automation/config.json", "utf8"));
  const maxChars = cfg.maxChars || 40000;

  const sources = cfg.repos.map((repo) => ({
    repo,
    commits: gitCommits(repo, date, cfg.authorEmail),
    sessionText: sessionText(repo, date, cfg.sessionsDir),
  }));

  const withSession = sources.filter((s) => s.sessionText.trim()).length || 1;
  const perCap = Math.floor(maxChars / withSession);
  for (const s of sources) s.sessionText = trim(s.sessionText, perCap);

  const bundle = renderBundle(date, sources);
  if (bundle === "NO_CONTENT") {
    console.log("NO_CONTENT");
    return;
  }
  mkdirSync("automation/.cache", { recursive: true });
  const bundlePath = join("automation/.cache", `daily-${date}.md`);
  writeFileSync(bundlePath, trim(bundle, maxChars));
  const draftPath = join(contentDir, "drafts", `${date}.md`);
  console.log(`BUNDLE: ${bundlePath}`);
  console.log(`DRAFT_TARGET: ${draftPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
