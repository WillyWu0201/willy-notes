# Step B — subagent prompt for generating notes (no API key needed)

Dispatch one subagent per batch produced by `prep-gen-batches.mjs`. Replace `{BATCH}`
with the batch number (0, 1, 2, …) and give each subagent the text below verbatim.
Launch them in parallel. When all finish, run `node scripts/merge-notes.mjs`.

---

You are generating bilingual notes for WWDC 2026 sessions for an iOS team's notes site. Work entirely from local files. Do NOT call any external API.

Your batch file lists the session IDs to process:
`.cache/gen-batches/b{BATCH}.json`

For EACH id in that batch:
1. Read `.cache/raw/{id}.json` — it has: title, description, chapters (array of [seconds, title]), code (array of strings), transcript (string, may be empty for keynotes/labs/dailies).
2. Produce `.cache/gen/{id}.json` with EXACTLY this shape and nothing else:

```json
{
  "id": "<the id as a string>",
  "summary": ["<paragraph>", "..."],
  "deepdive": [{ "t": 0, "title": "<chapter title>", "body": "<analysis>" }],
  "summary_en": ["<paragraph>", "..."],
  "deepdive_en": [{ "t": 0, "title": "<chapter title>", "body": "<analysis>" }]
}
```

CONTENT RULES:
- `summary`: 2–4 paragraphs (one string each) of flowing **Traditional Chinese** prose summarizing the WHOLE session top-to-bottom, written to be read on its own and shared with colleagues. Cover the problem/context, the key techniques & APIs, and the practical takeaway. You may **bold** a few key terms. Keep English for API/framework names.
- `deepdive`: ONE entry per chapter, IN THE SAME ORDER as raw.chapters, with `t` and `title` copied EXACTLY from raw.chapters. `body` = 2–4 sentences of concrete Traditional Chinese analysis of what that chapter actually covers, grounded in the transcript (not just the title). **bold** key terms, keep English API names.
- `summary_en` / `deepdive_en`: English equivalents. Same paragraph/chapter counts. deepdive_en uses the SAME t and title as raw.chapters, body in English.
- If raw.chapters is empty → set `deepdive: []` and `deepdive_en: []`.
- If transcript is empty or very short (< 200 chars) → ground the summary in description + chapter titles + code; keep deepdive bodies concise. Still produce useful content.
- Traditional Chinese only (zh-Hant), never Simplified.

STYLE REFERENCE: open `public/data/sessions.json`, find sessions 219 and 223, and match the tone/depth of their `summary` and `deepdive`.

IMPORTANT:
- Write ONLY the `.cache/gen/{id}.json` files. Do NOT modify sessions.json or any other file.
- Each output file must be valid JSON (verify by re-reading it).
- Process every id in your batch.

When done, reply with a one-line summary: how many files you wrote and any ids you treated as no-transcript.
