// Gather today's git commits + Claude session text into a bundle for the daily
// blog-draft scheduled task. Pure functions are exported for tests; the
// orchestrator (added in a later task) runs only when invoked as the entry point.

export function repoToProjectKey(repoPath) {
  return repoPath.replace(/\/+$/, "").replace(/\//g, "-");
}

export function matchesRepo(dirName, key) {
  return dirName === key || dirName.startsWith(key + "--");
}
