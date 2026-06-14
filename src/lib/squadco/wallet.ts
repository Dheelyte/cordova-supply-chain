import { request } from "./client";
import type {
  CreateWalletRequest,
  CreateWalletResponseData,
  SquadCoEnvelope,
  TransferRequest,
  TransferResponseData,
  WalletBalanceData,
  WalletTransactionsData,
} from "./types";

/** `POST /wallet/create` — provisions an NGN virtual account (KYC required). */
export async function createWallet(
  input: CreateWalletRequest
): Promise<CreateWalletResponseData> {
  const r = await request<SquadCoEnvelope<CreateWalletResponseData>>(
    "/wallet/create",
    { method: "POST", body: input }
  );
  return r.data;
}

/** `GET /wallet/` — balance + virtual-account metadata. */
export async function getWallet(): Promise<WalletBalanceData> {
  const r = await request<SquadCoEnvelope<WalletBalanceData>>("/wallet/");
  return r.data;
}

/** `GET /wallet/transactions` — paginated CREDIT/DEBIT history. */
export async function getTransactions(
  page = 1,
  perPage = 20
): Promise<WalletTransactionsData> {
  const r = await request<SquadCoEnvelope<WalletTransactionsData>>(
    "/wallet/transactions",
    { query: { page, per_page: perPage } }
  );
  return r.data;
}

/** `POST /wallet/transfer` — internal transfer to another SquadCo user. */
export async function transfer(
  input: TransferRequest
): Promise<TransferResponseData> {
  const r = await request<SquadCoEnvelope<TransferResponseData>>(
    "/wallet/transfer",
    { method: "POST", body: input }
  );
  return r.data;
}
