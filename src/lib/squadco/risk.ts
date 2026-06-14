import { request } from "./client";
import type {
  RiskAlertsData,
  SquadCoEnvelope,
  SuspendVendorRequest,
  SuspendVendorResponseData,
} from "./types";

/** `GET /risk/alerts` — regulator-dashboard data. */
export async function getAlerts(): Promise<RiskAlertsData> {
  const r = await request<SquadCoEnvelope<RiskAlertsData>>("/risk/alerts");
  return r.data;
}

/** `POST /risk/suspend-vendor` — freeze a vendor + their pending debits. */
export async function suspendVendor(
  input: SuspendVendorRequest
): Promise<SuspendVendorResponseData> {
  const r = await request<SquadCoEnvelope<SuspendVendorResponseData>>(
    "/risk/suspend-vendor",
    { method: "POST", body: input }
  );
  return r.data;
}
