// Fixtures for the 日知 app's tests: the real 2026-11-17 and 2026-11-18 digests as API JSON,
// plus a "needs-update" variant whose minimumAppVersion is higher than any real app.
import { readFileSync } from "node:fs";
import { writeApi } from "./digest-api.mjs";

const load = (date) => JSON.parse(readFileSync(`content/digests/${date}.json`, "utf8"));

export function buildAppFixtures() {
  const [d17, d18] = ["2026-11-17", "2026-11-18"].map(load);
  writeApi("ios/Fixtures/api/v1", [d18, d17]);
  writeApi("ios/Fixtures/needs-update/api/v1", [d18], { minimumAppVersion: "99.0" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildAppFixtures();
  console.log("built app fixtures");
}
