// Publish a draft: move content/drafts/<name>.md -> content/posts/, rebuild, deploy.
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readConfig } from "./blog-lib.mjs";

const name = process.argv[2];
if (!name) {
  console.error("Usage: npm run publish <draft-name>   (e.g. npm run publish 2026-07-03)");
  process.exit(1);
}
const { contentDir } = readConfig();
const src = join(contentDir, "drafts", `${name}.md`);
const dst = join(contentDir, "posts", `${name}.md`);
if (!existsSync(src)) {
  console.error(`Draft not found: ${src}`);
  process.exit(1);
}
renameSync(src, dst);
console.log(`moved ${name}.md: drafts -> posts`);
execFileSync("node", ["scripts/build-blog.mjs"], { stdio: "inherit" });
execFileSync("npx", ["wrangler", "pages", "deploy", "public", "--project-name", "willy-notes"], { stdio: "inherit" });
