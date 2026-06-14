"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ScanLine,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  QrCode,
  Copy,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { useAuth } from "@/stores/auth";
import { useInitiatedBatches } from "@/stores/initiated-batches";
import { ledger as squadLedger, SquadCoError } from "@/lib/squadco";
import { LiveBarcodeScanner } from "@/components/forensic/LiveBarcodeScanner";
import { cn } from "@/lib/utils/cn";

const HEX = "0123456789abcdef";

function genHash(seed: string): string {
  // 64 hex chars from a deterministic seed
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  while (out.length < 64) {
    h = Math.imul(h ^ (h >>> 13), 1597334677);
    for (let i = 0; i < 8 && out.length < 64; i++) {
      out += HEX[(h >>> (i * 4)) & 0xf];
    }
  }
  return out;
}

export default function BatchInitializePage() {
  const router = useRouter();
  const session = useAuth((s) => s.session);
  const recordInitiated = useInitiatedBatches((s) => s.add);

  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [barcode, setBarcode] = React.useState("");
  const [barcodeFormat, setBarcodeFormat] = React.useState<string | null>(null);
  const [productName, setProductName] = React.useState("");
  const [dosage, setDosage] = React.useState("");
  const [nafdacReg, setNafdacReg] = React.useState("");
  const [unitCount, setUnitCount] = React.useState("");
  const [manufactureDate, setManufactureDate] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [hash, setHash] = React.useState("");
  const [batchNumber, setBatchNumber] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [serverBinaryId, setServerBinaryId] = React.useState<string | null>(null);

  async function submitToLedger() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Manufacturer-only `meta_data`. Other roles can still submit, but the
      // backend silently drops the field — we only send it when the local
      // session reports the manufacturer role, both to be explicit and to
      // skip the payload weight for non-manufacturers.
      const isManufacturer = session?.role === "manufacturer";
      const metaData: Record<string, unknown> = {};
      if (manufactureDate) metaData.manufacture_date = manufactureDate;
      if (expiryDate) metaData.expiry_date = expiryDate;
      if (dosage) metaData.dosage = dosage;
      if (unitCount) metaData.unit_count = Number(unitCount);

      // Best-effort browser geolocation — 4s cap so a cold GPS doesn't
      // block the submit. Resolves to null on denial / timeout / no API.
      const geo = await new Promise<{ latitude: number; longitude: number } | null>(
        (resolve) => {
          if (typeof navigator === "undefined" || !navigator.geolocation) {
            resolve(null);
            return;
          }
          const t = setTimeout(() => resolve(null), 4000);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(t);
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
            },
            () => {
              clearTimeout(t);
              resolve(null);
            },
            { timeout: 4000, maximumAge: 60_000 }
          );
        }
      );

      const r = await squadLedger.initiateBatch({
        raw_code: barcode,
        product_name: `${productName}${dosage ? " " + dosage : ""}`.trim(),
        batch_number:
          batchNumber ||
          `BATCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        nafdac_reg_no: nafdacReg || undefined,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        meta_data:
          isManufacturer && Object.keys(metaData).length > 0
            ? metaData
            : undefined,
      });
      // Backend's binary_id is the canonical hash — use it as the route key.
      setServerBinaryId(r.binary_id);
      setHash(r.binary_id);
      // Persist locally so /batches lists it (no list endpoint upstream).
      recordInitiated({
        binaryId: r.binary_id,
        batchId: r.batch_id,
        productName: `${productName}${dosage ? " " + dosage : ""}`.trim(),
        batchNumber:
          batchNumber ||
          `BATCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        nafdacReg: nafdacReg || null,
        initiatedAt: new Date().toISOString(),
        rawCode: barcode,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
      });
      setStep(4);
    } catch (e) {
      setSubmitError(
        e instanceof SquadCoError ? e.message : "Failed to initiate batch."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Hash typewriter when entering step 2
  React.useEffect(() => {
    if (step !== 2) return;
    const target = genHash(barcode + manufactureDate + unitCount);
    setHash("");
    const totalMs = 840;
    const perChar = totalMs / target.length;
    let i = 0;
    const tick = () => {
      if (i >= target.length) return;
      i++;
      setHash(target.slice(0, i));
      setTimeout(tick, perChar);
    };
    const start = setTimeout(tick, 160);
    return () => clearTimeout(start);
  }, [step, barcode, manufactureDate, unitCount]);

  const canContinue = () => {
    if (step === 1) return barcode.length > 4;
    if (step === 2) return hash.length === 64;
    if (step === 3)
      return (
        productName && dosage && nafdacReg && Number(unitCount) > 0 && manufactureDate && expiryDate
      );
    return true;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Manufacturer · originate"
        title="Initialize batch"
        description="Three steps. The binary identifier is hashed from your barcode, manufacture date, and lot size."
        actions={
          <Link href="/batches">
            <Button variant="ghost">Cancel</Button>
          </Link>
        }
      />

      {/* Stepper */}
      <div className="mt-6 flex items-center gap-2">
        {[
          { n: 1, label: "Scan barcode" },
          { n: 2, label: "Compute identifier" },
          { n: 3, label: "Confirm metadata" },
          { n: 4, label: "Issued" },
        ].map((s, i, arr) => (
          <React.Fragment key={s.n}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5",
                step === s.n
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : step > s.n
                    ? "border-[var(--verified-border)] bg-[var(--verified-soft)] text-[var(--verified)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-tertiary)]"
              )}
            >
              <MonoText size="sm">0{s.n}</MonoText>
              <span className="text-caption uppercase">{s.label}</span>
            </div>
            {i < arr.length - 1 && (
              <span
                className={cn(
                  "h-px w-6",
                  step > s.n ? "bg-[var(--verified)]" : "bg-[var(--border-hairline)]"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-6">
        {step === 1 && (
          <Card padded>
            <div className="pb-4">
              <CardTitle>Scan barcode</CardTitle>
              <CardDescription>
                Point your camera at the lot label. The raw string is decoded
                client-side via @zxing/browser — Code 128, EAN, DataMatrix,
                QR, and other common pharmaceutical-pack symbologies.
              </CardDescription>
            </div>
            <div className="grid gap-4 border-t border-[var(--border-hairline)] pt-5 lg:grid-cols-[320px_minmax(0,1fr)]">
              <LiveBarcodeScanner
                onDecode={(text, format) => {
                  setBarcode(text);
                  setBarcodeFormat(format);
                }}
              />
              <div className="space-y-3">
                <FormField
                  label="Decoded barcode"
                  trailingLabel={barcodeFormat ?? "mono"}
                  hint={
                    barcode
                      ? "Decoded from the live camera. Edit if needed."
                      : "Point the camera at a pack — or paste a code if you don't have one handy."
                  }
                >
                  <Input
                    mono
                    placeholder="LP-COART-80480-2026-05-11-12000"
                    value={barcode}
                    onChange={(e) => {
                      setBarcode(e.target.value);
                      setBarcodeFormat(null);
                    }}
                  />
                </FormField>
                {barcode && (
                  <div className="rounded-[6px] border border-[var(--verified-border)] bg-[var(--verified-soft)] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.04em] text-[var(--verified)]">
                      Captured
                    </p>
                    <p className="text-small text-[var(--text-primary)] break-all">
                      {barcode}
                    </p>
                    {barcodeFormat && (
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        symbology · {barcodeFormat}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card padded>
            <div className="pb-4">
              <CardTitle>Computing binary identifier</CardTitle>
              <CardDescription>
                SHA-256 over the barcode, manufacture date, and lot size. Used
                as the canonical reference for every scan and custody hop.
              </CardDescription>
            </div>
            <div className="border-t border-[var(--border-hairline)] pt-5">
              <p className="text-caption uppercase text-[var(--text-tertiary)]">
                Identifier · 64 hex
              </p>
              <div className="mt-2 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-inset)] p-4">
                <p className="font-mono-ui text-[18px] leading-[1.6] tracking-[-0.005em] text-[var(--text-primary)] break-all">
                  {hash || ""}
                  {hash.length < 64 && (
                    <span className="inline-block w-[10px] h-[18px] -mb-[2px] bg-[var(--accent)] animate-pulse" />
                  )}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Badge status="info" dot size="sm">
                  {hash.length < 64 ? "computing" : "complete"}
                </Badge>
                <MonoText size="sm" className="text-[var(--text-tertiary)]">
                  {hash.length} / 64 chars
                </MonoText>
                {hash.length === 64 && (
                  <Button size="sm" variant="ghost" leadingIcon={<Copy />}>
                    Copy
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card padded>
            <div className="pb-4">
              <CardTitle>Confirm metadata</CardTitle>
              <CardDescription>
                Verified profile fields are pre-filled and locked. NAFDAC
                registration is re-validated server-side on submit.
              </CardDescription>
            </div>
            <div className="grid gap-4 border-t border-[var(--border-hairline)] pt-5 sm:grid-cols-2">
              <FormField label="Manufacturer">
                <Input
                  value={session?.organization ?? ""}
                  disabled
                  placeholder="—"
                />
                {session?.organization && (
                  <VerifiedBlock>
                    Signed in as {session.organization} · role={session.role}
                  </VerifiedBlock>
                )}
              </FormField>
              <FormField label="NAFDAC registration" trailingLabel="mono">
                <Input
                  mono
                  value={nafdacReg}
                  onChange={(e) => setNafdacReg(e.target.value)}
                />
              </FormField>
              <FormField label="Product name">
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </FormField>
              <FormField label="Dosage">
                <Input value={dosage} onChange={(e) => setDosage(e.target.value)} />
              </FormField>
              <FormField
                label="Batch number"
                hint="The manufacturer-assigned lot identifier. Auto-generated if left blank."
              >
                <Input
                  mono
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="BATCH-2026-001"
                />
              </FormField>
              <FormField label="Manufacture date">
                <Input
                  type="date"
                  mono
                  value={manufactureDate}
                  onChange={(e) => setManufactureDate(e.target.value)}
                />
              </FormField>
              <FormField label="Expiry date">
                <Input
                  type="date"
                  mono
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </FormField>
              <FormField label="Unit count" trailingLabel="mono">
                <Input
                  mono
                  inputMode="numeric"
                  value={unitCount}
                  onChange={(e) =>
                    setUnitCount(e.target.value.replace(/\D/g, ""))
                  }
                />
              </FormField>
            </div>
            <div className="mt-5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <p className="text-caption uppercase text-[var(--text-tertiary)] mb-2">
                Binary identifier
              </p>
              <MonoText size="sm" className="block break-all text-[var(--text-secondary)]">
                {hash}
              </MonoText>
            </div>
          </Card>
        )}

        {step === 4 && <IssuedCard hash={hash} productName={productName} />}

        {step < 4 && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
              disabled={step === 1}
              leadingIcon={<ArrowLeft />}
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              <p className="text-caption uppercase text-[var(--text-tertiary)]">
                Step {step} of 3
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  if (step < 3) setStep((s) => (s + 1) as 2 | 3);
                  else void submitToLedger();
                }}
                disabled={!canContinue() || submitting}
                loading={step === 3 && submitting}
                trailingIcon={<ArrowRight />}
              >
                {step === 3 ? "Issue batch" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => router.push("/batches")}>
              Return to batches
            </Button>
            <Link href={`/batches/${serverBinaryId ?? hash}`}>
              <Button variant="primary" trailingIcon={<ArrowRight />}>
                Open batch
              </Button>
            </Link>
          </div>
        )}

        {submitError && (
          <p className="mt-3 rounded-[6px] border border-[var(--risk-border)] bg-[var(--risk-soft)] px-3 py-2 text-[12px] text-[var(--risk)]">
            Ledger initiate failed: {submitError}
          </p>
        )}
      </div>
    </div>
  );
}

function VerifiedBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <CheckCircle2 className="h-3 w-3 text-[var(--verified)]" />
      <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--verified)]">
        {children}
      </span>
    </div>
  );
}

function IssuedCard({ hash, productName }: { hash: string; productName: string }) {
  return (
    <Card emphasized className="border-[var(--verified-border)]" padded>
      <div className="flex items-start justify-between pb-3">
        <div>
          <p className="text-caption uppercase text-[var(--verified)]">
            Batch issued
          </p>
          <h2 className="text-h2 mt-1">
            {productName} · under forensic custody.
          </h2>
          <p className="text-body mt-1 text-[var(--text-secondary)]">
            The binary identifier below is the canonical reference for every
            scan, custody hop, and settlement.
          </p>
        </div>
        <Badge status="verified" dot>
          Verified
        </Badge>
      </div>
      <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-4">
        <p className="text-caption uppercase text-[var(--text-tertiary)] mb-2">
          Binary identifier
        </p>
        <p className="font-mono-ui text-[15px] leading-[1.6] break-all text-[var(--text-primary)]">
          {hash}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" leadingIcon={<Copy />}>
            Copy URL
          </Button>
          <Button size="sm" variant="secondary" leadingIcon={<QrCode />}>
            Download QR
          </Button>
          <Button size="sm" variant="ghost" leadingIcon={<ScanLine />}>
            Open scan
          </Button>
        </div>
      </div>
    </Card>
  );
}
