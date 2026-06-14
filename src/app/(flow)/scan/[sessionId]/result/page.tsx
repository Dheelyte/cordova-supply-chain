"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { ConfidenceGauge } from "@/components/forensic/ConfidenceGauge";
import { ELAHeatmap } from "@/components/forensic/ELAHeatmap";
import { VLMComparison } from "@/components/forensic/VLMComparison";
import { VerdictCard } from "@/components/forensic/VerdictCard";
import { ScanForensicTrace, type TraceLine } from "@/components/forensic/ScanForensicTrace";
import { useScanPipeline } from "@/hooks/use-scan-pipeline";
import { useLedgerScan } from "@/hooks/use-ledger-scan";
import { apiUrl } from "@/lib/api/client";
import { useWallet } from "@/stores/wallet";
import {
  type ElaPayload,
  type ElaRect,
  type IdentifyPayload,
  type NormalizationPayload,
  type ScanPipelineEvent,
  type ScanResult,
  type VlmFinding,
  type VlmPayload,
} from "@/lib/contract/scan";
import { cn } from "@/lib/utils/cn";

type Stage =
  | "idle"
  | "normalize"
  | "identify"
  | "ela"
  | "vlm"
  | "consensus";

/** Aggregate per-stage payloads + the terminal `ScanResult` from the stream. */
interface ScanView {
  productName: string | null;
  capturedImageSrc: string | null;
  bbox: NormalizationPayload["bbox"] | null;
  identify: IdentifyPayload | null;
  elaScore: number | null;
  elaMap: ElaRect[] | null;
  vlmScore: number | null;
  vlmFindings: VlmFinding[] | null;
  referenceImage: string | null;
  referenceAvailable: boolean;
  result: ScanResult | null;
}

const EMPTY_VIEW: ScanView = {
  productName: null,
  capturedImageSrc: null,
  bbox: null,
  identify: null,
  elaScore: null,
  elaMap: null,
  vlmScore: null,
  vlmFindings: null,
  referenceImage: null,
  referenceAvailable: true,
  result: null,
};

function reduceView(events: ScanPipelineEvent[], result: ScanResult | null): ScanView {
  let view = { ...EMPTY_VIEW, result };
  for (const e of events) {
    switch (e.stage) {
      case "normalization_complete": {
        const p = e.payload as NormalizationPayload;
        view = {
          ...view,
          // Normalization's productName is "Identifying product…" when no
          // batch context — only adopt it as the canonical name if we
          // haven't yet got something more specific.
          productName: view.productName ?? p.productName,
          capturedImageSrc: apiUrl(p.normalizedImageUrl),
          bbox: p.bbox,
        };
        break;
      }
      case "identify_complete": {
        const p = e.payload as IdentifyPayload;
        view = {
          ...view,
          // Identify replaces the placeholder normalization name.
          productName: p.productName,
          identify: p,
        };
        break;
      }
      case "ela_complete": {
        const p = e.payload as ElaPayload;
        view = {
          ...view,
          productName: view.productName ?? p.productName,
          elaScore: p.elaScore,
          elaMap: p.elaMap,
        };
        break;
      }
      case "vlm_complete": {
        const p = e.payload as VlmPayload;
        view = {
          ...view,
          productName: view.productName ?? p.productName,
          vlmScore: p.vlmScore,
          vlmFindings: p.vlmFindings,
          referenceImage: p.referenceImage,
          referenceAvailable: p.referenceAvailable,
        };
        break;
      }
      case "consensus": {
        const p = e.payload as ScanResult;
        view = {
          ...view,
          productName: view.productName ?? p.productName,
          elaScore: view.elaScore ?? p.elaScore,
          elaMap: view.elaMap ?? p.elaMap,
          vlmScore: view.vlmScore ?? p.vlmScore,
          vlmFindings: view.vlmFindings ?? p.vlmFindings,
          referenceImage: view.referenceImage ?? p.referenceImage,
          referenceAvailable: p.referenceAvailable,
          result: p,
        };
        break;
      }
    }
  }
  return view;
}

export default function ScanResultPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const pipeline = useScanPipeline(sessionId);
  const router = useRouter();
  const createSettlementFromScan = useWallet((s) => s.createSettlementFromScan);
  // Log this scan to the SquadCo ledger as soon as the consensus arrives.
  // Skips when the batch id isn't a 64-hex backend binary_id.
  const ledgerLog = useLedgerScan(pipeline.result?.batchId ?? null);

  // Build stage 5 — Accept-and-release on a PASS scan creates a pending
  // settlement linked to this session, then routes to /wallet. The
  // settlement's AI gate is the scan's real verdict, not a static fixture
  // field. REVIEW + FAIL verdicts don't get this CTA — see VerdictCard.
  const handleAccept = React.useCallback(() => {
    if (!pipeline.result) return;
    createSettlementFromScan({
      sessionId: pipeline.result.sessionId,
      verdict: pipeline.result.verdict,
      consensusScore: pipeline.result.consensusScore,
      summary: pipeline.result.summary,
      batchId: pipeline.result.batchId,
    });
    router.push("/wallet");
  }, [pipeline.result, createSettlementFromScan, router]);

  const stage: Stage =
    pipeline.stage === "consensus"
      ? "consensus"
      : pipeline.stage === "vlm_complete"
        ? "vlm"
        : pipeline.stage === "ela_complete"
          ? "ela"
          : pipeline.stage === "identify_complete"
            ? "identify"
            : pipeline.stage === "normalization_complete"
              ? "normalize"
              : "idle";

  const view = React.useMemo(
    () => reduceView(pipeline.events, pipeline.result),
    [pipeline.events, pipeline.result]
  );

  // ── Forensic trace ──────────────────────────────────────────────────
  const [trace, setTrace] = React.useState<TraceLine[]>([]);

  React.useEffect(() => {
    setTrace([
      {
        ts: new Date().toISOString(),
        msg: `session=${sessionId} status=running`,
        level: "info",
      },
      {
        ts: new Date().toISOString(),
        msg: "perspective.detect_label    → awaiting normalization",
        level: "info",
      },
    ]);
  }, [sessionId]);

  React.useEffect(() => {
    pipeline.events.forEach((e) => {
      setTrace((prev) => {
        if (prev.find((p) => p.msg.startsWith(`stage=${e.stage}`))) return prev;
        const next: TraceLine[] = [...prev];
        if (e.stage === "normalization_complete") {
          next.push({
            ts: e.timestamp,
            msg: `perspective.warp_homography → ${e.latencyMs}ms`,
            level: "ok",
          });
          next.push({
            ts: e.timestamp,
            msg: `stage=normalization_complete`,
            level: "ok",
          });
        }
        if (e.stage === "identify_complete") {
          const { payload } = e;
          next.push({
            ts: e.timestamp,
            msg: `identify.classify          → ${e.latencyMs}ms · "${payload.productName}" · confidence=${payload.confidence.toFixed(2)} · ref=${payload.referenceKey ?? "none"}`,
            level: payload.referenceKey === null ? "warn" : "ok",
          });
          next.push({ ts: e.timestamp, msg: "stage=identify_complete", level: "ok" });
        }
        if (e.stage === "ela_complete") {
          const { payload } = e;
          next.push({
            ts: e.timestamp,
            msg: `ela.compute               → ${e.latencyMs}ms · score=${payload.elaScore.toFixed(1)}`,
            level: payload.elaScore < 60 ? "fail" : "ok",
          });
          next.push({ ts: e.timestamp, msg: "stage=ela_complete", level: "ok" });
        }
        if (e.stage === "vlm_complete") {
          const { payload } = e;
          const scoreStr =
            payload.vlmScore == null ? "n/a" : payload.vlmScore.toFixed(1);
          const level: TraceLine["level"] =
            payload.vlmScore == null
              ? "warn"
              : payload.vlmScore < 60
                ? "fail"
                : payload.vlmFindings.length > 0
                  ? "warn"
                  : "ok";
          const detail = payload.referenceAvailable
            ? `score=${scoreStr} · findings=${payload.vlmFindings.length}`
            : `no NAFDAC reference on file — skipping comparison`;
          next.push({
            ts: e.timestamp,
            msg: `vlm.compare_reference     → ${e.latencyMs}ms · ${detail}`,
            level,
          });
          next.push({ ts: e.timestamp, msg: "stage=vlm_complete", level: "ok" });
        }
        if (e.stage === "consensus") {
          const { payload } = e;
          next.push({
            ts: e.timestamp,
            msg: `consensus.compute         → verdict=${payload.verdict} · score=${payload.consensusScore.toFixed(1)}`,
            level:
              payload.verdict === "FAIL"
                ? "fail"
                : payload.verdict === "REVIEW"
                  ? "warn"
                  : "ok",
          });
          next.push({ ts: e.timestamp, msg: "stage=consensus", level: "ok" });
        }
        return next;
      });
    });
  }, [pipeline.events]);

  React.useEffect(() => {
    if (!pipeline.error) return;
    setTrace((prev) => [
      ...prev,
      {
        ts: pipeline.error?.timestamp ?? new Date().toISOString(),
        msg: `stream.error              → failedStage=${pipeline.error?.failedStage} message=${pipeline.error?.message}`,
        level: "fail",
      },
    ]);
  }, [pipeline.error]);

  // SquadCo ledger log status — append a trace line whenever it changes.
  React.useEffect(() => {
    if (ledgerLog.status === "idle" || ledgerLog.status === "logging") return;
    const ts = new Date().toISOString();
    const line: TraceLine =
      ledgerLog.status === "logged"
        ? {
            ts,
            msg: `ledger.scan.logged        → POST /ledger/scan · ${ledgerLog.scanType ?? "scan"}`,
            level: "ok",
          }
        : ledgerLog.status === "skipped"
          ? {
              ts,
              msg: "ledger.scan.skipped       → no backend binary_id for this batch",
              level: "warn",
            }
          : {
              ts,
              msg: `ledger.scan.failed        → ${ledgerLog.error ?? "unknown error"}`,
              level: "warn",
            };
    setTrace((prev) => [...prev, line]);
  }, [ledgerLog.status, ledgerLog.scanType, ledgerLog.error]);

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Forensic verdict · staged reveal
          </p>
          <h1 className="text-h1 mt-1">
            {view.productName ?? "Resolving capture…"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <MonoText size="sm" className="text-[var(--text-tertiary)]">
            session {sessionId}
          </MonoText>
          {pipeline.status === "error" && (
            <Badge status="risk" size="sm" dot>
              stream error
            </Badge>
          )}
        </div>
      </div>

      {/* Stage strip — includes identify only when the pipeline ran it
          (always true for no-batch scans, false when batch context was
          supplied on POST /api/scan). */}
      <StageStrip
        stage={stage}
        showIdentify={
          stage === "identify" ||
          view.identify !== null ||
          // Heuristic: if normalization landed with the placeholder name,
          // identify is about to run. Keep the pill visible.
          (stage === "normalize" &&
            view.productName === "Identifying product…")
        }
      />

      {/* Non-recoverable stream failure — fallback /result fetch also lost.
          We surface this inline so the operator can re-capture rather than
          stare at a frozen stage strip. */}
      {pipeline.status === "error" && !pipeline.result && (
        <Card padded className="mt-4 border-[var(--risk-border)] bg-[var(--risk-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-small font-semibold text-[var(--risk)]">
                Forensic stream failed
              </p>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Stage <MonoText size="sm">{pipeline.error?.failedStage ?? "unknown"}</MonoText>
                {" · "}
                {pipeline.error?.message ?? "Connection dropped before consensus."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/scan")}
                className="rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-small text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
              >
                Re-capture
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-[6px] border border-[var(--risk-border)] bg-[var(--risk)] px-3 py-1.5 text-small font-semibold text-white hover:opacity-90"
              >
                Retry stream
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_320px]">
        {/* Centerpiece — capture + identify + ELA + VLM (replaces by stage) */}
        <div className="space-y-4">
          {(stage === "idle" ||
            stage === "normalize" ||
            stage === "identify" ||
            stage === "ela") && (
            <NormalizeStage
              capturedImageSrc={view.capturedImageSrc}
              elaActive={stage === "ela"}
              elaMap={view.elaMap}
              identify={view.identify}
              identifyActive={stage === "identify"}
            />
          )}
          {stage === "vlm" && view.referenceImage && view.capturedImageSrc && (
            <VLMComparison
              capturedSrc={view.capturedImageSrc}
              referenceSrc={apiUrl(view.referenceImage)}
              productName={view.productName ?? ""}
              findings={view.vlmFindings ?? []}
              score={view.vlmScore ?? 0}
            />
          )}
          {stage === "consensus" && view.result && (
            <>
              <ConsensusReveal result={view.result} onAccept={handleAccept} />
              {view.referenceImage && view.capturedImageSrc && view.referenceAvailable && (
                <VLMComparison
                  capturedSrc={view.capturedImageSrc}
                  referenceSrc={apiUrl(view.referenceImage)}
                  productName={view.productName ?? ""}
                  findings={view.vlmFindings ?? view.result.vlmFindings}
                  score={view.vlmScore ?? view.result.vlmScore ?? 0}
                />
              )}
            </>
          )}
        </div>

        {/* Sidebar — running scores */}
        <ScoreSidebar view={view} stage={stage} />
      </div>

      <ScanForensicTrace
        lines={trace}
        className="mt-5"
        defaultExpanded={stage === "consensus" || pipeline.status === "error"}
      />
    </div>
  );
}

function StageStrip({
  stage,
  showIdentify,
}: {
  stage: Stage;
  showIdentify: boolean;
}) {
  const allSteps: { id: Exclude<Stage, "idle">; label: string }[] = [
    { id: "normalize", label: "Normalize" },
    { id: "identify", label: "Identify · classify product" },
    { id: "ela", label: "ELA · digital integrity" },
    { id: "vlm", label: "VLM · print integrity" },
    { id: "consensus", label: "Consensus" },
  ];
  const steps = showIdentify
    ? allSteps
    : allSteps.filter((s) => s.id !== "identify");
  const order: readonly Exclude<Stage, "idle">[] = steps.map((s) => s.id);
  const reached = (s: Exclude<Stage, "idle">) =>
    stage !== "idle" && order.indexOf(s) < order.indexOf(stage as Exclude<Stage, "idle">);
  const isActive = (s: Exclude<Stage, "idle">) =>
    stage === s ||
    (stage === "idle" && s === "normalize");

  return (
    <div className="mt-5 flex items-center gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div
            className={cn(
              "flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 transition-colors duration-200",
              isActive(s.id)
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : reached(s.id)
                  ? "border-[var(--verified-border)] bg-[var(--verified-soft)] text-[var(--verified)]"
                  : "border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-tertiary)]"
            )}
          >
            <MonoText size="sm">0{i + 1}</MonoText>
            <span className="text-caption uppercase">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <span
              className={cn(
                "h-px w-6",
                reached(steps[i + 1].id)
                  ? "bg-[var(--verified)]"
                  : "bg-[var(--border-hairline)]"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function NormalizeStage({
  capturedImageSrc,
  elaActive,
  elaMap,
  identify,
  identifyActive,
}: {
  capturedImageSrc: string | null;
  elaActive: boolean;
  elaMap: ElaRect[] | null;
  identify: IdentifyPayload | null;
  identifyActive: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 700, h: 480 });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <Card padded>
      <div className="flex items-center justify-between pb-3">
        <CardTitle>
          {elaActive
            ? "ELA · digital integrity scan"
            : identifyActive
              ? "Identifying product"
              : "Normalizing perspective"}
        </CardTitle>
        <Badge
          status={elaActive ? "info" : identifyActive ? "info" : "neutral"}
          size="sm"
          dot
        >
          {elaActive
            ? "scanning pixels"
            : identifyActive
              ? "Claude vision classifying"
              : capturedImageSrc
                ? "warping homography"
                : "uploading capture"}
        </Badge>
      </div>
      {identify && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2">
          <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
            Identified
          </span>
          <span className="text-small font-semibold text-[var(--text-primary)]">
            {identify.productName}
          </span>
          {identify.nafdacRegNumber && (
            <span className="text-[12px] text-[var(--text-secondary)]">
              NAFDAC <MonoText size="sm">{identify.nafdacRegNumber}</MonoText>
            </span>
          )}
          <span className="ml-auto text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
            confidence {Math.round(identify.confidence * 100)}%
          </span>
          {identify.referenceKey === null && (
            <span className="w-full pt-1 text-[11px] text-[var(--pending)]">
              No NAFDAC reference on file — verdict will rely on digital integrity only.
            </span>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="relative aspect-[10/7] overflow-hidden rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)]"
      >
        {capturedImageSrc ? (
          <motion.img
            src={capturedImageSrc}
            alt="capture"
            className="absolute inset-0 h-full w-full object-cover"
            initial={{
              transform:
                "perspective(900px) rotateX(14deg) rotateY(-9deg) scale(0.94)",
              opacity: 0.85,
            }}
            animate={
              elaActive
                ? {
                    transform:
                      "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)",
                    opacity: 0.35,
                  }
                : {
                    transform:
                      "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)",
                    opacity: 1,
                  }
            }
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-mono-small uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              awaiting normalization…
            </span>
          </div>
        )}
        {elaActive && size.w > 0 && elaMap && (
          <ELAHeatmap
            rects={elaMap}
            width={size.w}
            height={size.h}
            durationMs={1400}
          />
        )}
        {!elaActive &&
          (
            [
              "top-3 left-3 border-t-2 border-l-2",
              "top-3 right-3 border-t-2 border-r-2",
              "bottom-3 left-3 border-b-2 border-l-2",
              "bottom-3 right-3 border-b-2 border-r-2",
            ] as const
          ).map((p) => (
            <span
              key={p}
              className={cn(
                "pointer-events-none absolute h-4 w-4 border-[var(--accent)]",
                p
              )}
            />
          ))}
        {elaActive && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[var(--border-strong)] bg-[var(--bg-base)]/80 px-2 py-0.5 backdrop-blur">
            <span className="text-[11px] font-mono-ui uppercase tracking-[0.04em] text-[var(--text-secondary)]">
              ela.requestAnimationFrame · top-left → bottom-right
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function ConsensusReveal({
  result,
  onAccept,
}: {
  result: ScanResult;
  onAccept?: () => void;
}) {
  return (
    <Card padded>
      <div className="flex items-center justify-between pb-3">
        <CardTitle>Consensus</CardTitle>
        <Badge
          status={
            result.verdict === "PASS"
              ? "verified"
              : result.verdict === "REVIEW"
                ? "pending"
                : "risk"
          }
          dot
        >
          {result.verdict}
        </Badge>
      </div>
      <div className="flex flex-col items-center gap-4 border-t border-[var(--border-hairline)] pt-4 sm:flex-row sm:items-center sm:gap-8">
        <ConfidenceGauge score={result.consensusScore} size={200} strokeWidth={10} />
        <div className="flex-1">
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Weighted average
          </p>
          <ul className="mt-1 space-y-1 text-small text-[var(--text-secondary)]">
            <li className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-1">
              <span>ELA · digital integrity</span>
              <MonoText size="sm">{result.elaScore.toFixed(1)}</MonoText>
            </li>
            <li className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-1">
              <span>VLM · print integrity</span>
              <MonoText size="sm">
                {result.vlmScore == null
                  ? "—"
                  : result.vlmScore.toFixed(1)}
              </MonoText>
            </li>
            {result.vlmScore == null && (
              <li className="border-b border-[var(--border-hairline)] pb-1 text-[11px] text-[var(--text-tertiary)]">
                No NAFDAC reference on file for this product — verdict relies
                on digital integrity only.
              </li>
            )}
            <li className="flex items-center justify-between text-[var(--text-primary)]">
              <span className="font-semibold uppercase tracking-[0.04em]">
                Consensus
              </span>
              <MonoText size="lg" className="text-[20px]">
                {result.consensusScore.toFixed(1)}
              </MonoText>
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-5">
        <VerdictCard
          verdict={result.verdict}
          score={result.consensusScore}
          summary={result.summary}
          onAccept={onAccept ?? (() => (window.location.href = "/wallet"))}
          onBlock={() => alert("Settlement blocked. Recorded in ledger.")}
        />
      </div>
    </Card>
  );
}

function ScoreSidebar({ view, stage }: { view: ScanView; stage: Stage }) {
  // ELA has landed, VLM hasn't — Claude vision can take several seconds.
  // Replace the bare "pending" with a labelled affordance so the operator
  // knows where the latency is coming from.
  const vlmAwaitingClaude = view.vlmScore === null && stage === "ela";
  const vlmHasNoReference =
    stage === "consensus" && view.vlmScore === null && !view.referenceAvailable;
  return (
    <Card padded className="sticky top-20 self-start">
      <p className="text-caption uppercase text-[var(--text-tertiary)] pb-3">
        Live scores
      </p>
      <div className="space-y-3 border-t border-[var(--border-hairline)] pt-3">
        <ScoreRow label="ELA · digital integrity" score={view.elaScore} />
        <ScoreRow
          label="VLM · print integrity"
          score={view.vlmScore}
          pendingLabel={
            vlmHasNoReference
              ? "no reference"
              : vlmAwaitingClaude
                ? "awaiting Claude…"
                : undefined
          }
        />
        <div className="border-t border-[var(--border-hairline)] pt-3">
          <ScoreRow
            label="Consensus"
            score={view.result?.consensusScore ?? null}
            big
          />
        </div>
      </div>
      {stage === "idle" && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
          opening session…
        </p>
      )}
    </Card>
  );
}

function ScoreRow({
  label,
  score,
  big,
  pendingLabel,
}: {
  label: string;
  score: number | null | undefined;
  big?: boolean;
  pendingLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={cn(
          "text-[var(--text-secondary)]",
          big
            ? "text-small font-semibold uppercase tracking-[0.04em] text-[var(--text-primary)]"
            : "text-[11px] uppercase tracking-[0.04em]"
        )}
      >
        {label}
      </span>
      {score == null ? (
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
          {pendingLabel && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
          )}
          {pendingLabel ?? "pending"}
        </span>
      ) : (
        <MonoText
          size={big ? "lg" : "md"}
          className={cn(
            big && "text-[20px]",
            score >= 85
              ? "text-[var(--verified)]"
              : score >= 60
                ? "text-[var(--pending)]"
                : "text-[var(--risk)]"
          )}
        >
          {score.toFixed(1)}
        </MonoText>
      )}
    </div>
  );
}
