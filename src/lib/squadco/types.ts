/**
 * Typed wire shapes for the SquadCo backend at
 * https://anjolaakins-testsquadco.hf.space.
 *
 * These mirror the API documentation verbatim. Field names use snake_case
 * because the backend ships snake_case — we deliberately do not camelize
 * at the boundary so a grep for a field name in the docs lands in code.
 */

// ─── Common ──────────────────────────────────────────────────────────────

export type Role = "manufacturer" | "wholesaler" | "retailer";

/** Most endpoints return `{status: "success", data: {...}}`; a few don't. */
export interface SquadCoEnvelope<T> {
  status: "success" | "error";
  message?: string;
  data: T;
}

// ─── Auth ────────────────────────────────────────────────────────────────

export interface RequestOtpRequest {
  email: string;
  purpose?: "registration" | "work_email_verification";
}

export interface RequestOtpResponse {
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: Role;
  first_name: string;
  last_name: string;
  phone_number: string;
  nin: string;
  otp: string;
  company_name: string;
  industry_type?: string;
  address?: string;
  rc_number?: string;
  classification?: string;
  social_links?: Array<{ platform: string; url: string }>;
}

export interface RegisterResponse {
  message: string;
  access_token: string;
  user: {
    id: string;
    email: string;
    role: Role;
  };
  business_profile: {
    id: string;
    company_name: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  access_token: string;
  role: Role;
}

export interface UpdateProfileRequest {
  company_name?: string;
  industry_type?: string;
  address?: string;
  website_url?: string;
  work_email?: string;
  rc_number?: string;
  pcn_number?: string;
  tin_number?: string;
  classification?: string;
  social_links?: Array<{ platform: string; url: string }>;
}

// ─── Ledger ──────────────────────────────────────────────────────────────

export interface InitiateBatchRequest {
  raw_code: string;
  product_name: string;
  batch_number: string;
  nafdac_reg_no?: string;
  latitude?: number;
  longitude?: number;
  /**
   * Unstructured product information (expiry date, storage condition,
   * chemical composition, etc.). Backend restriction: only accepted from
   * users whose role is `manufacturer` — the field is silently dropped for
   * wholesalers / retailers.
   */
  meta_data?: Record<string, unknown>;
}

export interface InitiateBatchResponse {
  message: string;
  batch_id: string;
  binary_id: string;
}

export interface ScanProductRequest {
  binary_id: string;
  latitude?: number;
  longitude?: number;
  session_fingerprint?: string;
}

export interface ScanProductResponse {
  message: string;
  batch_id: string;
  scan_type: "official" | "community";
}

export interface LedgerJourneyStep {
  timestamp: string;
  scanned_by_business: string;
  resolved_location: string;
  latitude: number;
  longitude: number;
  ai_verdict: boolean;
  transfer_status: string;
}

export interface LedgerCommunityScan {
  timestamp: string;
  resolved_location?: string;
  latitude?: number;
  longitude?: number;
}

export interface LedgerHistoryResponse {
  product: {
    name: string;
    batch_number: string;
    nafdac_reg_no: string | null;
    initiated_at: string;
  };
  official_journey: LedgerJourneyStep[];
  community_scans: LedgerCommunityScan[];
}

// ─── Risk ────────────────────────────────────────────────────────────────

export interface RiskSuspendedVendor {
  id?: string;
  email?: string;
  company_name?: string;
  reason?: string;
  suspended_at?: string;
}

export interface RiskFraudBlockedTransaction {
  transaction_reference?: string;
  amount?: number;
  reason?: string;
  blocked_at?: string;
  from_user?: string;
  to_user?: string;
}

export interface RiskAlertsData {
  suspended_vendors: RiskSuspendedVendor[];
  fraud_blocked_transactions: RiskFraudBlockedTransaction[];
}

export interface SuspendVendorRequest {
  vendor_id: string;
  reason?: string;
}

export interface SuspendVendorResponseData {
  frozen_pending_transactions_count: number;
}

// ─── Wallet ──────────────────────────────────────────────────────────────

export interface CreateWalletRequest {
  bvn: string;
  dob: string;
  gender: "1" | "2";
  address: string;
  beneficiary_account: string;
}

export interface CreateWalletResponseData {
  virtual_account_number: string;
  bank_name: string;
}

export interface WalletBalanceData {
  balance: number;
  virtual_account_number: string;
  bank_code: string;
  beneficiary_account: string;
  last_updated: string;
}

export type WalletTxnType = "CREDIT" | "DEBIT";
export type WalletTxnStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "FROZEN"
  | "FRAUD_BLOCKED";

export interface WalletTransaction {
  transaction_reference: string;
  amount: number;
  transaction_type: WalletTxnType;
  status: WalletTxnStatus;
  remarks: string | null;
  created_at: string;
}

export interface WalletTransactionsData {
  transactions: WalletTransaction[];
  total_items: number;
  total_pages: number;
  current_page: number;
}

export interface TransferRequest {
  to_user_id: string;
  amount: number;
  remarks?: string;
}

export interface TransferResponseData {
  transaction_reference: string;
  amount: number;
}
