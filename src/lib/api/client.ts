/**
 * Shared HTTP client primitives for the Aegis backend.
 *
 * Build stage 1 — introduces a base-URL helper + a thin `fetch` wrapper that
 * carries the right headers and surfaces structured errors. Every backend call
 * goes through here so the seam stays small.
 */

/**
 * Public base URL of the Aegis FastAPI backend. Set via `NEXT_PUBLIC_API_BASE`
 * (e.g. `http://127.0.0.1:8000`); defaults to `http://127.0.0.1:8000` in dev.
 *
 * No trailing slash — `apiUrl()` joins paths with a leading slash.
 */
export const API_BASE: string = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

/**
 * Join the backend base URL with a path returned by the API. Backend payloads
 * carry server-relative paths like `/api/scan/<id>/normalized`; the frontend
 * joins them with `API_BASE` before rendering.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Structured error from the backend's `HTTPException(detail={...})`. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Minimal typed `fetch` for JSON endpoints. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await safeReadJson(response);
    throw new ApiError(
      response.status,
      detail,
      typeof detail === "object" && detail && "error" in detail
        ? String((detail as { error?: string }).error ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`
    );
  }
  return (await response.json()) as T;
}

async function safeReadJson(r: Response): Promise<unknown> {
  try {
    return await r.json();
  } catch {
    return await r.text().catch(() => null);
  }
}
