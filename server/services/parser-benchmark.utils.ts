import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readJsonl<T>(filePath: string): Promise<T[]> {
  if (!(await fileExists(filePath))) return [];
  const raw = await fs.readFile(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function writeJsonl<T>(filePath: string, rows: T[]): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.writeFile(filePath, `${content}${content ? "\n" : ""}`, "utf8");
}

export async function appendJsonl<T>(filePath: string, row: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function sha256File(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return sha256Buffer(buffer);
}

export function toCsvValue(value: unknown): string {
  if (value == null) return "";
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export async function writeCsv(
  filePath: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(",")),
  ];
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
