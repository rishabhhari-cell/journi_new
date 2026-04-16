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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MODAL_TOKEN_SECRET ?? ""}`,
    },
    body: JSON.stringify({ texts }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Embed endpoint returned ${res.status}`);
  const data = (await res.json()) as { embeddings?: number[][] };
  return data.embeddings ?? null;
}

async function main() {
  console.log("Fetching journals without scope_embedding...");

  const { data: journals, error } = await supabase
    .from("journals")
    .select("id, name, subject_areas, publisher")
    .is("scope_embedding", null)
    .order("name");

  if (error) throw new Error(`Failed to fetch journals: ${error.message}`);
  if (!journals || journals.length === 0) {
    console.log("All journals already have embeddings. Nothing to do.");
    return;
  }

  console.log(`Found ${journals.length} journals to embed.`);

  const BATCH = 10;
  let done = 0;

  for (let i = 0; i < journals.length; i += BATCH) {
    const batch = journals.slice(i, i + BATCH);
    const texts = batch.map((j) => {
      const subjects = (j.subject_areas as string[] | null ?? []).join(", ");
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

    console.log(`Progress: ${Math.min(i + BATCH, journals.length)} / ${journals.length}`);
  }

  console.log(`Done. Embedded ${done} / ${journals.length} journals.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
