import type { ParsedSection, ParsedCitation } from "../../shared/document-parse";

interface OllamaResponse {
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

async function invokeLocalLLM(textChunk: string): Promise<OllamaResponse> {
  const url = "http://127.0.0.1:11434/api/generate";
  // We use a strict prompt to ensure valid JSON structure.
  const prompt = `
You are an academic document parser.
I will provide you with a chunk of unformatted text extracted from a manuscript.
Your job is to structure this text into semantic sections and extract any references/citations.
Return ONLY a valid JSON object matching the schema. Do NOT return markdown formatting like \\\`\\\`\\\`json. Return raw JSON.

Schema:
{
  "sections": [
    { "title": "Section Title", "content": "Paragraph 1\\nParagraph 2" }
  ],
  "citations": [
    { "authors": ["Author 1", "Author 2"], "title": "Paper Title", "year": 2023, "journal": "Journal Name" }
  ]
}

Ensure that the 'content' of each section contains the exact text from the chunk, formatted with newlines. Do not summarize or alter the text. If no citations are found, return an empty array for citations.

Text Chunk:
---
${textChunk}
---
`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2", // Optimized 3B parameter model
        prompt,
        format: "json", // Forces Ollama to output valid JSON
        stream: false,
        options: {
          temperature: 0.0, // Deterministic parsing
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API returned ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    let parsed: any;
    try {
        parsed = JSON.parse(data.response);
    } catch {
        // Fallback or rough clean up if Ollama ignored prompt rules
        parsed = JSON.parse(data.response.replace(/^\`\`\`json/m, '').replace(/\`\`\`$/m, '').trim());
    }
    
    return {
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch")) {
      throw new Error("Ollama does not appear to be running on localhost:11434. Please start it with \`ollama run llama3.2\`");
    }
    throw error;
  }
}

export async function parseDocumentWithLLM(text: string): Promise<OllamaParsedDocument> {
  const chunks = chunkText(text, 1000);
  const finalResponse: OllamaParsedDocument = { sections: [], citations: [] };
  
  for (const chunk of chunks) {
    const chunkParsed = await invokeLocalLLM(chunk);
    
    // Stitch sections across chunks
    for (const section of chunkParsed.sections) {
      const lastSection = finalResponse.sections[finalResponse.sections.length - 1];
      // Group logically continuing sections
      if (
        lastSection && 
        (lastSection.title.toLowerCase() === section.title.toLowerCase() || 
         section.title.toLowerCase() === "content")
      ) {
        lastSection.content += "\\n\\n" + section.content;
      } else {
        finalResponse.sections.push(section);
      }
    }
    
    // Stitch citations
    for (const citation of chunkParsed.citations) {
        // Simple deduplication based on title
        if (!finalResponse.citations.some(c => c.title.toLowerCase() === citation.title.toLowerCase())) {
            finalResponse.citations.push(citation);
        }
    }
  }
  
  return finalResponse;
}
