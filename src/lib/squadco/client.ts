/**
 * Low-level fetch wrapper for the SquadCo backend.
 *
 * Tokens live in a single module-scoped variable that mirrors localStorage
 * so SSR-safe reads return null while the client-side hydration step picks
 * up the persisted token. The auth store (`@/stores/squadco-auth`) drives
 * setToken/clearToken — don't read or write the token directly from
 * components.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_SQUADCO_API_BASE ||
  "https://anjolaakins-testsquadco.hf.space";

const TOKEN_STORAGE_KEY = "aegis.squadco.jwt";

let inMemoryToken: string | null = null;

export function getToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === "undefined") return null;
  inMemoryToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return inMemoryToken;
}

export function setToken(token: string): void {
  inMemoryToken = token;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function clearToken(): void {
  inMemoryToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export class SquadCoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = "SquadCoError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body (auto-serialised). */
  body?: unknown;
  /** Optional query string params, plain key-value. */
  query?: Record<string, string | number | undefined>;
  /** When true, omit the Authorization header (for `/auth/login` etc). */
  unauthenticated?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), BASE_URL + "/");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function request<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (!opts.unauthenticated) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) || `SquadCo ${method} ${path} failed (${res.status})`;
    throw new SquadCoError(message, res.status, payload);
  }

  return payload as T;
}
