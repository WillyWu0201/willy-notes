import { test } from "node:test";
import assert from "node:assert/strict";
import { changedOutsideDigest, publishBlockers } from "./digest-publish.mjs";

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
