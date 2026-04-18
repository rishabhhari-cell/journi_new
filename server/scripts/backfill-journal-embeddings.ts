/**
 * One-time backfill: generate and store scope_embedding for all journals
 * that currently have none.
 *
 * Run:
 *   npx tsx server/scripts/backfill-journal-embeddings.ts
 *
 * Requires MODAL_EMBED_URL and MODAL_TOKEN_SECRET in environment (or .env).
 * Processes journals in batches of 10 to stay within the embed endpoint limits.
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

async function main() {
  console.log("Fetching journals without scope_embedding...");

  // Paginate through all journals since Supabase caps at 1000 rows per query
  const PAGE = 1000;
  let offset = 0;
  let allJournals: Array<{ id: string; name: string; subject_areas: string[] | null; publisher: string | null }> = [];

  while (true) {
    const { data, error } = await supabase
      .from("journals")
      .select("id, name, subject_areas, publisher")
      .is("scope_embedding", null)
      .order("name")
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Failed to fetch journals: ${error.message}`);
    if (!data || data.length === 0) break;
    allJournals = allJournals.concat(data);
    console.log(`Fetched ${allJournals.length} journals so far...`);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  if (allJournals.length === 0) {
    console.log("All journals already have embeddings. Nothing to do.");
    return;
  }

  console.log(`Found ${allJournals.length} journals to embed.`);

  const BATCH = 10;
  let done = 0;

  for (let i = 0; i < allJournals.length; i += BATCH) {
    const batch = allJournals.slice(i, i + BATCH);
    const texts = batch.map((j) => {
      const subjects = (j.subject_areas ?? []).join(", ");
      return [j.name, subjects, j.publisher].filter(Boolean).join(". ");
    });

    const embeddings = await embedTexts(texts);
    if (!embeddings) {
      console.warn(`Batch ${i}–${i + batch.length - 1}: embed returned null, skipping`);
      continue;
    }

    for (let k = 0; k < batch.length; k++) {
      const { error: updateError } = await supabase
        .from("journals")
        .update({ scope_embedding: embeddings[k] })
        .eq("id", batch[k].id);

      if (updateError) {
        console.error(`Failed to update journal ${batch[k].id}: ${updateError.message}`);
      } else {
        done++;
      }
    }

    if ((i + BATCH) % 100 === 0 || i + BATCH >= allJournals.length) {
      console.log(`Progress: ${Math.min(i + BATCH, allJournals.length)} / ${allJournals.length}`);
    }
  }

  console.log(`Done. Embedded ${done} / ${allJournals.length} journals.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
