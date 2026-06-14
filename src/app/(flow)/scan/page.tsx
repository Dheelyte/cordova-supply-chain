"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  Flashlight,
  ScanLine,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { AlignmentOverlay } from "@/components/forensic/AlignmentOverlay";
import { SCAN_FIXTURES } from "@/lib/mock-api/fixtures/scans";
import { findBatch } from "@/lib/mock-api/fixtures/batches";
import { uploadScan, type ScenarioHint } from "@/lib/api/scan";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

/**
 * Map a `ScanFixture.category` to the backend's `scenario` form-field hint.
 * Used by the "Recent captures" rail so a stored capture replays the verdict
 * its label promises. Stage 2+ ignores hints — the real ELA/VLM derive
 * everything from the image bytes.
 */
function scenarioHintFor(
  category: (typeof SCAN_FIXTURES)[number]["category"]
): ScenarioHint | undefined {
  if (category === "authentic") return "authentic_coartem";
  if (category === "counterfeit_digital") return "counterfeit_digital";
  if (category === "counterfeit_print") return "counterfeit_print";
  // Borderline isn't a backend stub yet — fall through to no hint.
  return undefined;
}

/**
 * Fetch a frontend-hosted image into a bitmap blob the backend's OpenCV
 * normalizer can decode. SVGs are rasterized to PNG via canvas at a
 * canonical 1024×716 (matches the reference SVGs' 400×280 aspect at the
 * target normalize width); bitmap formats pass through.
 */
async function bitmapBlobFromUrl(
  url: string
): Promise<{ blob: Blob; filename: string; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`failed to load ${url}: ${response.status}`);
  const sourceBlob = await response.blob();
  const isSvg =
    sourceBlob.type === "image/svg+xml" ||
    url.toLowerCase().endsWith(".svg");
  if (!isSvg) {
    const filename = url.split("/").pop() || "capture.bin";
    return { blob: sourceBlob, filename, contentType: sourceBlob.type };
  }
  // Rasterize the SVG. We use `createImageBitmap` where available (it
  // handles SVG correctly in Chromium + Safari ≥ 17) and fall back to an
  // `Image` element via object URL.
  const bitmap = await loadSvgBitmap(sourceBlob);
  const canvas = document.createElement("canvas");
  // Render at the backend's target normalize width so the warp comes out
  // crisp without resampling artefacts.
  const targetWidth = 1024;
  const aspect = bitmap.height / bitmap.width;
  canvas.width = targetWidth;
  canvas.height = Math.round(targetWidth * aspect);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const pngBlob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      "image/png"
    )
  );
  const filename = (url.split("/").pop() || "capture").replace(/\.svg$/i, ".png");
  return { blob: pngBlob, filename, contentType: "image/png" };
}

async function loadSvgBitmap(svgBlob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(svgBlob);
    } catch {
      // fall through to <img> path
    }
  }
  const url = URL.createObjectURL(svgBlob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("svg <img> load failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

type CameraState =
  | { kind: "pending" }
  | { kind: "live"; stream: MediaStream }
  | { kind: "denied"; reason: string };

export default function ScanCapturePage() {
  const router = useRouter();
  const search = useSearchParams();
  const expectedBatchId = search.get("batchId");
  const expectedBatch = expectedBatchId ? findBatch(expectedBatchId) : null;

  // Fake-align after the viewport is "still" for 1.5s
  const [aligned, setAligned] = React.useState(false);
  const [shutter, setShutter] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [camera, setCamera] = React.useState<CameraState>({ kind: "pending" });
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setAligned(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Request the rear camera. On denial / unsupported we fall back to the
  // synthetic viewfinder; the Recent-captures rail and file picker still work.
  React.useEffect(() => {
    let cancelled = false;
    let acquiredStream: MediaStream | null = null;
    async function acquire() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled)
          setCamera({ kind: "denied", reason: "Camera API unavailable in this browser" });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        acquiredStream = stream;
        setCamera({ kind: "live", stream });
      } catch (e) {
        if (!cancelled)
          setCamera({
            kind: "denied",
            reason: e instanceof Error ? e.message : "Camera access denied",
          });
      }
    }
    void acquire();
    return () => {
      cancelled = true;
      if (acquiredStream) acquiredStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  React.useEffect(() => {
    if (camera.kind === "live" && videoRef.current) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera]);

  async function captureFromVideo(): Promise<{ blob: Blob; filename: string } | null> {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    if (!blob) return null;
    return { blob, filename: `capture-${Date.now()}.jpg` };
  }

  async function captureFixture(fixtureId: string) {
    const fixture = SCAN_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    setShutter(true);
    try {
      const { blob, filename } = await bitmapBlobFromUrl(fixture.referenceImage);
      const { sessionId } = await uploadScan({
        file: blob,
        filename,
        batchId: expectedBatchId ?? undefined,
        scenario: scenarioHintFor(fixture.category),
      });
      router.push(`/scan/${encodeURIComponent(sessionId)}/result`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `Upload rejected (${e.status}): ${e.message}`
          : e instanceof Error
            ? e.message
            : "Upload failed — is the forensic backend running?"
      );
      setShutter(false);
      setBusy(false);
    }
  }

  async function captureFromFile(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setShutter(true);
    try {
      const { sessionId } = await uploadScan({
        file,
        filename: file.name || "capture",
        batchId: expectedBatchId ?? undefined,
        // When a batch is in context, ship its product name so the backend
        // skips the identify stage and uses the batch identity as truth.
        productName: expectedBatch
          ? `${expectedBatch.productName} ${expectedBatch.dosage}`.trim()
          : undefined,
        nafdacRegNumber: expectedBatch?.nafdacReg ?? undefined,
      });
      router.push(`/scan/${encodeURIComponent(sessionId)}/result`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `Upload rejected (${e.status}): ${e.message}`
          : e instanceof Error
            ? e.message
            : "Upload failed — is the forensic backend running?"
      );
      setShutter(false);
      setBusy(false);
    }
  }

  // Shutter button — if a live camera is attached, grab a real frame and
  // upload it. Without a camera (denied, no hardware, headless tests) fall
  // back to re-uploading the first recent-captures item so the demo path
  // still functions.
  async function captureFromCamera() {
    if (busy) return;
    if (camera.kind !== "live") {
      const first = SCAN_FIXTURES[0];
      if (first) await captureFixture(first.id);
      return;
    }
    setBusy(true);
    setError(null);
    setShutter(true);
    try {
      const frame = await captureFromVideo();
      if (!frame) throw new Error("Camera not ready — try again in a moment.");
      const { sessionId } = await uploadScan({
        file: frame.blob,
        filename: frame.filename,
        batchId: expectedBatchId ?? undefined,
        productName: expectedBatch
          ? `${expectedBatch.productName} ${expectedBatch.dosage}`.trim()
          : undefined,
        nafdacRegNumber: expectedBatch?.nafdacReg ?? undefined,
      });
      router.push(`/scan/${encodeURIComponent(sessionId)}/result`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `Upload rejected (${e.status}): ${e.message}`
          : e instanceof Error
            ? e.message
            : "Capture failed — try again."
      );
      setShutter(false);
      setBusy(false);
    }
  }

  return (
    <div className="relative h-[calc(100vh-48px)] w-full overflow-hidden bg-[var(--bg-base)]">
      {/* Camera viewfinder */}
      <div className="absolute inset-0">
        <CameraSurface camera={camera} videoRef={videoRef} />
        <AlignmentOverlay aligned={aligned} />
      </div>

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-[var(--bg-base)]/85 to-transparent px-5 py-3">
        <div className="flex items-center gap-2">
          <Badge status="accent" dot>
            Forensic scan
          </Badge>
          {expectedBatch ? (
            <p className="text-small text-[var(--text-secondary)]">
              Verifying{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {expectedBatch.productName} · {expectedBatch.dosage}
              </span>{" "}
              · batch{" "}
              <MonoText size="sm" className="text-[var(--text-tertiary)]">
                {expectedBatch.id.slice(0, 8)}…
              </MonoText>
            </p>
          ) : (
            <p className="text-small text-[var(--text-secondary)]">
              Open scan · no batch context
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {camera.kind === "pending" && (
            <Badge status="pending" size="sm" dot>
              Camera starting…
            </Badge>
          )}
          {camera.kind === "live" && (
            <Badge status="verified" size="sm" dot>
              Camera live
            </Badge>
          )}
          {camera.kind === "denied" && (
            <Badge status="neutral" size="sm" dot>
              No camera · catalogue only
            </Badge>
          )}
          {busy && (
            <Badge status="info" size="sm" dot>
              Uploading capture…
            </Badge>
          )}
          {error && (
            <Badge status="risk" size="sm" dot>
              {error}
            </Badge>
          )}
          <Badge status="neutral" size="sm" dot>
            <ScanLine className="h-2.5 w-2.5" />
            ELA + VLM + CNN
          </Badge>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[var(--bg-base)]/95 to-transparent pb-6 pt-12">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between px-6">
          <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]">
            <ImageIcon className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void captureFromFile(f);
              }}
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void captureFromCamera()}
            className={cn(
              "relative flex h-[68px] w-[68px] items-center justify-center rounded-full",
              "border-[4px] border-[var(--accent)] bg-[var(--bg-base)]",
              "transition-transform duration-150 active:scale-95",
              aligned && "shadow-[0_0_0_2px_var(--accent-soft)]"
            )}
            aria-label="Capture"
          >
            <span className="block h-12 w-12 rounded-full bg-[var(--accent)]" />
          </button>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]"
            aria-label="Torch"
          >
            <Flashlight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Shutter overlay */}
      <AnimatePresence>
        {shutter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute inset-0 z-30 bg-white"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CameraSurface({
  camera,
  videoRef,
}: {
  camera: CameraState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const showLiveVideo = camera.kind === "live";
  return (
    <div className="absolute inset-0 bg-[var(--bg-inset)]">
      {/* Live camera feed — only mounted when a stream is attached. */}
      {showLiveVideo && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <motion.span
        aria-hidden
        className="absolute left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
        initial={{ y: 0, opacity: 0.4 }}
        animate={{ y: "100%", opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
      {!showLiveVideo && (
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[210px] w-[290px] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60"
        >
          <div className="m-3 h-3 w-12 rounded-[3px] bg-[var(--border-strong)]/60" />
          <div className="m-3 mt-2 h-2 w-32 rounded-[2px] bg-[var(--border-strong)]/40" />
          <div className="m-3 mt-1 h-2 w-24 rounded-[2px] bg-[var(--border-strong)]/40" />
        </div>
      )}
    </div>
  );
}
