export type CitationFormat = "vancouver" | "apa" | "mla";

interface CitationRow {
  authors: string[];
  title: string;
  publication_year: number | null;
  doi: string | null;
  url: string | null;
  citation_type: "article" | "book" | "website" | "conference";
  metadata: Record<string, unknown>;
}

function formatAuthorsVancouver(authors: string[]): string {
  if (authors.length === 0) return "Unknown";
  const formatted = authors.slice(0, 6).map((name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    const last = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map((p) => p[0].toUpperCase())
      .join("");
    return `${last} ${initials}`;
  });
  return authors.length > 6 ? `${formatted.join(", ")}, et al` : formatted.join(", ");
}

function formatAuthorsApa(authors: string[]): string {
  if (authors.length === 0) return "Unknown";
  const formatted = authors.slice(0, 7).map((name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    const last = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map((p) => `${p[0].toUpperCase()}.`)
      .join(" ");
    return `${last}, ${initials}`;
  });
  if (authors.length > 7) {
    return `${formatted.slice(0, 6).join(", ")}, ... ${formatted[formatted.length - 1]}`;
  }
  if (formatted.length === 1) return formatted[0];
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
}

function formatAuthorsMla(authors: string[]): string {
  if (authors.length === 0) return "Unknown";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]}, and ${authors[1]}`;
  return `${authors[0]}, et al`;
}

function getJournal(meta: Record<string, unknown>): string {
  return (meta.journal as string) ?? (meta.journal_name as string) ?? "";
}
function getVolume(meta: Record<string, unknown>): string {
  return (meta.volume as string) ?? "";
}
function getIssue(meta: Record<string, unknown>): string {
  return (meta.issue as string) ?? "";
}
function getPages(meta: Record<string, unknown>): string {
  return (meta.pages as string) ?? "";
}
function getPublisher(meta: Record<string, unknown>): string {
  return (meta.publisher as string) ?? "";
}

export function formatCitation(citation: CitationRow, format: CitationFormat): string {
  const year = citation.publication_year ?? "n.d.";
  const doi = citation.doi ? ` doi:${citation.doi}` : citation.url ? ` ${citation.url}` : "";
  const meta = citation.metadata ?? {};

  switch (format) {
    case "vancouver": {
      const authors = formatAuthorsVancouver(citation.authors);
      const journal = getJournal(meta);
      const vol = getVolume(meta);
      const issue = getIssue(meta);
      const pages = getPages(meta);
      const journalPart = journal
        ? ` ${journal}. ${year};${vol}${issue ? `(${issue})` : ""}${pages ? `:${pages}` : ""}.`
        : ` ${year}.`;
      return `${authors}.${journalPart}${doi}`.trim();
    }

    case "apa": {
      const authors = formatAuthorsApa(citation.authors);
      const journal = getJournal(meta);
      const vol = getVolume(meta);
      const issue = getIssue(meta);
      const pages = getPages(meta);
      if (citation.citation_type === "book") {
        const publisher = getPublisher(meta);
        return `${authors} (${year}). ${citation.title}. ${publisher}.${doi}`.trim();
      }
      if (citation.citation_type === "website") {
        return `${authors} (${year}). ${citation.title}. Retrieved from${doi || ""}`.trim();
      }
      const journalPart = journal
        ? ` *${journal}*, *${vol}*${issue ? `(${issue})` : ""}${pages ? `, ${pages}` : ""}.`
        : `.`;
      return `${authors} (${year}). ${citation.title}.${journalPart}${doi ? ` https://doi.org/${citation.doi}` : ""}`.trim();
    }

    case "mla": {
      const authors = formatAuthorsMla(citation.authors);
      const journal = getJournal(meta);
      const vol = getVolume(meta);
      const issue = getIssue(meta);
      const pages = getPages(meta);
      const journalPart = journal
        ? `, *${journal}*, vol. ${vol}, no. ${issue}, ${year}, pp. ${pages}.`
        : `, ${year}.`;
      return `${authors}. "${citation.title}"${journalPart}${doi}`.trim();
    }
  }
}
