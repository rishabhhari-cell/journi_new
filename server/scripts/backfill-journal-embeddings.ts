/**
 * One-time backfill: generate and store scope_embedding for all journals
 * that currently have none.
 *
 * Run:
 *   npx tsx server/scripts/backfill-journal-embeddings.ts
 *
 * Requires MODAL_EMBED_URL in environment (or .env).
 *
 * Speed knobs (env vars):
 *   EMBED_BATCH_SIZE   — texts per Modal request (default: 64)
 *   EMBED_CONCURRENCY  — parallel in-flight Modal requests (default: 4)
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const EMBED_BATCH_SIZE = parseInt(process.env.EMBED_BATCH_SIZE ?? "64", 10);
const EMBED_CONCURRENCY = parseInt(process.env.EMBED_CONCURRENCY ?? "4", 10);

async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const url = process.env.MODAL_EMBED_URL;
  if (!url) throw new Error("MODAL_EMBED_URL is not set");

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) throw new Error(`Embed endpoint returned ${res.status}`);
      const data = (await res.json()) as { embeddings?: number[][] };
      if (!data.embeddings) {
        console.error("Embed response missing embeddings field:", JSON.stringify(data).slice(0, 300));
      }
      return data.embeddings ?? null;
    } catch (err) {
      if (attempt === 4) return null;
      const wait = attempt * 3000;
      console.warn(`Embed attempt ${attempt} failed (${(err as Error).message}), retrying in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return null;
}

type JournalRow = { id: string; name: string; subject_areas: string[] | null; publisher: string | null };

function toEmbedText(j: JournalRow): string {
  const subjects = (j.subject_areas ?? []).join(", ");
  return [j.name, subjects, j.publisher].filter(Boolean).join(". ");
}

async function processBatch(batch: JournalRow[]): Promise<number> {
  const texts = batch.map(toEmbedText);
  const embeddings = await embedTexts(texts);
  if (!embeddings) {
    console.warn(`Batch of ${batch.length}: embed returned null, skipping`);
    return 0;
  }

  // Write in small parallel chunks to avoid overwhelming Supabase
  const WRITE_CHUNK = 10;
  let saved = 0;
  for (let w = 0; w < batch.length; w += WRITE_CHUNK) {
    const chunk = batch.slice(w, w + WRITE_CHUNK);
    const results = await Promise.all(
      chunk.map((j, k) =>
        supabase
          .from("journals")
          .update({ scope_embedding: embeddings[w + k] })
          .eq("id", j.id)
          .then(({ error }) => {
            if (error) {
              console.error(`Update failed for ${j.id}: ${error.message}`);
              return 0;
            }
            return 1;
          }),
      ),
    );
    saved += results.reduce<number>((a, b) => a + b, 0);
  }
  return saved;
}

async function main() {
  console.log(`Settings: batch=${EMBED_BATCH_SIZE}, concurrency=${EMBED_CONCURRENCY}`);

  // Fetch one page at a time, embed it, then move on — avoids loading all rows into memory
  // and keeps individual Supabase queries small enough to avoid statement timeouts.
  const PAGE = EMBED_BATCH_SIZE * EMBED_CONCURRENCY; // fetch exactly what we'll process per round
  let offset = 0;
  let done = 0;
  let grandTotal = 0;

  while (true) {
    const { data, error, count } = await supabase
      .from("journals")
      .select("id, name, subject_areas, publisher", { count: "estimated" })
      .is("scope_embedding", null)
      .order("name")
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Failed to fetch journals: ${error.message}`);
    if (!data || data.length === 0) break;

    if (grandTotal === 0) {
      grandTotal = count ?? 0;
      console.log(`~${grandTotal.toLocaleString()} journals need embeddings.`);
    }

    const page = data as JournalRow[];

    // Split page into embed-sized batches and process concurrently
    const batches: JournalRow[][] = [];
    for (let i = 0; i < page.length; i += EMBED_BATCH_SIZE) {
      batches.push(page.slice(i, i + EMBED_BATCH_SIZE));
    }

    const results = await Promise.all(batches.map(processBatch));
    done += results.reduce<number>((a, b) => a + b, 0);
    console.log(`Progress: ${done.toLocaleString()} embedded so far...`);

    if (data.length < PAGE) break;
    // Don't advance offset — rows that got embedded are no longer returned by
    // .is("scope_embedding", null), so the next query starts from the new front.
  }

  console.log(`\nDone. Embedded ${done.toLocaleString()} journals.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
