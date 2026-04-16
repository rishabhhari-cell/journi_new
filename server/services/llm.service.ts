export interface OllamaParsedDocument {
  sections: Array<{ title: string; content: string }>;
  citations: Array<{
    authors: string[];
    title: string;
    year: number;
    journal?: string;
    doi?: string;
    url?: string;
  }>;
}

interface LLMResponse {
  sections: Array<{ title: string; content: string }>;
  citations: Array<{
    authors: string[];
    title: string;
    year: number;
    journal?: string;
    doi?: string;
    url?: string;
  }>;
}

function buildPrompt(textChunk: string): string {
  return `You are an academic document parser. Extract text from the chunk below into structured sections and citations.

RULES — follow exactly:
1. DO NOT rephrase, summarize, or paraphrase any text. Copy content VERBATIM from the source.
2. Replace ALL em-dashes (— – \u2014 \u2013) and any Unicode dash variants with a hyphen-minus (-). Never output em-dashes.
3. Do not invent content. If a section boundary is unclear, include the text under the nearest prior heading.
4. If you are unsure which section text belongs to, output it under the section title "Unknown" (title field = "Unknown").
5. Return ONLY a valid JSON object. No markdown fences, no commentary, no explanations.
6. NEVER output a section with an empty or near-empty content field. Every section you output MUST contain at least 20 words of verbatim content from the source. If a heading appears but has no body text in this chunk, omit that section entirely rather than outputting it with empty content.

Schema:
{
  "sections": [
    { "title": "Section Title", "content": "Exact verbatim text\\nwith newlines preserved" }
  ],
  "citations": [
    { "authors": ["Author 1"], "title": "Paper Title", "year": 2023, "journal": "Journal Name" }
  ]
}

If no citations are found, return an empty array for citations.

Text Chunk:
---
${textChunk}
---`;
}

function chunkText(text: string, maxWords = 1000): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.length >= maxWords) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}

function parseJsonResponse(raw: string): LLMResponse {
  let text = raw.trim();
  // Strip Qwen3 thinking blocks (safety net even with thinking mode disabled)
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Strip markdown fences if the model ignores instructions
  text = text.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```$/m, "").trim();
  const parsed = JSON.parse(text);
  return {
    sections: Array.isArray(parsed.sections)
      ? parsed.sections.filter((s: any) => typeof s.content === "string" && typeof s.title === "string")
      : [],
    citations: Array.isArray(parsed.citations) ? parsed.citations : [],
  };
}

// Manuscript text must not leave this server. No external API fallback.
// This function only ever calls the Modal endpoint (private, on-infrastructure GPU).
async function invokeModal(textChunk: string): Promise<LLMResponse> {
  const url = process.env.MODAL_LLM_URL;
  if (!url) throw new Error("MODAL_LLM_URL not set — cannot call LLM fallback");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: buildPrompt(textChunk),
      _auth: process.env.MODAL_TOKEN_SECRET,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Modal LLM returned ${res.status}: ${body}`);
  }

  const data = await res.json();
  return parseJsonResponse(data.response);
}

export async function parseDocumentWithLLM(text: string): Promise<OllamaParsedDocument> {
  const chunks = chunkText(text, 1000);

  // Process all chunks in parallel — Modal handles concurrent requests on the same GPU.
  const chunkResults = await Promise.all(chunks.map((chunk) => invokeModal(chunk)));

  const result: OllamaParsedDocument = { sections: [], citations: [] };

  for (const chunkParsed of chunkResults) {
    // Stitch sections across chunks — merge if same title or continuation
    for (const section of chunkParsed.sections) {
      const last = result.sections[result.sections.length - 1];
      if (
        last &&
        (last.title.toLowerCase() === section.title.toLowerCase() ||
          section.title.toLowerCase() === "content")
      ) {
        last.content += "\n\n" + section.content;
      } else {
        result.sections.push(section);
      }
    }

    // Deduplicate citations by title
    for (const citation of chunkParsed.citations) {
      if (!result.citations.some((c) => c.title.toLowerCase() === citation.title.toLowerCase())) {
        result.citations.push(citation);
      }
    }
  }

  // Post-parse validation: reject any LLM section with <20 words of content.
  // Guards against the LLM producing the same empty-heading problem as the deterministic parser.
  result.sections = result.sections.filter((section) => {
    const wordCount = (section.content ?? "").trim().split(/\s+/).filter(Boolean).length;
    return wordCount >= 20;
  });

  return result;
}
