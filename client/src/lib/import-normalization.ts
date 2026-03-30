type NormalizeOptions = {
  trim?: boolean;
};

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  hellip: "\u2026",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
};

const MOJIBAKE_PATTERN = /(?:\u00c3.|(?:\u00c2.)|\u00e2\u20ac.|\ufffd)/g;

function decodeHtmlEntities(value: string): string {
  let current = value;

  // Decode at most twice to handle common double-encoded cases such as &amp;quot;.
  for (let pass = 0; pass < 2; pass += 1) {
    const next = current.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, token: string) => {
      if (token[0] === "#") {
        const isHex = token[1]?.toLowerCase() === "x";
        const raw = isHex ? token.slice(2) : token.slice(1);
        const codePoint = Number.parseInt(raw, isHex ? 16 : 10);
        if (Number.isFinite(codePoint)) {
          try {
            return String.fromCodePoint(codePoint);
          } catch {
            return entity;
          }
        }
        return entity;
      }

      return HTML_ENTITY_MAP[token.toLowerCase()] ?? entity;
    });

    if (next === current) break;
    current = next;
  }

  return current;
}

function mojibakeScore(value: string): number {
  const signals = value.match(MOJIBAKE_PATTERN)?.length ?? 0;
  const replacements = value.match(/\uFFFD/g)?.length ?? 0;
  return signals * 2 + replacements;
}

function decodeLatin1AsUtf8(value: string): string {
  if (!value) return value;

  const bytes = new Uint8Array(Array.from(value, (char) => char.charCodeAt(0) & 0xff));

  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return value;
  }
}

function repairMojibake(value: string): string {
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    const candidate = decodeLatin1AsUtf8(current);
    if (mojibakeScore(candidate) < mojibakeScore(current)) {
      current = candidate;
      continue;
    }
    break;
  }
  return current;
}

export function normalizePlainImportedText(value: string, options: NormalizeOptions = {}): string {
  const { trim = false } = options;

  let normalized = value.normalize("NFC");
  normalized = decodeHtmlEntities(normalized);
  normalized = repairMojibake(normalized);
  normalized = normalized.replace(/\u00A0/g, " ").replace(/\uFEFF/g, "");

  if (trim) {
    normalized = normalized.trim();
  }

  return normalized;
}

export function containsLikelyEncodingArtifacts(value: string): boolean {
  MOJIBAKE_PATTERN.lastIndex = 0;
  return MOJIBAKE_PATTERN.test(value);
}

export function normalizeImportedHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return normalizePlainImportedText(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-import-root="1">${html}</div>`, "text/html");
  const root = doc.querySelector("[data-import-root='1']");

  if (!root) {
    return normalizePlainImportedText(html);
  }

  const showText = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4;
  const walker = doc.createTreeWalker(root, showText);
  let node = walker.nextNode();

  while (node) {
    node.textContent = normalizePlainImportedText(node.textContent ?? "");
    node = walker.nextNode();
  }

  return root.innerHTML;
}
