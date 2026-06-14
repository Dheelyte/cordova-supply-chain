"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/stores/auth";
import { SquadCoError } from "@/lib/squadco";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@") || password.length < 8) {
      setError("Enter a valid corporate email and your account password.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof SquadCoError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Sign in failed."
      );
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <p className="text-caption uppercase text-[var(--text-tertiary)]">
        Sign in
      </p>
      <h1 className="text-h1 mt-1 text-[var(--text-primary)]">
        Authenticate to continue.
      </h1>
      <p className="text-body mt-2 text-[var(--text-secondary)]">
        Aegis requires a verified corporate identity. Sessions are scoped to
        your organization.
      </p>

      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Work email">
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@your-pharma.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Password" hint="Minimum 8 characters.">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          {error && (
            <p className="text-[12px] font-medium text-[var(--risk)]">{error}</p>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            leadingIcon={<Lock />}
            className="w-full justify-center"
          >
            Sign in
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-hairline)] pt-3">
          <Link href="/register">
            <Button variant="ghost" size="sm" trailingIcon={<ArrowRight />}>
              Create an account
            </Button>
          </Link>
          <button
            type="button"
            className="text-caption uppercase text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            Forgot password
          </button>
        </div>
      </Card>

      <div className="mt-4 flex items-center gap-2">
        <Badge status="verified" size="sm" dot>
          <ShieldCheck className="h-3 w-3" />
          SSO via Squad
        </Badge>
        <p className="text-caption uppercase text-[var(--text-tertiary)]">
          BVN-anchored · NAFDAC compliant
        </p>
      </div>
    </div>
  );
}
