/**
 * Thin wrapper around the Modal journi-embed endpoint.
 * Sends text to the all-MiniLM-L6-v2 sentence-transformer and returns 384-dim vectors.
 * All calls are fire-and-forget safe: errors are caught and return null.
 */

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const url = process.env.MODAL_EMBED_URL;
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, _auth: process.env.MODAL_TOKEN_SECRET }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embeddings?: number[][] };
    return data.embeddings ?? null;
  } catch {
    return null;
  }
}

export async function embedSingle(text: string): Promise<number[] | null> {
  const result = await embedTexts([text]);
  return result?.[0] ?? null;
}
