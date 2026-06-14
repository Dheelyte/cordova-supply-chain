"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { auth as squadAuth, clearToken, setToken } from "@/lib/squadco";
import type { Role as BackendRole } from "@/lib/squadco";

/**
 * Frontend role enum is broader than the backend's. The backend supports
 * manufacturer / wholesaler / retailer only. The UI still ships
 * `consumer` + `regulator` for views that don't yet have backend coverage
 * (see MISMATCHES.md); they map to no backend role when signing in.
 */
export type Role =
  | "manufacturer"
  | "wholesaler"
  | "retailer"
  | "consumer"
  | "regulator";

export type VerificationTier = "unverified" | "limited" | "verified";

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  organization: string;
  trustScore: number;
  tier: VerificationTier;
  initials: string;
}

interface AuthState {
  session: Session | null;
  hydrated: boolean;
  /** Wraps `POST /auth/login` + persists the JWT + minimum session. */
  login: (email: string, password: string) => Promise<void>;
  /** Sets a session directly (used after register, when we already have user data). */
  setSession: (session: Session) => void;
  signOut: () => void;
  setRole: (role: Role) => void;
  setTrustScore: (score: number, tier: VerificationTier) => void;
  _hydrate: () => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function backendRoleToFrontend(role: BackendRole): Role {
  return role;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      login: async (email, password) => {
        const r = await squadAuth.login({ email, password });
        setToken(r.access_token);
        // Backend's /auth/login response is intentionally minimal (just
        // role + token). We synthesise a placeholder session here; a
        // future GET /auth/me would let us fill name/organization for real.
        set({
          session: {
            userId: "",
            name: email.split("@")[0] ?? "User",
            email,
            role: backendRoleToFrontend(r.role),
            organization: "",
            trustScore: 0,
            tier: "unverified",
            initials: initials(email.split("@")[0] ?? "U"),
          },
        });
      },
      setSession: (session) => set({ session }),
      signOut: () => {
        clearToken();
        set({ session: null });
      },
      setRole: (role) =>
        set((s) => (s.session ? { session: { ...s.session, role } } : s)),
      setTrustScore: (trustScore, tier) =>
        set((s) =>
          s.session ? { session: { ...s.session, trustScore, tier } } : s
        ),
      _hydrate: () => set({ hydrated: true }),
    }),
    {
      name: "aegis.auth",
      onRehydrateStorage: () => (state) => {
        state?._hydrate();
      },
    }
  )
);
