// JSON for the 日知 iOS app: content/digests/{date}.json -> public/digest/api/v1/{index,date}.json.
// Same filtering and grouping as the web pages (see build-digest groupByCategory). Output is
// deterministic so an unchanged day never produces a new commit.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES, isWebUrl } from "./digest-lib.mjs";
import { groupByCategory } from "./build-digest.mjs";

export const itemId = (url) => createHash("sha256").update(url).digest("hex").slice(0, 16);

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function videoOf(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let id = null;
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.slice("/shorts/".length);
  } else if (host === "youtu.be") {
    id = u.pathname.slice(1);
  }
  return id && YT_ID.test(id) ? { provider: "youtube", id } : null;
}

// "2026-11-18T01:01:52.522Z" -> "2026-11-18T09:01:52+08:00" (Taiwan has no DST).
export function toTaipeiIso(iso) {
  return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, "+08:00");
}

function toItem(i, category, deep) {
  const out = {
    id: itemId(i.url), category, title: i.title, url: i.url, source: i.source,
    publishedOn: i.date ?? null, summary: i.summary ?? null, deep,
  };
  if (deep) {
    out.points = i.points;
    out.questions = i.questions;
    out.further = (i.further || []).map((f) => ({ title: f.title, ...(isWebUrl(f.url) ? { url: f.url } : {}), note: f.note }));
  }
  out.video = videoOf(i.url);
  return out;
}

function buildDay(day) {
  const seen = new Set();
  const items = [];
  for (const [category, g] of groupByCategory(day.items)) {
    for (const [list, deep] of [[g.deep, true], [g.rows, false]]) {
      for (const i of list) {
        const item = toItem(i, category, deep);
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
    }
  }
  return { schemaVersion: 1, date: day.date, generatedAt: toTaipeiIso(day.generatedAt), items };
}

export function buildApi(days, { minimumAppVersion = "1.0" } = {}) {
  const files = new Map(days.map((d) => [d.date, buildDay(d)]));
  const index = {
    schemaVersion: 1,
    generatedAt: days.length ? files.get(days[0].date).generatedAt : null,
    minimumAppVersion,
    categories: CATEGORIES,
    days: days.map((d) => {
      const items = files.get(d.date).items;
      const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, items.filter((i) => i.category === c.id).length]));
      return { date: d.date, total: items.length, counts };
    }),
  };
  return { index, files };
}

const json = (o) => `${JSON.stringify(o, null, 2)}\n`;

export function writeApi(dir, days, opts) {
  const { index, files } = buildApi(days, opts);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) {
    if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f) && !files.has(f.slice(0, -5))) rmSync(join(dir, f));
  }
  writeFileSync(join(dir, "index.json"), json(index));
  for (const [date, d] of files) writeFileSync(join(dir, `${date}.json`), json(d));
}
