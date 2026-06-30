// Pipeline step 2 — summarize.
// Reads .cache/raw/*.json, asks Claude to produce the fixed notes schema (Traditional
// Chinese) for any session not already in public/data/sessions.json, and writes the
// merged result back. Incremental: sessions already summarized are skipped.
//
// Env:
//   ANTHROPIC_API_KEY   (required)
//   SUMMARY_MODEL       (optional, default claude-sonnet-4-6; use claude-haiku-4-5-20251001 to go cheaper)
//
// Run:  ANTHROPIC_API_KEY=sk-ant-... npm run summarize

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";

const RAW_DIR = ".cache/raw";
const OUT = "public/data/sessions.json";
const MODEL = process.env.SUMMARY_MODEL || "claude-sonnet-4-6";
const KEY = process.env.ANTHROPIC_API_KEY;

const SCHEMA_INSTRUCTIONS = `You are summarizing one Apple WWDC developer session for an iOS team's notes site.
Reply with ONLY a JSON object (no markdown, no prose) matching exactly:
{
  "gloss": string,            // short Traditional Chinese gloss of the title
  "category": string,         // one of: swift, uikit, swiftui, testing, ai, design, appstore, graphics, visionos, other
  "categoryLabel": string,    // Traditional Chinese label for the category
  "takeaway": string,         // one-sentence Traditional Chinese takeaway
  "points": [ { "text": string, "hot": boolean } ],  // 3-5 items, Traditional Chinese, **bold** key terms; hot=true only for a notably important/breaking item
  "apis": string[],           // key API / framework names mentioned (keep as code identifiers)
  "audience": string,         // Traditional Chinese: who should watch, **bold** the core phrase
  "summary": string[],        // 2-4 paragraphs (one string each) of flowing Traditional Chinese prose
      // summarizing the WHOLE session top-to-bottom, written to be read on its own and shared with
      // colleagues. Cover the problem, the key techniques/APIs, and the practical takeaway in narrative
      // form. You may **bold** a few key terms; keep English for API/framework names.
  "deepdive": [ { "t": number, "title": string, "body": string } ]
      // chapter-by-chapter analysis. One entry per chapter, in order, with the SAME t (seconds)
      // and title as the given chapters. body = 2-4 sentences of concrete Traditional Chinese
      // analysis of what that chapter actually covers (grounded in the transcript, not the title),
      // **bold** key terms, keep English for API/framework names.
}
Be concrete and technical. Keep English for API names and framework terms.`;

async function summarize(raw: any) {
  const body = {
    model: MODEL,
    max_tokens: 4000,
    system: SCHEMA_INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content:
          `Title: ${raw.title}\nDuration(sec): ${raw.duration}\n` +
          `Description: ${raw.description}\n` +
          `Chapters:\n${raw.chapters.map(([t, n]: [number, string]) => `- ${t}s ${n}`).join("\n")}\n` +
          (raw.code?.length ? `\nSample code:\n${raw.code.slice(0, 8).join("\n---\n")}\n` : "") +
          (raw.transcript ? `\nTranscript:\n${String(raw.transcript).slice(0, 24000)}` : ""),
      },
    ],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const text = data.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json);
}

async function main() {
  if (!KEY) throw new Error("Set ANTHROPIC_API_KEY");
  await mkdir("public/data", { recursive: true });
  const existing: any[] = JSON.parse(await readFile(OUT, "utf8").catch(() => "[]"));
  const have = new Set(existing.map((s) => s.id));
  const files = (await readdir(RAW_DIR).catch(() => [])).filter((f) => f.endsWith(".json"));
  console.log(`Raw: ${files.length}. Already summarized: ${have.size}. Model: ${MODEL}.`);

  for (const f of files) {
    const raw = JSON.parse(await readFile(`${RAW_DIR}/${f}`, "utf8"));
    if (have.has(raw.id)) continue;
    try {
      const s = await summarize(raw);
      existing.push({
        id: raw.id,
        title: raw.title,
        gloss: s.gloss,
        category: s.category,
        categoryLabel: s.categoryLabel,
        duration: raw.duration,
        url: `https://developer.apple.com/videos/play/wwdc2026/${raw.id}/`,
        takeaway: s.takeaway,
        chapters: raw.chapters,
        points: s.points,
        apis: s.apis,
        audience: s.audience,
        summary: s.summary || [],
        deepdive: s.deepdive || [],
      });
      console.log(`  ✓ ${raw.id}  ${raw.title}`);
      await writeFile(OUT, JSON.stringify(existing, null, 2)); // write as we go (crash-safe)
    } catch (err) {
      console.warn(`  ! ${raw.id} failed:`, (err as Error).message);
    }
  }
  console.log(`Wrote ${existing.length} sessions to ${OUT}.`);
}

main();
