import type { ApiSession } from "@shared/backend";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

const STORAGE_KEY = "journi_api_session";

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, message: string, code = "API_ERROR", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getStoredSession(): ApiSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ApiSession;
  } catch {
    return null;
  }
}

export function setStoredSession(session: ApiSession | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function makeHeaders(token?: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed with status ${response.status}`;
    const code = payload?.error?.code ?? "API_ERROR";
    throw new ApiError(response.status, message, code, payload?.error?.details);
  }

  return payload as T;
}

export async function apiFetch<T>(path: string, options?: RequestInit & { token?: string }) {
  const token = options?.token ?? getStoredSession()?.accessToken;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: makeHeaders(token, options?.headers),
  });
  return parseResponse<T>(response);
}

export async function apiFetchNoAuth<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: makeHeaders(undefined, options?.headers),
  });
  return parseResponse<T>(response);
}

