"use client";

import * as React from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { cn } from "@/lib/utils/cn";

interface LiveBarcodeScannerProps {
  onDecode: (text: string, format: string) => void;
  className?: string;
}

type CameraState =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "live" }
  | { kind: "denied"; reason: string };

/**
 * Live barcode / QR scanner.
 *
 * Camera acquisition and ZXing decoding are split: we own the MediaStream
 * (so the video element is wired up the same way as any other webcam UI
 * in the app), then hand the playing element to `decodeFromVideoElement`.
 * This keeps the video element predictable across re-renders and makes
 * the "what state am I in" debugging obvious.
 */
export function LiveBarcodeScanner({
  onDecode,
  className,
}: LiveBarcodeScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const controlsRef = React.useRef<IScannerControls | null>(null);
  const lastDecodeRef = React.useRef<string | null>(null);
  const onDecodeRef = React.useRef(onDecode);
  onDecodeRef.current = onDecode;

  const [camera, setCamera] = React.useState<CameraState>({ kind: "idle" });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function start() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCamera({
          kind: "denied",
          reason: "Camera API unavailable in this browser.",
        });
        return;
      }
      setCamera({ kind: "requesting" });

      // 1. Acquire the camera stream ourselves so we have a predictable
      //    handle for cleanup and we can guarantee the video element is
      //    actually playing before ZXing starts pulling frames.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (e) {
        if (cancelled) return;
        setCamera({
          kind: "denied",
          reason:
            e instanceof DOMException
              ? `${e.name}: ${e.message}`
              : e instanceof Error
                ? e.message
                : "Camera access denied.",
        });
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // autoplay block — `autoPlay` + muted + playsInline usually wins.
      }
      if (cancelled) return;
      setCamera({ kind: "live" });

      // 2. Hand the already-playing element to ZXing for decoding.
      const reader = new BrowserMultiFormatReader();
      try {
        const controls = await reader.decodeFromVideoElement(
          video,
          (result, err) => {
            if (result) {
              const text = result.getText();
              if (text === lastDecodeRef.current) return;
              lastDecodeRef.current = text;
              onDecodeRef.current(text, String(result.getBarcodeFormat()));
            }
            // ZXing emits NotFoundException every frame without a code —
            // expected, not an error.
            void err;
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch {
        // Decoding failed — but the camera preview still works, which is
        // recoverable. User can paste the barcode manually.
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [reloadKey]);

  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-[10px] border border-[var(--border-strong)] bg-black",
        className
      )}
    >
      {/* The video is always mounted at full opacity. CSS keeps it filling
          the aspect-locked box so the user sees the live feed the moment
          the stream attaches. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Status overlays sit on top of the video. */}
      {(camera.kind === "idle" || camera.kind === "requesting") && (
        <CenterMessage>
          <Camera className="h-5 w-5 text-white/80" />
          <p className="mt-2 text-small text-white/80">
            {camera.kind === "requesting"
              ? "Requesting camera…"
              : "Initialising…"}
          </p>
        </CenterMessage>
      )}

      {camera.kind === "denied" && (
        <CenterMessage>
          <CameraOff className="h-5 w-5 text-[var(--risk)]" />
          <p className="mt-2 text-small text-white">Camera unavailable</p>
          <p className="mt-1 max-w-[280px] text-[12px] text-white/70">
            {camera.reason}
          </p>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<RefreshCw />}
            className="mt-3"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Retry
          </Button>
        </CenterMessage>
      )}

      {camera.kind === "live" && (
        <>
          <div className="pointer-events-none absolute inset-0">
            {/* Center reticle line */}
            <div className="absolute inset-x-[10%] top-1/2 h-[2px] -translate-y-1/2 bg-[var(--accent)] opacity-80" />
            {(["tl", "tr", "bl", "br"] as const).map((c) => (
              <div
                key={c}
                aria-hidden
                className={cn(
                  "absolute h-5 w-5 border-[var(--accent)]",
                  c === "tl" && "left-3 top-3 border-l-2 border-t-2",
                  c === "tr" && "right-3 top-3 border-r-2 border-t-2",
                  c === "bl" && "left-3 bottom-3 border-l-2 border-b-2",
                  c === "br" && "right-3 bottom-3 border-r-2 border-b-2"
                )}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute left-3 top-3">
            <Badge size="sm" status="info" dot>
              live · @zxing
            </Badge>
          </div>
          <div className="pointer-events-none absolute right-3 bottom-3">
            <MonoText size="sm" className="text-white/85">
              point pack at center
            </MonoText>
          </div>
        </>
      )}
    </div>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
      {children}
    </div>
  );
}
