# SquadCo backend ↔ Aegis frontend mismatches

This document tracks places where the **deployed SquadCo backend** at
`https://anjolaakins-testsquadco.hf.space` and the **Aegis frontend** disagree
on shape or capability. The frontend ships a richer UX in several areas
than the backend currently models; rather than dumb the UI down to the
backend's wire shape, we keep the mock-driven content for those surfaces
and document the gap here so future backend work has a punch list.

Conventions:
- **Hard mismatch** — UI calls the backend and the request will fail or
  produce a nonsensical result until the backend changes.
- **Soft mismatch** — UI keeps mock-driven content alongside live data
  from the backend. Demo continues to work; production needs both.

---

## 1. No "list batches owned by user" endpoint — soft

**Backend:** Only `GET /ledger/history/{binary_id}` exists; you must know
the `binary_id` ahead of time.
**Frontend uses:** `/batches` page lists every batch the operator owns.

The `/batches` index page reads from a **local persisted store**
(`useInitiatedBatches` → `aegis.initiated-batches` in localStorage)
populated every time the user successfully calls `POST /ledger/initiate`.
The list shows what *this browser* initiated — accurate but not
authoritative; a user signing in on a fresh browser sees an empty list
until they initiate something. The detail page (`/batches/[id]`) fetches
the live `/ledger/history/{binary_id}` for the canonical provenance.

**To remove this mismatch:** add `GET /ledger/batches` (paginated, scoped
to authenticated business) returning at minimum
`{batch_id, binary_id, product_name, batch_number, initiated_at, scan_count}`.
The list page can then swap the local store for a TanStack Query fetch.

---

## 2. No "search users by email/name" endpoint — hard

**Backend:** `POST /wallet/transfer` requires `to_user_id` (UUID).
**Frontend uses:** Pending settlements name the counterparty by display
string ("Idumota Health Distribution"); no UUID is available.

`SettlementCard.handleComplete` calls `/wallet/transfer` **only when the
counterparty id matches a UUID regex**. Mock counterparties (e.g.
`usr_3f1a82c7e9d4`) skip the real call and the local state-machine
"settles" them; the funds don't actually move on the SquadCo side.

**To remove this mismatch:** add `GET /users/search?q=...` returning
`[{id, email, company_name, role}]` so the frontend can resolve the
recipient UUID before calling `/wallet/transfer`.

---

## 3. No "get current user / session" endpoint — soft

**Backend:** `/auth/login` returns `{access_token, role}` only — no user
id, name, or business profile. `/auth/register` returns the user object
in full.
**Frontend uses:** Sidebar avatar, dashboard greeting, batch detail
"manufacturer" field all want `name` and `organization`.

After `/auth/login` we synthesise a session from the email's local-part
and leave `organization=""`, `trustScore=0`. After registration we have
the real data and use it.

**To remove this mismatch:** add `GET /auth/me` returning the user's
profile (`{id, email, role, first_name, last_name, company_name, ...}`).

---

## 4. Wallet has no "pending settlement" concept — soft

**Backend:** Wallet supports only `balance`, `transactions[]`, and
`POST /wallet/transfer` (executes immediately).
**Frontend uses:** A `PendingSettlement[]` queue with `aiVerdict`,
`ledgerPath`, `linkedScanSessionId`, `verdictScore` — gating each
transfer through an AI verdict.

The pending-settlements UX (`/wallet` page) is a frontend-only construct
in `useWallet`. The AI gate is enforced **client-side** before the
transfer call goes out. Once the operator clicks "Release payment", the
real `/wallet/transfer` runs (when the counterparty id is a real UUID;
see #2).

**To remove this mismatch:** add a "transfer with verdict" endpoint —
e.g. `POST /wallet/transfer-with-verdict` accepting
`{to_user_id, amount, scan_session_id, ai_verdict, consensus_score}` so
the backend can record the forensic context in the ledger alongside the
debit.

---

## 5. Ledger history shape vs custody timeline — soft

**Backend:** Returns `official_journey[{timestamp, scanned_by_business,
resolved_location, lat, lng, ai_verdict: boolean, transfer_status}]`.
**Frontend uses:** Rich `CustodyHop` with `actorRole`, `deviceFingerprint`,
signed `signature`, optional `anomaly` block with detected reasons.

The batch detail page renders the backend's `official_journey` minimally
(actor + verdict + location + timestamp) when the route id is a server
binary_id; the rich `CustodyTimeline` / `JourneyMap` / `AnomalyBanner`
components still render against `MOCK_BATCHES` for mock ids.

**To remove this mismatch:** extend each journey step with
`actor_id, actor_role, signature, anomaly?: {kind, detail, ...}`.

---

## 6. Risk feed minimal shape — soft

**Backend:** `GET /risk/alerts` returns only
`{suspended_vendors: [], fraud_blocked_transactions: []}`.
**Frontend uses:** `Alert[]` with `severity`, `state`, `linkedScanId`,
`linkedBatchId`, formatted titles + reasons.

The `/risk` page shows a "Live · /risk/alerts" strip with real counts,
but the rich alert cards stay backed by `makeAlerts(...)` mock data. The
suspend-vendor action calls `/risk/suspend-vendor` if the vendor id is a
real UUID; otherwise the suspension is local-only.

**To remove this mismatch:** expand alert shape to include severity,
state, linked scan ids, and human-readable title/reason.

---

## 7. Role enum is narrower on the backend — hard

**Backend:** `role` ∈ `{manufacturer, wholesaler, retailer}`.
**Frontend uses:** Same three + `consumer` and `regulator` (UI-only roles).

Login response coerces to the three backend roles. The `consumer` /
`regulator` lanes in the onboarding / role-card UX don't actually
register against the backend — they would fail at `/auth/register`. The
`/register` route only offers the three backend roles.

---

## 8. Wallet creation needs KYC, not modelled in onboarding — hard

**Backend:** `POST /wallet/create` requires `{bvn, dob, gender,
address, beneficiary_account}` and provisions an NGN virtual account.
**Frontend:** No surface currently calls this.

**Required follow-up:** Add a "Create wallet" CTA on the wallet page
(visible when `GET /wallet/` 404s on a freshly-registered user) that
walks the KYC form, then triggers the balance + transactions refetch on
success.

---

## 9. Forensic scan pipeline is a separate backend — by design

The forensic scan pipeline (`POST /api/scan`, SSE `/stream`, etc.) lives
in the local FastAPI service at `backend/`. It is **not** part of the
SquadCo backend and is deployed separately. The `NEXT_PUBLIC_AEGIS_API_BASE`
env var points at the forensic backend; `NEXT_PUBLIC_SQUADCO_API_BASE`
points at SquadCo. They share nothing on the wire.

---

## 10. Onboarding wizard's verification fields aren't accepted at registration — soft

**Backend register fields:** `email, password, role, first_name,
last_name, phone_number, nin, otp, company_name, industry_type?,
address?, rc_number?, classification?, social_links?`.
**Onboarding form collects:** BVN, NUBAN, bank, CAC RC, FIRS TIN,
PCN premise, LinkedIn, address — none of which (except `address` and
`rc_number`) are accepted on `/auth/register`.

The `/onboarding` page is now a **design showcase** of the Identity Wall
UX. The real registration flow lives at `/register` and only collects
fields the backend accepts. The login page's "Create account" CTA goes
to `/register`; the showcase is linked from `/register` as a forward-
looking design.
