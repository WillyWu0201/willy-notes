// Step 3 of the daily digest, the only command the 09:00 task may run unattended:
// merge Claude's analyses → rebuild /digest/ → pre-deploy checks → commit the digest paths
// on local main → deploy. Any failed check skips commit and deploy (pages are still built).
//
// Run:  npm run digest:publish   (node scripts/digest-publish.mjs [--date YYYY-MM-DD])

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mergeFiles, dateFromArgs, printMerge } from "./digest-merge.mjs";
import { buildAll } from "./build-digest.mjs";

const DIGEST_PATHS = ["content/digests", "public/digest"];

// Paths under public/ but outside public/digest/ from `git status --porcelain -- public`.
export function changedOutsideDigest(porcelain) {
  return porcelain
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.slice(3).split(" -> ").pop().replace(/^"|"$/g, ""))
    .filter((p) => p.startsWith("public/") && !p.startsWith("public/digest/"));
}

export function publishBlockers({ branch, porcelain, draftsExists }) {
  const reasons = [];
  if (branch !== "main") reasons.push(`目前分支是 ${branch || "（detached）"}，不是 main`);
  const outside = changedOutsideDigest(porcelain);
  if (outside.length) reasons.push(`public/ 有摘要以外未 commit 的變更：${outside.join("、")}`);
  if (draftsExists) reasons.push("public/blog/drafts/ 存在，草稿頁會被一起發佈");
  return reasons;
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

function hasStagedDigestChanges() {
  try {
    execFileSync("git", ["diff", "--cached", "--quiet", "--", ...DIGEST_PATHS]);
    return false;
  } catch {
    return true;
  }
}

function main() {
  const date = dateFromArgs(process.argv);
  printMerge(mergeFiles(date));
  console.log(`BUILT: ${buildAll()} 頁`);

  const blockers = publishBlockers({
    branch: git("branch", "--show-current").trim(),
    porcelain: git("status", "--porcelain", "--", "public"),
    draftsExists: existsSync("public/blog/drafts"),
  });
  if (blockers.length) {
    for (const b of blockers) console.log(`SKIPPED: ${b}`);
    return;
  }

  git("add", "--", ...DIGEST_PATHS);
  if (hasStagedDigestChanges()) {
    git("commit", "-m", `資訊摘要 ${date}`, "--", ...DIGEST_PATHS);
    console.log("COMMITTED");
  } else {
    console.log("NO_CHANGES");
  }
  try {
    execFileSync("npx", ["wrangler", "pages", "deploy", "public", "--project-name", "willy-notes", "--branch", "main"], { stdio: "inherit" });
    console.log("DEPLOYED");
  } catch (e) {
    console.log(`DEPLOY_FAILED: ${e.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
