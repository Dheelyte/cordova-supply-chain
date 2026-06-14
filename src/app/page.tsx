"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Fingerprint,
  Network,
  ScanLine,
  Banknote,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

interface Frame {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: React.ReactNode;
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Background grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
              <Shield className="h-3.5 w-3.5 text-[var(--accent)]" />
            </div>
            <span className="text-h3 leading-none">Aegis</span>
            <Badge status="accent" size="sm" dot>
              Forensic gateway
            </Badge>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="secondary" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="primary" size="sm" trailingIcon={<ArrowRight />}>
                Open platform
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-[1240px] px-6 pt-16">
        <p className="text-caption uppercase text-[var(--text-tertiary)]">
          Pharmaceutical supply chain · Nigeria
        </p>
        <h1 className="text-display mt-3 max-w-[900px]">
          Money only moves when authenticity is mathematically proven.
        </h1>
        <p className="text-body mt-5 max-w-[640px] text-[var(--text-secondary)]">
          Aegis treats every transaction as guilty until proven authentic.
          Vendors clear a multi-point Identity Wall, products pass forensic AI
          verification, and SquadCo settlement is gated on both verdicts.
        </p>

        {/* Live counter */}
        <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-6">
          <LiveCounter
            label="Forensic verdicts today"
            from={47_283}
            growthPerMin={42}
          />
          <Stat
            label="Fraud blocked"
            value="₦487,204,910"
            tint="var(--risk)"
          />
          <Stat
            label="Batches under custody"
            value="12,847"
            tint="var(--accent)"
          />
          <Stat
            label="Successful counterfeits"
            value="0"
            tint="var(--verified)"
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/dashboard">
            <Button variant="primary" size="lg" trailingIcon={<ArrowRight />}>
              Open the platform
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">
              Sign in
            </Button>
          </Link>
          <span className="text-caption uppercase text-[var(--text-tertiary)]">
            Built for SquadCo · NAFDAC compliant
          </span>
        </div>
      </section>

      {/* Storyboard */}
      <section className="relative z-10 mx-auto mt-24 max-w-[1240px] px-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-caption uppercase text-[var(--text-tertiary)]">
              How it works · 4 stages
            </p>
            <h2 className="text-h1 mt-1">From vendor onboarding to settled funds.</h2>
          </div>
          <Sparkles className="hidden h-4 w-4 text-[var(--accent)] md:block" />
        </div>
        <Storyboard />
      </section>

      {/* Partners */}
      <section className="relative z-10 mx-auto mt-24 max-w-[1240px] px-6">
        <p className="text-caption uppercase text-[var(--text-tertiary)]">
          Integrations
        </p>
        <ul className="mt-3 flex flex-wrap items-center gap-x-10 gap-y-3 border-y border-[var(--border-hairline)] py-5">
          {["SquadCo", "NAFDAC", "PCN", "CAC", "FIRS", "Google Places"].map((n) => (
            <li
              key={n}
              className="font-mono-ui text-[14px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]"
            >
              {n}
            </li>
          ))}
        </ul>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto mt-24 max-w-[1240px] px-6 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-6">
          <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Aegis · forensic supply chain gateway
          </p>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
            <Link href="/login" className="hover:text-[var(--text-secondary)]">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-[var(--text-secondary)]">
              Register
            </Link>
            <Link href="/dashboard" className="hover:text-[var(--text-secondary)]">
              Platform
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function LiveCounter({
  label,
  from,
  growthPerMin,
}: {
  label: string;
  from: number;
  growthPerMin: number;
}) {
  const [count, setCount] = React.useState(from);
  const mv = useMotionValue(from);
  const spring = useSpring(mv, { stiffness: 50, damping: 22 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());

  React.useEffect(() => {
    mv.set(count);
  }, [count, mv]);

  React.useEffect(() => {
    const t = setInterval(() => {
      // Add a jittered increment averaging growthPerMin/60 per second
      const inc = Math.max(
        0,
        Math.round(growthPerMin / 60 + (Math.random() - 0.3) * 1.6)
      );
      setCount((c) => c + inc);
    }, 1000);
    return () => clearInterval(t);
  }, [growthPerMin]);

  return (
    <div>
      <p className="text-caption uppercase text-[var(--text-tertiary)]">{label}</p>
      <motion.span className="mt-1 block font-mono-ui font-semibold tracking-[-0.02em] text-[32px] text-[var(--text-primary)]">
        {display}
      </motion.span>
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div>
      <p className="text-caption uppercase text-[var(--text-tertiary)]">{label}</p>
      <MonoText
        size="lg"
        className="mt-1 block text-[32px] leading-none tracking-[-0.02em]"
        style={{ color: tint }}
      >
        {value}
      </MonoText>
    </div>
  );
}

function Storyboard() {
  const FRAMES: Frame[] = [
    {
      id: "identity",
      eyebrow: "01 · Identity",
      title: "Identity Wall",
      body: "BVN · NUBAN · CAC · FIRS · PCN · Google Places · LinkedIn · corporate email. Eight checks. Composite trust score gates platform access.",
      icon: Fingerprint,
      preview: <FrameIdentity />,
    },
    {
      id: "ledger",
      eyebrow: "02 · Ledger",
      title: "Chain of custody",
      body: "Every batch initialized under a SHA-256 binary identifier. Every hop signed, timestamped, GPS-anchored. Impossible-travel anomalies surface on the wire.",
      icon: Network,
      preview: <FrameLedger />,
    },
    {
      id: "forensic",
      eyebrow: "03 · Forensic AI",
      title: "ELA · VLM · CNN consensus",
      body: "Error-level analysis spots digital tampering. Vision-language compares against NAFDAC reference. The consensus verdict lands in 4.5 seconds.",
      icon: ScanLine,
      preview: <FrameForensic />,
    },
    {
      id: "settlement",
      eyebrow: "04 · Settlement",
      title: "Squad-gated transfer",
      body: "Money only moves when AI verdict and ledger path are both green. The transfer button is physically disabled until then.",
      icon: Banknote,
      preview: <FrameSettlement />,
    },
  ];

  const [active, setActive] = React.useState(0);

  // Auto-advance every 4s unless hovered
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % FRAMES.length), 4000);
    return () => clearInterval(t);
  }, [paused, FRAMES.length]);

  const frame = FRAMES[active];
  const Icon = frame.icon;

  return (
    <div
      className="mt-4 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Frame list */}
      <ol className="space-y-2">
        {FRAMES.map((f, i) => {
          const isActive = i === active;
          const Fi = f.icon;
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[10px] border px-3 py-3 text-left transition-colors duration-200",
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border",
                    isActive
                      ? "border-[var(--accent)] bg-[var(--bg-base)] text-[var(--accent)]"
                      : "border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)]"
                  )}
                >
                  <Fi className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <MonoText size="sm" className="text-[var(--text-tertiary)]">
                    {f.eyebrow}
                  </MonoText>
                  <p className="text-small font-semibold text-[var(--text-primary)]">
                    {f.title}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Active preview */}
      <Card emphasized padded className="overflow-hidden">
        <div className="flex items-start justify-between pb-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <MonoText size="sm" className="text-[var(--text-tertiary)]">
                {frame.eyebrow}
              </MonoText>
              <h3 className="text-h2 mt-1">{frame.title}</h3>
              <p className="text-small mt-1 max-w-[460px] text-[var(--text-secondary)]">
                {frame.body}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {FRAMES.map((_, i) => (
              <span
                key={i}
                className="h-1 rounded-full transition-all duration-200"
                style={{
                  width: i === active ? 24 : 8,
                  background:
                    i === active ? "var(--accent)" : "var(--border-strong)",
                }}
              />
            ))}
          </div>
        </div>
        <div className="border-t border-[var(--border-hairline)] pt-4">
          <motion.div
            key={frame.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          >
            {frame.preview}
          </motion.div>
        </div>
      </Card>
    </div>
  );
}

function FrameIdentity() {
  return (
    <div className="space-y-2">
      {[
        { label: "BVN · Squad resolve", val: "22184719283", ok: true },
        { label: "NUBAN holder match", val: "GTBank · ••••2913", ok: true },
        { label: "CAC RC", val: "1847291 · ACTIVE", ok: true },
        { label: "FIRS TIN", val: "01928374-0001", ok: true },
        { label: "PCN Premise", val: "MFG-2019-0421", ok: true },
      ].map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--verified-border)] bg-[var(--verified-soft)]/30 px-3 py-2"
        >
          <span className="text-small text-[var(--text-primary)]">{r.label}</span>
          <MonoText size="sm" className="text-[var(--verified)]">
            {r.val}
          </MonoText>
        </div>
      ))}
      <div className="mt-3 flex items-center justify-between rounded-[6px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2">
        <span className="text-caption uppercase text-[var(--accent)]">
          Composite trust
        </span>
        <MonoText size="lg" className="text-[20px] text-[var(--accent)]">
          92.4 / 100
        </MonoText>
      </div>
    </div>
  );
}

function FrameLedger() {
  return (
    <div className="space-y-2">
      <pre className="rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3 text-mono-small leading-[1.7] text-[var(--text-secondary)] overflow-x-auto">
{`hop_001a  initialized   Lagos     17:30:00.000Z
hop_001b  dispatched    Lagos     17:42:11.482Z
hop_001c  in_transit    Ibadan    20:14:08.221Z
hop_001d  received      Abuja     09:42:08.117Z
SHA-256   a04f9c8b4e72d3119b2c7e4a5d09f1c382a7e114c9b6d05f81a234c91b6f0e87`}
      </pre>
      <div className="flex items-center gap-2 rounded-[6px] border border-[var(--risk-border)] bg-[var(--risk-soft)]/30 px-3 py-2">
        <span className="font-mono-ui text-[10px] uppercase tracking-[0.06em] text-[var(--risk)]">
          anomaly
        </span>
        <span className="text-small text-[var(--text-secondary)]">
          Lagos → Kano in 8 minutes · physically impossible
        </span>
      </div>
    </div>
  );
}

function FrameForensic() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Bar label="ELA" score={96.2} ok />
      <Bar label="VLM" score={94.4} ok />
      <Bar label="Consensus" score={95.4} ok strong />
    </div>
  );
}

function FrameSettlement() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-[6px] border border-[var(--verified-border)] bg-[var(--verified-soft)]/30 px-3 py-2">
        <span className="font-mono-ui text-[11px] uppercase tracking-[0.06em] text-[var(--verified)]">
          AI verdict · PASS
        </span>
        <MonoText size="sm" className="text-[var(--verified)]">
          consensus 95.4
        </MonoText>
      </div>
      <div className="flex items-center justify-between rounded-[6px] border border-[var(--verified-border)] bg-[var(--verified-soft)]/30 px-3 py-2">
        <span className="font-mono-ui text-[11px] uppercase tracking-[0.06em] text-[var(--verified)]">
          Ledger path · PASS
        </span>
        <MonoText size="sm" className="text-[var(--verified)]">
          all custody hops signed
        </MonoText>
      </div>
      <div className="flex items-center justify-between rounded-[8px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2.5">
        <span className="text-small font-semibold text-[var(--accent)]">
          Execute Squad transfer
        </span>
        <MonoText size="sm" className="text-[var(--accent)]">
          ₦2,400,000 → ••••1847
        </MonoText>
      </div>
    </div>
  );
}

function Bar({
  label,
  score,
  ok,
  strong,
}: {
  label: string;
  score: number;
  ok?: boolean;
  strong?: boolean;
}) {
  const color = ok ? "var(--verified)" : "var(--risk)";
  return (
    <div
      className={cn(
        "rounded-[8px] border bg-[var(--bg-inset)] p-3",
        strong ? "border-[var(--accent-border)] bg-[var(--accent-soft)]/40" : "border-[var(--border-hairline)]"
      )}
    >
      <p className="text-caption uppercase text-[var(--text-tertiary)]">
        {label}
      </p>
      <MonoText
        size="lg"
        className="mt-1 block text-[24px] leading-none"
        style={{ color }}
      >
        {score.toFixed(1)}
      </MonoText>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border-hairline)]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}
