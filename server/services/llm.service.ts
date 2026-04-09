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

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:4b";

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
  // Strip markdown fences if the model ignores instructions
  text = text.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```$/m, "").trim();
  const parsed = JSON.parse(text);
  return {
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    citations: Array.isArray(parsed.citations) ? parsed.citations : [],
  };
}

async function invokeOllama(textChunk: string): Promise<LLMResponse> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildPrompt(textChunk),
      format: "json",
      stream: false,
      options: { temperature: 0.0 },
    }),
    signal: AbortSignal.timeout(120_000), // 2 min max per chunk on CPU
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return parseJsonResponse(data.response);
}

async function invokeAnthropic(textChunk: string): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001", // Cheapest Claude model — ~$0.25/1M input tokens
      max_tokens: 4096,
      messages: [{ role: "user", content: buildPrompt(textChunk) }],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic returned ${res.status}: ${body}`);
  }

  const data = await res.json();
  return parseJsonResponse(data.content[0].text);
}

async function invokeLLM(textChunk: string): Promise<LLMResponse> {
  // Try Ollama first (self-hosted, zero data exposure)
  if (OLLAMA_BASE_URL) {
    try {
      return await invokeOllama(textChunk);
    } catch (ollamaError) {
      console.warn(
        "[llm.service] Ollama unavailable, falling back to Anthropic:",
        ollamaError instanceof Error ? ollamaError.message : ollamaError
      );
    }
  }

  // Fall back to Anthropic (no data retention on API, already have the key)
  if (process.env.ANTHROPIC_API_KEY) {
    return await invokeAnthropic(textChunk);
  }

  throw new Error("No LLM available: Ollama is unreachable and ANTHROPIC_API_KEY is not set.");
}

export async function parseDocumentWithLLM(text: string): Promise<OllamaParsedDocument> {
  const chunks = chunkText(text, 1000);
  const result: OllamaParsedDocument = { sections: [], citations: [] };

  for (const chunk of chunks) {
    const chunkParsed = await invokeLLM(chunk);

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

  return result;
}
