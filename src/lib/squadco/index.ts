/**
 * SquadCo backend client surface.
 *
 *   import { auth, wallet, ledger, risk } from "@/lib/squadco";
 *
 * For low-level JWT/token plumbing use `client` directly.
 */
export * as auth from "./auth";
export * as wallet from "./wallet";
export * as ledger from "./ledger";
export * as risk from "./risk";
export * from "./client";
export type * from "./types";
