"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Upload,
  RefreshCw,
  ShieldCheck,
  Fingerprint,
  Landmark,
  Building2,
  FileText,
  MapPin,
  ExternalLink,
  AtSign,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { useAuth } from "@/stores/auth";
import { findUser } from "@/lib/mock-api/fixtures/users";
import { formatBVN, formatNUBAN } from "@/lib/utils/format";

interface CheckRow {
  id: string;
  label: string;
  evidence: string;
  status: "verified" | "warning" | "expired";
  expiresInDays?: number;
  icon: React.ComponentType<{ className?: string }>;
}

export default function IdentitySettingsPage() {
  const session = useAuth((s) => s.session);
  const profile = session ? findUser(session.userId) : undefined;

  // Trust history — 12 weekly samples, anchored on current score
  const trustSeries = React.useMemo(() => {
    const score = session?.trustScore ?? 80;
    const out: number[] = [];
    let v = score - 6 + Math.random() * 2;
    for (let i = 0; i < 12; i++) {
      v += (Math.random() - 0.45) * 1.4;
      v = Math.max(40, Math.min(100, v));
      out.push(Number(v.toFixed(1)));
    }
    out[out.length - 1] = score;
    return out;
  }, [session?.trustScore]);

  const rows: CheckRow[] = [
    {
      id: "bvn",
      label: "Bank Verification Number",
      evidence: profile ? formatBVN(profile.bvn) : "—",
      status: "verified",
      icon: Fingerprint,
    },
    {
      id: "nuban",
      label: "NUBAN · Squad resolve",
      evidence: profile
        ? `${profile.bankName} · ${formatNUBAN(profile.nuban)}`
        : "—",
      status: "verified",
      icon: Landmark,
    },
    {
      id: "cac",
      label: "CAC RC Number",
      evidence: profile ? `${profile.cacRC} · ${profile.cacStatus}` : "—",
      status: profile?.cacStatus === "ACTIVE" ? "verified" : "warning",
      icon: Building2,
    },
    {
      id: "firs",
      label: "FIRS TIN",
      evidence: profile ? profile.firsTin : "—",
      status: "verified",
      icon: FileText,
    },
    {
      id: "pcn",
      label: "PCN Premise License",
      evidence: profile?.pcnPremise ?? "Not on file",
      status:
        profile?.pcnStatus === "ACTIVE"
          ? "verified"
          : profile?.pcnStatus === "EXPIRED"
            ? "expired"
            : "warning",
      expiresInDays: 84,
      icon: ShieldCheck,
    },
    {
      id: "places",
      label: "Premise address · Google Places",
      evidence: profile ? `${profile.placesType} · ${(profile.placesConfidence * 100).toFixed(0)}%` : "—",
      status: profile?.placesType === "INDUSTRIAL" || profile?.placesType === "COMMERCIAL" ? "verified" : "warning",
      icon: MapPin,
    },
    {
      id: "linkedin",
      label: "Digital footprint · LinkedIn",
      evidence: profile?.linkedinEmployees
        ? `${profile.linkedinEmployees} employees · founded ${profile.linkedinFounded}`
        : "—",
      status: "verified",
      icon: ExternalLink,
    },
    {
      id: "email",
      label: "Work email domain",
      evidence: profile ? profile.workEmailDomain : "—",
      status: "verified",
      icon: AtSign,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Settings · identity"
        title="Identity Wall"
        description="Your verification ledger. Re-verify any check, upload fresh documents, audit your trust score history."
        actions={
          <Button variant="primary" leadingIcon={<RefreshCw />}>
            Re-verify all
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Trust history */}
        <Card emphasized padded>
          <div className="flex items-start justify-between pb-3">
            <div>
              <p className="text-caption uppercase text-[var(--text-tertiary)]">
                Trust score · 12 weeks
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <MonoText size="lg" className="text-[40px] leading-none tracking-[-0.02em]">
                  {(session?.trustScore ?? 0).toFixed(1)}
                </MonoText>
                <Badge
                  status={
                    (session?.tier ?? "limited") === "verified"
                      ? "verified"
                      : (session?.tier ?? "limited") === "limited"
                        ? "pending"
                        : "risk"
                  }
                  dot
                >
                  {session?.tier ?? "limited"} tier
                </Badge>
              </div>
              <p className="text-small mt-1 text-[var(--text-secondary)]">
                8 of 8 checks live · last recomputed 4 minutes ago.
              </p>
            </div>
            <MonoText size="sm" className="text-[var(--text-tertiary)]">
              {session?.userId}
            </MonoText>
          </div>
          <Sparkline data={trustSeries} color="var(--verified)" height={64} unit="score" />
        </Card>

        {/* Document re-upload */}
        <Card padded>
          <div className="pb-3">
            <CardTitle>Document re-upload</CardTitle>
            <CardDescription>
              Replace any expiring license. We re-run the relevant Identity Wall
              check on upload.
            </CardDescription>
          </div>
          <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
            <DocSlot
              label="PCN Premise License"
              expiresIn="84 days"
              tone="pending"
            />
            <DocSlot
              label="CAC certificate · scan"
              expiresIn="3 years"
              tone="verified"
            />
            <DocSlot
              label="Premise photo"
              expiresIn="rolling"
              tone="neutral"
            />
          </div>
        </Card>
      </div>

      <Card padded className="mt-6">
        <div className="flex items-start justify-between pb-3">
          <div>
            <CardTitle>Verification checks · live registry</CardTitle>
            <CardDescription>
              Each row carries the original evidence and lets you re-resolve.
            </CardDescription>
          </div>
          <Badge status="verified" size="sm" dot>
            8 / 8 verified
          </Badge>
        </div>
        <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
          {rows.map((r) => (
            <CheckLine key={r.id} row={r} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function CheckLine({ row }: { row: CheckRow }) {
  const Icon = row.icon;
  const tone =
    row.status === "verified"
      ? { color: "var(--verified)", border: "var(--verified-border)", bg: "var(--verified-soft)", icon: <CheckCircle2 className="h-3 w-3" /> }
      : row.status === "warning"
        ? { color: "var(--pending)", border: "var(--pending-border)", bg: "var(--pending-soft)", icon: <AlertTriangle className="h-3 w-3" /> }
        : { color: "var(--risk)", border: "var(--risk-border)", bg: "var(--risk-soft)", icon: <XCircle className="h-3 w-3" /> };
  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[8px] border bg-[var(--bg-inset)] px-3 py-2.5"
      style={{ borderColor: row.status === "verified" ? "var(--border-hairline)" : tone.border }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-[6px] border"
        style={{ borderColor: tone.border, background: tone.bg, color: tone.color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-small font-medium text-[var(--text-primary)]">
          {row.label}
        </p>
        <MonoText size="sm" className="text-[var(--text-secondary)] truncate block">
          {row.evidence}
        </MonoText>
      </div>
      <div className="min-w-0 text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
        {row.expiresInDays
          ? `expires in ${row.expiresInDays} days`
          : "no expiry"}
      </div>
      <Badge
        size="sm"
        status={row.status === "verified" ? "verified" : row.status === "warning" ? "pending" : "risk"}
        dot
      >
        <span style={{ color: "currentColor" }}>{tone.icon}</span>
        {row.status}
      </Badge>
      <Button size="sm" variant="ghost" leadingIcon={<RefreshCw />}>
        Re-verify
      </Button>
    </div>
  );
}

function DocSlot({
  label,
  expiresIn,
  tone,
}: {
  label: string;
  expiresIn: string;
  tone: "verified" | "pending" | "neutral";
}) {
  const c =
    tone === "verified"
      ? "var(--verified)"
      : tone === "pending"
        ? "var(--pending)"
        : "var(--text-tertiary)";
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2.5 hover:border-[var(--border-strong)]">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-elevated)]"
        style={{ color: c }}
      >
        <Upload className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-small font-medium text-[var(--text-primary)] truncate">
          {label}
        </p>
        <p className="text-[11px] text-[var(--text-tertiary)]">
          expires in {expiresIn}
        </p>
      </div>
      <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
        JPG · PNG · PDF · 8 MB
      </span>
      <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="sr-only" />
    </label>
  );
}
