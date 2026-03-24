/// <reference lib="webworker" />

import type { ParsedManuscript, RawParsedDocument } from '@shared/document-parse';
import { parseRawDocument } from '@shared/document-parse';

interface WorkerRequest {
  data: RawParsedDocument;
}

interface WorkerResponse {
  ok: boolean;
  data?: ParsedManuscript;
  error?: string;
}

self.onmessage = (event: MessageEvent<RawParsedDocument | WorkerRequest>) => {
  try {
    const payload = (event.data as WorkerRequest)?.data ?? (event.data as RawParsedDocument);
    const parsed = parseRawDocument(payload);
    const response: WorkerResponse = { ok: true, data: parsed };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      ok: false,
      error: error instanceof Error ? error.message : 'Worker parse failed',
    };
    self.postMessage(response);
  }
};
