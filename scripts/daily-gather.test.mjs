import { test } from "node:test";
import assert from "node:assert/strict";
import { repoToProjectKey, matchesRepo, parseGitLog, extractSession } from "./daily-gather.mjs";

test("repoToProjectKey converts an absolute path to a project key", () => {
  assert.equal(repoToProjectKey("/Users/willy/Developer/foo"), "-Users-willy-Developer-foo");
});
test("repoToProjectKey strips a trailing slash", () => {
  assert.equal(repoToProjectKey("/Users/willy/Developer/foo/"), "-Users-willy-Developer-foo");
});
test("matchesRepo matches the exact key and worktree-prefixed dirs", () => {
  const key = "-Users-willy-Developer-foo";
  assert.equal(matchesRepo(key, key), true);
  assert.equal(matchesRepo(key + "--claude-worktrees-abc", key), true);
  assert.equal(matchesRepo("-Users-willy-Developer-foobar", key), false);
});

test("parseGitLog parses hash, subject and changed files", () => {
  const text = "\x1eabc123\x1fFix the thing\nsrc/a.js\nsrc/b.js\n\x1edef456\x1fAdd feature";
  const out = parseGitLog(text);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { hash: "abc123", subject: "Fix the thing", files: ["src/a.js", "src/b.js"] });
  assert.deepEqual(out[1], { hash: "def456", subject: "Add feature", files: [] });
});
test("parseGitLog returns [] for empty input", () => {
  assert.deepEqual(parseGitLog(""), []);
});
test("extractSession keeps user/assistant text and skips noise", () => {
  const lines = [
    JSON.stringify({ type: "user", message: { content: "幫我修這個 bug" } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "thinking", thinking: "hmm" }, { type: "text", text: "好的,我來修" }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: {} }] } }),
    JSON.stringify({ type: "mode", mode: "x" }),
    "not json",
  ].join("\n");
  const out = extractSession(lines);
  assert.match(out, /使用者: 幫我修這個 bug/);
  assert.match(out, /助手: 好的,我來修/);
  assert.doesNotMatch(out, /hmm/);       // thinking skipped
  assert.doesNotMatch(out, /tool_use|Bash/); // tool_use skipped
});
