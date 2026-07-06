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
