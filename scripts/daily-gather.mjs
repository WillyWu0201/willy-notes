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
