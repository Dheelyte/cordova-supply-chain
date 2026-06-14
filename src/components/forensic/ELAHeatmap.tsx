"use client";

import * as React from "react";
import type { ElaRect } from "@/lib/mock-api/fixtures/ela-maps";

export interface ELAHeatmapProps {
  rects: ElaRect[];
  /** Canvas width in CSS pixels */
  width: number;
  height: number;
  /** Duration of the progressive paint in ms */
  durationMs?: number;
  onComplete?: () => void;
}

/**
 * Renders the ELA heatmap pixel-by-pixel, top-left → bottom-right,
 * over `durationMs`. Hot regions glow yellow→red by intensity from the
 * fixture. Each rect contributes a radial falloff at its (x,y,w,h) center.
 */
export function ELAHeatmap({
  rects,
  width,
  height,
  durationMs = 1500,
  onComplete,
}: ELAHeatmapProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number | null>(null);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Precompute per-pixel intensity (0–1) at downsampled resolution
    const SCALE = 4; // every 4px square gets a single sample
    const cols = Math.ceil(width / SCALE);
    const rows = Math.ceil(height / SCALE);
    const sample = new Float32Array(cols * rows);

    // Background uniform noise (very low)
    for (let i = 0; i < sample.length; i++) {
      sample[i] = Math.random() * 0.03;
    }

    // Layer in each rect using a radial gaussian-ish falloff
    rects.forEach((r) => {
      const cx = (r.x + r.w / 2) * width;
      const cy = (r.y + r.h / 2) * height;
      const rx = (r.w * width) / 2;
      const ry = (r.h * height) / 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = col * SCALE + SCALE / 2;
          const py = row * SCALE + SCALE / 2;
          const dx = (px - cx) / rx;
          const dy = (py - cy) / ry;
          const d2 = dx * dx + dy * dy;
          // Soft-edged ellipse: full intensity inside d^2 < 1, smooth falloff outside
          const fall = Math.exp(-d2 * 1.6);
          const v = r.intensity * fall;
          if (v > sample[row * cols + col]) sample[row * cols + col] = v;
        }
      }
    });

    function colorFor(v: number): [number, number, number, number] {
      // Below 0.18 → invisible; otherwise yellow (#FFB020) → red (#FF3D5A)
      if (v < 0.18) return [0, 0, 0, 0];
      const t = Math.min(1, (v - 0.18) / 0.7);
      // hex pairs
      // yellow:  255, 176, 32  → red: 255, 61, 90
      const r = Math.round(255 + t * (255 - 255));
      const g = Math.round(176 + t * (61 - 176));
      const b = Math.round(32 + t * (90 - 32));
      const a = Math.round(170 + 60 * Math.min(1, v));
      return [r, g, b, a];
    }

    // Progressive paint: walk rows top → bottom; each frame fills the next
    // group of rows so total time ≈ durationMs.
    const totalGroups = 30;
    const groupRows = Math.ceil(rows / totalGroups);
    const groupMs = durationMs / totalGroups;
    let g = 0;
    let last = performance.now();

    const paint = (now: number) => {
      if (now - last < groupMs && g > 0) {
        rafRef.current = requestAnimationFrame(paint);
        return;
      }
      const startRow = g * groupRows;
      const endRow = Math.min(rows, (g + 1) * groupRows);
      for (let row = startRow; row < endRow; row++) {
        for (let col = 0; col < cols; col++) {
          const v = sample[row * cols + col];
          const [r, gg, bb, a] = colorFor(v);
          if (a === 0) continue;
          ctx.fillStyle = `rgba(${r},${gg},${bb},${a / 255})`;
          ctx.fillRect(col * SCALE, row * SCALE, SCALE, SCALE);
        }
      }
      last = now;
      g++;
      if (g <= totalGroups) {
        rafRef.current = requestAnimationFrame(paint);
      } else {
        onCompleteRef.current?.();
      }
    };
    rafRef.current = requestAnimationFrame(paint);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, width, height);
    };
  }, [rects, width, height, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 mix-blend-screen"
      aria-hidden
    />
  );
}
