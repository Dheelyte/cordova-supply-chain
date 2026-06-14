"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import {
  OnboardingStepRail,
  type StepDef,
} from "@/components/identity/OnboardingStepRail";
import { RoleCard, SELECTABLE_ROLES } from "@/components/identity/RoleCard";
import { TrustScoreCard } from "@/components/identity/TrustScoreCard";
import { VerificationRow } from "@/components/identity/VerificationRow";
import { ForensicTrace } from "@/components/identity/ForensicTrace";
import { useVerificationStream } from "@/hooks/use-verification-stream";
import type { VerificationCheck } from "@/lib/mock-api/ws-simulator";
import { useAuth, type Role } from "@/stores/auth";
import { cn } from "@/lib/utils/cn";

const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank",
  "Ecobank",
  "FCMB",
  "Fidelity Bank",
  "First Bank",
  "GTBank",
  "Heritage Bank",
  "Keystone Bank",
  "Kuda",
  "Opay",
  "Palmpay",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC",
  "Standard Chartered",
  "Sterling Bank",
  "SunTrust",
  "UBA",
  "Union Bank",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
];

const FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];

type VerificationScript =
  | "good_vendor"
  | "ghost_tin_mismatch"
  | "ghost_residential";

interface Form {
  role: Role | null;
  email: string;
  password: string;
  bvn: string;
  bank: string;
  nuban: string;
  nubanResolved: { status: "idle" | "checking" | "match" | "mismatch"; name?: string };
  cacRc: string;
  firsTin: string;
  pcnPremise: string;
  address: string;
  linkedinUrl: string;
}

const INITIAL_FORM: Form = {
  role: null,
  email: "",
  password: "",
  bvn: "",
  bank: "",
  nuban: "",
  nubanResolved: { status: "idle" },
  cacRc: "",
  firsTin: "",
  pcnPremise: "",
  address: "",
  linkedinUrl: "",
};

function getPasswordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (pw.length >= 12) score = (score + 1) as typeof score;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score = (score + 1) as typeof score;
  if (/\d/.test(pw)) score = (score + 1) as typeof score;
  if (/[^A-Za-z0-9]/.test(pw)) score = (score + 1) as typeof score;
  const labels = ["Too short", "Weak", "Fair", "Strong", "Forensic-grade"] as const;
  return { score, label: labels[score] };
}

export default function OnboardingPage() {
  const router = useRouter();
  // The onboarding wizard is a design showcase (see MISMATCHES.md #10);
  // we use the auth store's direct session-setter rather than the real
  // /auth/login flow because none of the wizard's collected fields are
  // accepted by the SquadCo /auth/register endpoint.
  const setSession = useAuth((s) => s.setSession);

  const [form, setForm] = React.useState<Form>(INITIAL_FORM);
  const [step, setStep] = React.useState(1);
  const [script, setScript] = React.useState<VerificationScript | null>(null);
  const isConsumer = form.role === "consumer";

  // Verification stream lives once we hit step 5
  const stream = useVerificationStream();
  const expectedChecks: VerificationCheck[] = React.useMemo(() => {
    const base: VerificationCheck[] = [
      "squad_bvn",
      "squad_nuban",
      "google_places",
      "work_email",
    ];
    if (!isConsumer) {
      base.splice(2, 0, "cac", "firs_tin", "pcn");
      base.push("linkedin");
    }
    return base;
  }, [isConsumer]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // NUBAN resolve on blur — calls Squad NUBAN Resolve and surfaces the
  // returned account-holder name.
  const resolveNuban = React.useCallback(async () => {
    if (form.nuban.length !== 10 || !form.bank) return;
    set("nubanResolved", { status: "checking" });
    await new Promise((r) => setTimeout(r, 630));
    const namePart =
      form.email.split("@")[0]?.split(".")[0]?.toUpperCase() ?? "ACCOUNT";
    set("nubanResolved", {
      status: "match",
      name: `${namePart} HOLDER`,
    });
  }, [form.nuban, form.bank, form.email]);

  // Step validation
  const passwordStrength = getPasswordStrength(form.password);
  const emailDomain = form.email.split("@")[1]?.toLowerCase() ?? "";
  const emailDomainBlocked =
    !isConsumer && FREE_EMAIL_DOMAINS.includes(emailDomain);

  const canProceed = (() => {
    if (step === 1) {
      return (
        !!form.role &&
        form.email.includes("@") &&
        !emailDomainBlocked &&
        passwordStrength.score >= 2
      );
    }
    if (step === 2) {
      return (
        form.bvn.length === 11 &&
        form.bank.length > 0 &&
        form.nuban.length === 10 &&
        form.nubanResolved.status === "match"
      );
    }
    if (step === 3) {
      if (isConsumer) return true;
      return (
        form.cacRc.length >= 6 && form.firsTin.length >= 6 && form.address.length > 6
      );
    }
    if (step === 4) {
      if (isConsumer) return true;
      return form.linkedinUrl.startsWith("http");
    }
    return true;
  })();

  const steps: StepDef[] = [
    {
      id: "role",
      label: "Role & account",
      description: "Choose lane · corporate email",
      status: step > 1 ? "complete" : step === 1 ? "active" : "pending",
    },
    {
      id: "gov",
      label: "Government identity",
      description: "BVN · NUBAN · bank",
      status: step > 2 ? "complete" : step === 2 ? "active" : "pending",
    },
    {
      id: "corp",
      label: "Corporate identity",
      description: isConsumer ? "Not required" : "CAC · FIRS · PCN",
      status: isConsumer
        ? "skipped"
        : step > 3
          ? "complete"
          : step === 3
            ? "active"
            : "pending",
    },
    {
      id: "digital",
      label: "Digital footprint",
      description: isConsumer ? "Not required" : "LinkedIn · premise photo",
      status: isConsumer
        ? "skipped"
        : step > 4
          ? "complete"
          : step === 4
            ? "active"
            : "pending",
    },
    {
      id: "verify",
      label: "Live verification",
      description: "Trust score · forensic trace",
      status: step === 5 ? "active" : step > 5 ? "complete" : "pending",
    },
  ];

  function next() {
    let target = step + 1;
    // Skip corporate + digital for consumer
    if (isConsumer && (target === 3 || target === 4)) target = 5;
    if (target === 5 && !script) {
      // Pick the verification script from the form's evidence — never shown
      // to the user. Free webmail or a placeholder TIN signals an unverified
      // vendor; otherwise we run the full verification path.
      if (FREE_EMAIL_DOMAINS.includes(emailDomain)) {
        setScript("ghost_residential");
      } else if (form.firsTin.startsWith("0000")) {
        setScript("ghost_tin_mismatch");
      } else {
        setScript("good_vendor");
      }
    }
    setStep(target);
  }

  function back() {
    let target = step - 1;
    if (isConsumer && (target === 3 || target === 4)) target = 2;
    setStep(Math.max(1, target));
  }

  // Kick off verification when we land on step 5
  React.useEffect(() => {
    if (step !== 5) return;
    if (!script) return;
    stream.start(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, script]);

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Rail */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Identity Wall
          </p>
          <h1 className="text-h2 mt-1">Pass verification.</h1>
          <p className="text-small mt-1 text-[var(--text-secondary)]">
            5 steps. {isConsumer ? "Consumer lane skips corporate checks." : "Every check is evidence-backed."}
          </p>
          <div className="mt-5">
            <OnboardingStepRail
              steps={steps}
              onSelectStep={(id) => {
                const idx = steps.findIndex((s) => s.id === id);
                if (idx !== -1) setStep(idx + 1);
              }}
            />
          </div>
        </aside>

        {/* Active step */}
        <section className="min-w-0">
          {step === 1 && (
            <StepCard
              eyebrow="Step 1"
              title="Role & account"
              description="Choose your lane. Corporate domains required for non-consumer accounts."
            >
              <div className="grid grid-cols-2 gap-3">
                {SELECTABLE_ROLES.map((r) => (
                  <RoleCard
                    key={r}
                    role={r}
                    selected={form.role === r}
                    onSelect={(role) => set("role", role)}
                  />
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <FormField
                  label="Work email"
                  hint="Corporate domain required for manufacturer · wholesaler · retailer."
                  error={
                    form.email && emailDomainBlocked
                      ? `Free webmail (${emailDomain}) is not accepted for procurement accounts.`
                      : undefined
                  }
                >
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    invalid={emailDomainBlocked}
                    placeholder="you@your-pharma.ng"
                  />
                </FormField>
                <FormField
                  label="Password"
                  hint={`Minimum 12 chars. Mixed case + digits + symbol.`}
                >
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                  <PasswordStrengthMeter strength={passwordStrength} />
                </FormField>
              </div>
            </StepCard>
          )}

          {step === 2 && (
            <StepCard
              eyebrow="Step 2"
              title="Government identity"
              description="Squad NUBAN Resolve cross-references your BVN to the account holder name."
            >
              <FormField
                label="Bank Verification Number"
                trailingLabel="mono · 11 digits"
                error={
                  form.bvn.length > 0 && form.bvn.length !== 11
                    ? "BVN must be 11 digits."
                    : undefined
                }
              >
                <Input
                  mono
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="22184719283"
                  value={form.bvn}
                  onChange={(e) =>
                    set("bvn", e.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                <FormField label="Bank">
                  <Select
                    value={form.bank}
                    onChange={(e) => set("bank", e.target.value)}
                  >
                    <option value="">Select bank…</option>
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="NUBAN"
                  trailingLabel="mono · 10 digits"
                  hint={
                    form.nubanResolved.status === "match"
                      ? `✓ ${form.nubanResolved.name} · matches account holder`
                      : "Resolves via Squad on blur."
                  }
                  error={
                    form.nubanResolved.status === "mismatch"
                      ? "Account holder name does not match Step 1."
                      : undefined
                  }
                >
                  <Input
                    mono
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="0148472913"
                    value={form.nuban}
                    onChange={(e) => {
                      set("nuban", e.target.value.replace(/\D/g, "").slice(0, 10));
                      set("nubanResolved", { status: "idle" });
                    }}
                    onBlur={resolveNuban}
                    checking={form.nubanResolved.status === "checking"}
                    invalid={form.nubanResolved.status === "mismatch"}
                    trailing={
                      form.nubanResolved.status === "match" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--verified)]" />
                      ) : form.nubanResolved.status === "mismatch" ? (
                        <XCircle className="h-3.5 w-3.5 text-[var(--risk)]" />
                      ) : undefined
                    }
                  />
                </FormField>
              </div>
            </StepCard>
          )}

          {step === 3 && !isConsumer && (
            <StepCard
              eyebrow="Step 3"
              title="Corporate identity"
              description="CAC, FIRS, and PCN evidence will be re-validated against live registries during step 5."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="CAC RC Number" trailingLabel="mono">
                  <Input
                    mono
                    placeholder="RC 1847291"
                    value={form.cacRc}
                    onChange={(e) => set("cacRc", e.target.value)}
                  />
                </FormField>
                <FormField label="FIRS TIN" trailingLabel="mono">
                  <Input
                    mono
                    placeholder="01928374-0001"
                    value={form.firsTin}
                    onChange={(e) => set("firsTin", e.target.value)}
                  />
                </FormField>
              </div>
              {form.role !== "wholesaler" && (
                <FormField label="PCN Premise License" trailingLabel="mono">
                  <Input
                    mono
                    placeholder="PCN-MFG-2019-0421"
                    value={form.pcnPremise}
                    onChange={(e) => set("pcnPremise", e.target.value)}
                  />
                </FormField>
              )}
              <FormField
                label="Business address"
                hint="Mock Google Places — autocomplete arrives with the live backend."
              >
                <Input
                  placeholder="12 Kudirat Abiola Way, Oregun, Lagos"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </FormField>
            </StepCard>
          )}

          {step === 4 && !isConsumer && (
            <StepCard
              eyebrow="Step 4"
              title="Digital footprint"
              description="Authentic vendors leave traces. We sample LinkedIn and your premise."
            >
              <FormField
                label="LinkedIn company URL"
                hint="We fetch founding year + employee count from this page."
                error={
                  form.linkedinUrl && !form.linkedinUrl.startsWith("http")
                    ? "Must be a full URL beginning with https://"
                    : undefined
                }
              >
                <Input
                  placeholder="https://linkedin.com/company/your-pharma"
                  value={form.linkedinUrl}
                  onChange={(e) => set("linkedinUrl", e.target.value)}
                />
              </FormField>
              <FormField label="Premise photo" hint="JPG · PNG · max 8MB.">
                <label
                  htmlFor="premise-photo"
                  className="flex h-32 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-[var(--border-hairline)] bg-[var(--bg-inset)] text-center hover:border-[var(--border-strong)]"
                >
                  <div>
                    <p className="text-small text-[var(--text-secondary)]">
                      Drop a photo or click to upload
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Mocked · skips disk write
                    </p>
                  </div>
                  <input
                    id="premise-photo"
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                  />
                </label>
              </FormField>
            </StepCard>
          )}

          {step === 5 && <VerificationDashboard
            stream={stream}
            expectedChecks={expectedChecks}
            onEnter={() => {
              // promote session based on score
              if (stream.score >= 60 && form.role) {
                const domain = form.email.split("@")[1]?.split(".")[0] ?? "Aegis";
                const orgName = domain.charAt(0).toUpperCase() + domain.slice(1);
                const handle = form.email.split("@")[0].split(".");
                const initials =
                  handle.length >= 2
                    ? `${handle[0][0]}${handle[1][0]}`.toUpperCase()
                    : ((handle[0][0] ?? "U") + (handle[0][1] ?? "")).toUpperCase();
                setSession({
                  userId: `usr_${Math.random().toString(16).slice(2, 14)}`,
                  name: handle
                    .map((h) => h.charAt(0).toUpperCase() + h.slice(1))
                    .join(" "),
                  email: form.email,
                  role: form.role,
                  organization: orgName,
                  trustScore: stream.score,
                  tier: stream.score >= 85 ? "verified" : "limited",
                  initials,
                });
              }
              router.push("/dashboard");
            }}
          />}

          {/* Footer nav (hidden on step 5 which carries its own CTA) */}
          {step < 5 && (
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={back}
                disabled={step === 1}
                leadingIcon={<ArrowLeft />}
              >
                Back
              </Button>
              <div className="flex items-center gap-2">
                <p className="text-caption uppercase text-[var(--text-tertiary)]">
                  Step {step} of 5
                </p>
                <Button
                  variant="primary"
                  onClick={next}
                  disabled={!canProceed}
                  trailingIcon={<ArrowRight />}
                >
                  {step === 4 || (step === 2 && isConsumer)
                    ? "Begin verification"
                    : "Continue"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StepCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="pb-4">
        <p className="text-caption uppercase text-[var(--text-tertiary)]">
          {eyebrow}
        </p>
        <CardTitle className="mt-1 text-h2">{title}</CardTitle>
        <CardDescription className="mt-2 max-w-[600px]">
          {description}
        </CardDescription>
      </div>
      <div className="space-y-5 border-t border-[var(--border-hairline)] pt-5">
        {children}
      </div>
    </Card>
  );
}

function PasswordStrengthMeter({
  strength,
}: {
  strength: { score: 0 | 1 | 2 | 3 | 4; label: string };
}) {
  const colors = ["risk", "risk", "pending", "verified", "verified"] as const;
  const colorVar =
    colors[strength.score] === "risk"
      ? "var(--risk)"
      : colors[strength.score] === "pending"
        ? "var(--pending)"
        : "var(--verified)";
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200"
            )}
            style={{
              backgroundColor:
                i < strength.score ? colorVar : "var(--border-hairline)",
            }}
          />
        ))}
      </div>
      <p
        className="text-[11px] uppercase tracking-[0.04em]"
        style={{ color: strength.score >= 2 ? colorVar : "var(--text-tertiary)" }}
      >
        {strength.label}
      </p>
    </div>
  );
}

interface DashboardProps {
  stream: ReturnType<typeof useVerificationStream>;
  expectedChecks: VerificationCheck[];
  onEnter: () => void;
}

function VerificationDashboard({ stream, expectedChecks, onEnter }: DashboardProps) {
  const isComplete = stream.status === "complete";
  const tier =
    stream.score >= 85
      ? "verified"
      : stream.score >= 60
        ? "limited"
        : "suspended";

  return (
    <div className="space-y-5">
      <TrustScoreCard score={stream.score} status={stream.status} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Rows */}
        <Card>
          <div className="flex items-center justify-between pb-3">
            <CardTitle>Verification checks</CardTitle>
            <Badge
              status={
                stream.status === "complete"
                  ? "verified"
                  : stream.status === "running"
                    ? "info"
                    : "neutral"
              }
              dot
            >
              {stream.status === "running" ? "in flight" : stream.status}
            </Badge>
          </div>
          <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
            {expectedChecks.map((check) => {
              const row = stream.rows.get(check);
              return (
                <VerificationRow
                  key={check}
                  check={check}
                  status={row?.status ?? "queued"}
                  evidence={row?.evidence}
                  detail={row?.detail}
                  contribution={row?.contribution}
                  latencyMs={row?.latencyMs}
                />
              );
            })}
          </div>
        </Card>

        {/* Trace */}
        <ForensicTrace
          events={stream.log}
          score={stream.score}
          className="h-fit lg:sticky lg:top-20"
        />
      </div>

      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          >
            <Card
              emphasized
              className={cn(
                tier === "verified" && "border-[var(--verified-border)]",
                tier === "limited" && "border-[var(--pending-border)]",
                tier === "suspended" && "border-[var(--risk-border)]"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {tier === "verified" && (
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--verified)]" />
                  )}
                  {tier === "limited" && (
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--pending)]" />
                  )}
                  {tier === "suspended" && (
                    <XCircle className="mt-0.5 h-5 w-5 text-[var(--risk)]" />
                  )}
                  <div>
                    <h3 className="text-h3">
                      {tier === "verified"
                        ? "Verification complete — full access granted."
                        : tier === "limited"
                          ? "Limited tier — ₦500k daily cap."
                          : "Account suspended pending manual review."}
                    </h3>
                    <p className="text-small mt-1 text-[var(--text-secondary)]">
                      Composite trust score{" "}
                      <MonoText size="sm">
                        {stream.score.toFixed(1)}
                      </MonoText>{" "}
                      based on {stream.log.filter((e) => e.status !== "running").length} terminal events.
                    </p>
                  </div>
                </div>
                <Button
                  variant={tier === "suspended" ? "secondary" : "primary"}
                  onClick={onEnter}
                  trailingIcon={<ArrowRight />}
                >
                  {tier === "suspended" ? "Open ticket" : "Enter platform"}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
