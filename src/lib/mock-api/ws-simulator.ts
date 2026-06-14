"use client";

// ─────────────────────────────────────────────────────────────────────────
// Verification stream (Identity Wall, phase 4)
// ─────────────────────────────────────────────────────────────────────────

export type VerificationCheck =
  | "squad_bvn"
  | "squad_nuban"
  | "cac"
  | "pcn"
  | "firs_tin"
  | "google_places"
  | "linkedin"
  | "work_email";

export type CheckStatus = "queued" | "running" | "verified" | "failed" | "warning";

export interface VerificationEvent {
  check: VerificationCheck;
  status: CheckStatus;
  /** Human-readable evidence line ("Matched: …") */
  evidence: string;
  /** Expanded reason, shown on row expand */
  detail?: string;
  /** Contribution to the trust score (0–100). Summed across verified checks. */
  contribution: number;
  /** Latency the check took, ms */
  latencyMs: number;
  /** Server-timestamp for the event */
  timestamp: string;
}

export type VerificationPersona = "good_vendor" | "ghost_tin_mismatch" | "ghost_residential";

// ─────────────────────────────────────────────────────────────────────────
// Lightweight typed EventEmitter
// ─────────────────────────────────────────────────────────────────────────

type Handler<T> = (event: T) => void;

class TypedEmitter<TEvent> {
  private handlers = new Set<Handler<TEvent>>();
  on(h: Handler<TEvent>) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(e: TEvent) {
    this.handlers.forEach((h) => h(e));
  }
  clear() {
    this.handlers.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Verification stream — emits 6–8 events sequenced 400–1200ms apart
// ─────────────────────────────────────────────────────────────────────────

const GOOD_VENDOR_SCRIPT: Omit<VerificationEvent, "timestamp">[] = [
  {
    check: "squad_bvn",
    status: "verified",
    evidence: "Matched: ADEYEMI OKAFOR · BVN issued 2014-08-11",
    contribution: 14,
    latencyMs: 842,
  },
  {
    check: "squad_nuban",
    status: "verified",
    evidence: "Account holder name matches BVN · GTBank ••••2913",
    contribution: 14,
    latencyMs: 711,
  },
  {
    check: "cac",
    status: "verified",
    evidence: "Lagos Pharma Ltd · RC 1847291 · ACTIVE · registered 2014-04-12",
    contribution: 16,
    latencyMs: 459,
  },
  {
    check: "firs_tin",
    status: "verified",
    evidence: "TIN 01928374-0001 · CAC linkage confirmed · in good standing",
    contribution: 12,
    latencyMs: 408,
  },
  {
    check: "pcn",
    status: "verified",
    evidence: "PCN Premise License PCN-MFG-2019-0421 · ACTIVE · expires 2027",
    contribution: 14,
    latencyMs: 612,
  },
  {
    check: "google_places",
    status: "verified",
    evidence:
      "12 Kudirat Abiola Way, Oregun · INDUSTRIAL · 94% confidence · open >5y",
    contribution: 10,
    latencyMs: 817,
  },
  {
    check: "linkedin",
    status: "verified",
    evidence:
      "linkedin.com/company/lagos-pharma · founded 2014 · 142 employees · operating",
    contribution: 8,
    latencyMs: 904,
  },
  {
    check: "work_email",
    status: "verified",
    evidence:
      "lagospharma.ng · corporate MX records · DMARC enforced · domain age 9y",
    contribution: 4,
    latencyMs: 218,
  },
];

const GHOST_TIN_SCRIPT: Omit<VerificationEvent, "timestamp">[] = [
  {
    check: "squad_bvn",
    status: "verified",
    evidence: "Matched: EMEKA NWOSU · BVN issued 2018-11-04",
    contribution: 14,
    latencyMs: 882,
  },
  {
    check: "squad_nuban",
    status: "verified",
    evidence: "Opay ••••9912 · account holder matches BVN",
    contribution: 12,
    latencyMs: 701,
  },
  {
    check: "cac",
    status: "verified",
    evidence: "Quick Pharma Wholesale · RC 4128471 · ACTIVE",
    contribution: 14,
    latencyMs: 449,
  },
  {
    check: "firs_tin",
    status: "failed",
    evidence: "TIN 00000000-9999 · no CAC linkage found",
    detail:
      "FIRS does not return a matching record for the supplied TIN. CAC RC 4128471 maps to a different TIN.",
    contribution: 0,
    latencyMs: 511,
  },
  {
    check: "pcn",
    status: "failed",
    evidence: "No PCN premise license on file for RC 4128471",
    detail:
      "Pharmacy wholesale operations require a PCN premise license. None could be located in the PCN registry.",
    contribution: 0,
    latencyMs: 612,
  },
  {
    check: "google_places",
    status: "warning",
    evidence: "Suite 14, Computer Village Complex · COMMERCIAL · 71% confidence",
    detail:
      "Address resolves to a shared-occupancy commercial complex. Tenant signage not visible in street imagery.",
    contribution: 4,
    latencyMs: 818,
  },
  {
    check: "linkedin",
    status: "failed",
    evidence: "No matching company page on LinkedIn",
    detail:
      "Identity Wall flags vendors with no LinkedIn presence in pharmaceutical wholesale.",
    contribution: 0,
    latencyMs: 904,
  },
  {
    check: "work_email",
    status: "warning",
    evidence: "quickpharma.shop · domain age 4 months · no DMARC",
    detail:
      "Recently registered domain. DMARC absent — domain spoofing protection not configured.",
    contribution: 0,
    latencyMs: 212,
  },
];

const GHOST_RESIDENTIAL_SCRIPT: Omit<VerificationEvent, "timestamp">[] = [
  {
    check: "squad_bvn",
    status: "verified",
    evidence: "Matched: STELLA ACHEBE · BVN issued 2019-02-22",
    contribution: 14,
    latencyMs: 844,
  },
  {
    check: "squad_nuban",
    status: "verified",
    evidence: "Palmpay ••••9988 · account holder matches BVN",
    contribution: 12,
    latencyMs: 691,
  },
  {
    check: "cac",
    status: "verified",
    evidence: "Premier Drug Mart · RC 4218411 · ACTIVE",
    contribution: 14,
    latencyMs: 466,
  },
  {
    check: "firs_tin",
    status: "verified",
    evidence: "TIN 01928374-9981 · CAC linkage confirmed",
    contribution: 10,
    latencyMs: 412,
  },
  {
    check: "pcn",
    status: "failed",
    evidence: "No PCN premise license on file",
    detail:
      "Retail pharmacy requires a PCN premise license. No record matches RC 4218411 or operating address.",
    contribution: 0,
    latencyMs: 612,
  },
  {
    check: "google_places",
    status: "failed",
    evidence:
      "Flat 3B, 19 Bayo Kuku Road, Ikoyi · RESIDENTIAL · 98% confidence",
    detail:
      "Address resolves to an apartment in a residential block. Pharmacy premise must be on a commercial-zoned property.",
    contribution: 0,
    latencyMs: 832,
  },
  {
    check: "linkedin",
    status: "failed",
    evidence: "No matching company page",
    contribution: 0,
    latencyMs: 911,
  },
  {
    check: "work_email",
    status: "failed",
    evidence: "stella.achebe@hotmail.com · consumer email provider",
    detail:
      "Pharmaceutical procurement requires a verifiable corporate domain. Free webmail is not accepted.",
    contribution: 0,
    latencyMs: 88,
  },
];

const SCRIPTS: Record<VerificationPersona, Omit<VerificationEvent, "timestamp">[]> =
  {
    good_vendor: GOOD_VENDOR_SCRIPT,
    ghost_tin_mismatch: GHOST_TIN_SCRIPT,
    ghost_residential: GHOST_RESIDENTIAL_SCRIPT,
  };

export interface VerificationStreamHandle {
  on: (h: Handler<VerificationEvent>) => () => void;
  onComplete: (h: () => void) => () => void;
  stop: () => void;
}

/**
 * Kick off a verification stream. Each event fires after a randomised
 * gap (~280–840ms) and resolves after its declared latency.
 */
export function startVerificationStream(
  persona: VerificationPersona
): VerificationStreamHandle {
  const events = SCRIPTS[persona];
  const emitter = new TypedEmitter<VerificationEvent>();
  const completer = new TypedEmitter<void>();
  const compress = 0.7;
  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  // Initial "running" event for the first row to render an animated state
  let cursor = 0;
  function next() {
    if (stopped || cursor >= events.length) {
      if (!stopped) completer.emit();
      return;
    }
    const ev = events[cursor];
    const gap = Math.round((400 + Math.random() * 800) * compress);
    timers.push(
      setTimeout(() => {
        if (stopped) return;
        // first emit "running"
        emitter.emit({
          ...ev,
          status: "running",
          timestamp: new Date().toISOString(),
        });
        const runFor = Math.round(ev.latencyMs * compress);
        timers.push(
          setTimeout(() => {
            if (stopped) return;
            emitter.emit({
              ...ev,
              timestamp: new Date().toISOString(),
            });
            cursor++;
            next();
          }, runFor)
        );
      }, gap)
    );
  }

  next();

  return {
    on: (h) => emitter.on(h),
    onComplete: (h) => completer.on(h),
    stop: () => {
      stopped = true;
      timers.forEach(clearTimeout);
      emitter.clear();
      completer.clear();
    },
  };
}

