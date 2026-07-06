import { test } from "node:test";
import assert from "node:assert/strict";
import { repoToProjectKey, matchesRepo } from "./daily-gather.mjs";

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
