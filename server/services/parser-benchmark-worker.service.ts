import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import {
  FETCH_RENDER_LOCK_DIR,
  FETCH_RENDER_READY_DIR,
  RUN_DONE_DIR,
  RUN_LOCK_DIR,
  WORKER_STATE_DIR,
} from "./parser-benchmark.constants";
import { ensureDir, fileExists, writeJson } from "./parser-benchmark.utils";

export interface WorkerConfig {
  batchIndex: number;
  batchSize: number;
}

export async function ensureWorkerStateDirs(): Promise<void> {
  await Promise.all([
    ensureDir(WORKER_STATE_DIR),
    ensureDir(FETCH_RENDER_LOCK_DIR),
    ensureDir(FETCH_RENDER_READY_DIR),
    ensureDir(RUN_LOCK_DIR),
    ensureDir(RUN_DONE_DIR),
  ]);
}

export function getFetchRenderReadyPath(batchIndex: number): string {
  return path.join(FETCH_RENDER_READY_DIR, `batch-${batchIndex}.json`);
}

export function getRunDonePath(batchIndex: number): string {
  return path.join(RUN_DONE_DIR, `batch-${batchIndex}.json`);
}

export async function fetchRenderReadyExists(batchIndex: number): Promise<boolean> {
  return fileExists(getFetchRenderReadyPath(batchIndex));
}

export async function runDoneExists(batchIndex: number): Promise<boolean> {
  return fileExists(getRunDonePath(batchIndex));
}

export async function withBatchClaim<T>(
  stage: "fetch-render" | "run",
  batchIndex: number,
  workerName: string,
  work: () => Promise<T>,
): Promise<{ claimed: boolean; result?: T }> {
  const lockDir = stage === "fetch-render" ? FETCH_RENDER_LOCK_DIR : RUN_LOCK_DIR;
  const lockPath = path.join(lockDir, `batch-${batchIndex}.lock`);

  await ensureDir(lockDir);

  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(lockPath, "wx");
    await handle.writeFile(`${workerName}\n${new Date().toISOString()}\n`, "utf8");
  } catch {
    return { claimed: false };
  }

  try {
    const result = await work();
    return { claimed: true, result };
  } finally {
    await handle?.close();
    await fs.rm(lockPath, { force: true });
  }
}

export async function markFetchRenderReady(batchIndex: number, metadata: Record<string, unknown>): Promise<void> {
  await writeJson(getFetchRenderReadyPath(batchIndex), metadata);
}

export async function markRunDone(batchIndex: number, metadata: Record<string, unknown>): Promise<void> {
  await writeJson(getRunDonePath(batchIndex), metadata);
}

export async function runBenchmarkScript(
  scriptPath: string,
  envOverrides: Record<string, string | undefined>,
): Promise<void> {
  const nodeBin = process.execPath;
  const tsxCliPath = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const maxOldSpaceMb = process.env.BENCHMARK_NODE_MAX_OLD_SPACE_MB ?? "6144";

  const childEnv = Object.fromEntries(
    Object.entries({
      ...process.env,
      ...envOverrides,
    }).filter(([, value]) => value !== undefined),
  ) as NodeJS.ProcessEnv;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(nodeBin, [`--max-old-space-size=${maxOldSpaceMb}`, tsxCliPath, scriptPath], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: childEnv,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Script failed with exit code ${code}: ${scriptPath}`));
    });
  });
}
