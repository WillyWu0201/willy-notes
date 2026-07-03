// Pipeline step 3 — build per-session detail pages into public/s/{id}.html.
// Reads notes from public/data/sessions.json and sample code from .cache/raw/{id}.json,
// computes related sessions (shared APIs + same category), and emits a tiny page per
// session that embeds its data and renders via the shared /s/detail.js + /s/detail.css.
//
// Run:  node scripts/build-details.mjs   (re-run after regenerating notes)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const sessions = JSON.parse(readFileSync("public/data/sessions.json", "utf8"));
mkdirSync("public/wwdc26/s", { recursive: true });

function relatedFor(s) {
  const mine = new Set((s.apis || []).map((a) => a.toLowerCase()));
  return sessions
    .filter((x) => x.id !== s.id)
    .map((x) => {
      let score = x.category === s.category ? 2 : 0;
      for (const a of x.apis || []) if (mine.has(a.toLowerCase())) score += 3;
      return [x, score];
    })
    .filter(([, sc]) => sc > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([x]) => ({ id: x.id, title: x.title, gloss: x.gloss, gloss_en: x.gloss_en, category: x.category, categoryLabel: x.categoryLabel }));
}

const escTitle = (x) => String(x).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

let n = 0, withCode = 0;
for (const s of sessions) {
  let code = [];
  try { code = JSON.parse(readFileSync(`.cache/raw/${s.id}.json`, "utf8")).code || []; } catch (e) {}
  code = code.slice(0, 12);
  if (code.length) withCode++;
  const data = { s: { ...s, code }, related: relatedFor(s) };
  const json = JSON.stringify(data).replace(/</g, "\\u003c"); // never break out of <script>
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escTitle(s.title)} · WWDC26</title>
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/wwdc26/s/detail.css">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
</head>
<body>
<div id="app"></div>
<script id="d" type="application/json">${json}</script>
<script src="/wwdc26/s/detail.js"></script>
</body>
</html>
`;
  writeFileSync(`public/wwdc26/s/${s.id}.html`, html);
  n++;
}
console.log(`wrote ${n} detail pages (${withCode} with sample code)`);
