// Build the blog: content/posts/*.md -> public/blog/{slug}.html + list + posts.json.
// Production build (this file, no flags) reads ONLY posts/ and clears public/blog/drafts/.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import { readConfig, parseFrontmatter, postFromFile, assertUniqueSlugs, renderPost, renderList } from "./blog-lib.mjs";

const { contentDir } = readConfig();
const OUT = "public/blog";

function load(sub) {
  const dir = join(contentDir, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, body } = parseFrontmatter(readFileSync(join(dir, f), "utf8"));
      const post = postFromFile(f, data);
      return { ...post, bodyHtml: marked.parse(body) };
    });
}

mkdirSync(OUT, { recursive: true });
const posts = load("posts").sort((a, b) => (a.date < b.date ? 1 : -1));
assertUniqueSlugs(posts);
for (const p of posts) writeFileSync(join(OUT, `${p.slug}.html`), renderPost(p, p.bodyHtml));
writeFileSync(join(OUT, "index.html"), renderList(posts));
mkdirSync("public/data", { recursive: true });
writeFileSync(
  "public/data/posts.json",
  JSON.stringify(posts.map(({ slug, title, date, summary, tags }) => ({ slug, title, date, summary, tags })), null, 2)
);
rmSync(join(OUT, "drafts"), { recursive: true, force: true }); // deploy safety
console.log(`built ${posts.length} posts`);
