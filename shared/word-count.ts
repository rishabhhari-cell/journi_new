export function stripHtmlToText(value: string): string {
  if (!value) return "";
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWordsFromText(text: string): number {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return 0;

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    let count = 0;
    for (const token of segmenter.segment(cleaned)) {
      if (token.isWordLike) count += 1;
    }
    return count;
  }

  const words = cleaned.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g);
  return words ? words.length : 0;
}

export function countWordsFromHtml(html: string): number {
  return countWordsFromText(stripHtmlToText(html));
}
