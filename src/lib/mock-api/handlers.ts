/**
 * Mock Service Worker handlers.
 *
 * Historically MSW intercepted same-origin `/api/...` calls and returned
 * fixture data. With the SquadCo backend (auth · ledger · wallet · risk)
 * and the forensic FastAPI backend both served from absolute URLs, every
 * /api/... call from the frontend bypasses MSW. There is nothing left
 * for the worker to intercept.
 *
 * The fixtures (`./fixtures/*`) are still imported directly by
 * components for the demo-only surfaces documented in MISMATCHES.md
 * (batch list, custody timeline, alert cards, etc.) — they're just no
 * longer routed through MSW.
 *
 * Kept as an empty array so the Providers wiring doesn't have to change
 * and the worker can still be started in case future routes need it.
 */
export const handlers: never[] = [];
