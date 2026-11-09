import { test } from "node:test";
import assert from "node:assert/strict";
import { changedOutsideDigest, publishBlockers, DEPLOY_CHECK_PATHS } from "./digest-publish.mjs";

test("changedOutsideDigest lists modified, untracked and renamed paths outside public/digest", () => {
  const porcelain = [" M public/index.html", "?? public/new.html", "?? public/digest/2026-11-09.html", "R  public/a.html -> public/b.html", " M content/digests/x.json"].join("\n");
  assert.deepEqual(changedOutsideDigest(porcelain), ["public/index.html", "public/new.html", "public/b.html"]);
  assert.deepEqual(changedOutsideDigest(""), []);
});
test("publishBlockers explains every reason not to deploy", () => {
  assert.deepEqual(publishBlockers({ branch: "main", porcelain: "?? public/digest/a.html", draftsExists: false }), []);
  assert.equal(publishBlockers({ branch: "feature", porcelain: "", draftsExists: false }).length, 1);
  assert.match(publishBlockers({ branch: "main", porcelain: " M public/index.html", draftsExists: false })[0], /public\/index\.html/);
  assert.match(publishBlockers({ branch: "main", porcelain: "", draftsExists: true })[0], /drafts/);
  assert.equal(publishBlockers({ branch: "dev", porcelain: " M public/x.html", draftsExists: true }).length, 3);
});
test("changedOutsideDigest also flags server code and config that wrangler deploys", () => {
  const porcelain = [" M functions/api/me.ts", " M wrangler.toml", "?? lib/new.ts", " M scripts/blog-lib.mjs", " M public/digest/index.html"].join("\n");
  assert.deepEqual(changedOutsideDigest(porcelain), ["functions/api/me.ts", "wrangler.toml", "lib/new.ts", "scripts/blog-lib.mjs"]);
});
test("DEPLOY_CHECK_PATHS covers everything wrangler pages deploy ships plus the page builders", () => {
  for (const p of ["public", "functions", "lib", "wrangler.toml", "scripts/build-digest.mjs", "scripts/blog-lib.mjs", "scripts/digest-lib.mjs"]) {
    assert.ok(DEPLOY_CHECK_PATHS.includes(p), p);
  }
});
