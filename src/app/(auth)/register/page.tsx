"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { useAuth } from "@/stores/auth";
import { auth as squadAuth, setToken, SquadCoError } from "@/lib/squadco";
import type { Role as BackendRole } from "@/lib/squadco";

interface Form {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  nin: string;
  company_name: string;
  industry_type: string;
  address: string;
  rc_number: string;
  role: BackendRole;
  otp: string;
}

const EMPTY: Form = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  nin: "",
  company_name: "",
  industry_type: "pharmaceuticals",
  address: "",
  rc_number: "",
  role: "wholesaler",
  otp: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [otpRequested, setOtpRequested] = React.useState(false);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const step1Valid =
    form.email.includes("@") && form.password.length >= 8 && !!form.role;
  const step2Valid =
    form.first_name.length > 1 &&
    form.last_name.length > 1 &&
    form.phone_number.length >= 10 &&
    form.nin.length === 11 &&
    form.company_name.length > 1;
  const step3Valid = form.otp.length >= 4;

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      await squadAuth.requestOtp({
        email: form.email,
        purpose: "registration",
      });
      setOtpRequested(true);
      setStep(3);
    } catch (e) {
      setError(e instanceof SquadCoError ? e.message : "Failed to request OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister() {
    setBusy(true);
    setError(null);
    try {
      const r = await squadAuth.register({
        email: form.email,
        password: form.password,
        role: form.role,
        first_name: form.first_name,
        last_name: form.last_name,
        phone_number: form.phone_number,
        nin: form.nin,
        otp: form.otp,
        company_name: form.company_name,
        industry_type: form.industry_type || undefined,
        address: form.address || undefined,
        rc_number: form.rc_number || undefined,
      });
      setToken(r.access_token);
      setSession({
        userId: r.user.id,
        name: `${form.first_name} ${form.last_name}`.trim(),
        email: r.user.email,
        role: r.user.role,
        organization: r.business_profile.company_name,
        trustScore: 0,
        tier: "unverified",
        initials:
          (form.first_name[0] ?? "U").toUpperCase() +
          (form.last_name[0] ?? "").toUpperCase(),
      });
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof SquadCoError ? e.message : "Registration failed.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[480px]">
      <p className="text-caption uppercase text-[var(--text-tertiary)]">
        Create account · forensic gateway
      </p>
      <h1 className="text-h1 mt-1 text-[var(--text-primary)]">
        {step === 1
          ? "Account credentials."
          : step === 2
            ? "Personal & business identity."
            : "Verify with the code we sent."}
      </h1>
      <p className="text-body mt-2 text-[var(--text-secondary)]">
        {step === 1 && "Choose your role and set up sign-in credentials."}
        {step === 2 &&
          "Required by NIN/CAC pre-checks. Match the names on your records."}
        {step === 3 && `Check ${form.email}. Enter the 6-digit code to finish.`}
      </p>

      <Card className="mt-6">
        {step === 1 && (
          <div className="space-y-4">
            <FormField label="Account type">
              <Select
                value={form.role}
                onChange={(e) => set("role", e.target.value as BackendRole)}
              >
                <option value="manufacturer">Manufacturer</option>
                <option value="wholesaler">Wholesaler</option>
                <option value="retailer">Retailer</option>
              </Select>
            </FormField>
            <FormField label="Work email">
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@your-pharma.ng"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                autoFocus
              />
            </FormField>
            <FormField label="Password" hint="Minimum 8 characters.">
              <Input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </FormField>
            <Button
              variant="primary"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              trailingIcon={<ArrowRight />}
              className="w-full justify-center"
            >
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="First name">
                <Input
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                  autoFocus
                />
              </FormField>
              <FormField label="Last name">
                <Input
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                />
              </FormField>
            </div>
            <FormField
              label="Phone number"
              hint="Must match the number on your NIN record."
            >
              <Input
                type="tel"
                value={form.phone_number}
                onChange={(e) => set("phone_number", e.target.value)}
                placeholder="08148030821"
              />
            </FormField>
            <FormField label="NIN" hint="11-digit National Identification Number.">
              <Input
                value={form.nin}
                onChange={(e) =>
                  set("nin", e.target.value.replace(/\D/g, "").slice(0, 11))
                }
                placeholder="87414412138"
              />
            </FormField>
            <FormField label="Company name">
              <Input
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
              />
            </FormField>
            <FormField
              label="RC number"
              hint="Optional. Triggers CAC verification on profile update."
            >
              <Input
                value={form.rc_number}
                onChange={(e) => set("rc_number", e.target.value)}
              />
            </FormField>
            <FormField label="Address">
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </FormField>
            {error && (
              <p className="text-[12px] font-medium text-[var(--risk)]">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!step2Valid || busy}
                loading={busy}
                onClick={requestOtp}
                trailingIcon={<Mail />}
                className="flex-1 justify-center"
              >
                Send code
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <FormField label="OTP" hint="6-digit code from your email.">
              <Input
                value={form.otp}
                onChange={(e) =>
                  set("otp", e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                autoFocus
              />
            </FormField>
            {error && (
              <p className="text-[12px] font-medium text-[var(--risk)]">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!step3Valid || busy}
                loading={busy}
                onClick={submitRegister}
                leadingIcon={<UserPlus />}
                className="flex-1 justify-center"
              >
                Create account
              </Button>
            </div>
            {otpRequested && (
              <button
                type="button"
                onClick={requestOtp}
                disabled={busy}
                className="text-caption uppercase text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                Resend code
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-hairline)] pt-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              I already have an account
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
