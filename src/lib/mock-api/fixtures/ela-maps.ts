/**
 * Normalized (0–1) hot-spot rectangles used by the ELA canvas painter.
 * The shape is owned by the canonical pipeline contract; re-exported here
 * so the mock catalogue keeps a stable import path.
 */
export type { ElaRect } from "@/lib/contract/scan";
import type { ElaRect } from "@/lib/contract/scan";

export const ELA_MAPS: Record<string, ElaRect[]> = {
  // Authentic — mostly uniform, very low noise scattered evenly
  authentic_a: [
    { x: 0.12, y: 0.18, w: 0.08, h: 0.05, intensity: 0.08 },
    { x: 0.34, y: 0.42, w: 0.06, h: 0.04, intensity: 0.12 },
    { x: 0.72, y: 0.71, w: 0.07, h: 0.05, intensity: 0.1 },
  ],
  authentic_b: [
    { x: 0.18, y: 0.22, w: 0.05, h: 0.04, intensity: 0.06 },
    { x: 0.55, y: 0.55, w: 0.07, h: 0.05, intensity: 0.09 },
  ],
  authentic_c: [
    { x: 0.22, y: 0.28, w: 0.06, h: 0.04, intensity: 0.07 },
    { x: 0.61, y: 0.18, w: 0.07, h: 0.05, intensity: 0.11 },
    { x: 0.42, y: 0.78, w: 0.05, h: 0.04, intensity: 0.08 },
  ],

  // Counterfeit-Digital — concentrated hot blob over expiry-date region
  // (top-right of label where the date conventionally sits)
  counterfeit_digital: [
    { x: 0.61, y: 0.08, w: 0.3, h: 0.12, intensity: 0.92 },
    { x: 0.64, y: 0.1, w: 0.24, h: 0.08, intensity: 0.98 },
    { x: 0.66, y: 0.12, w: 0.2, h: 0.05, intensity: 1.0 },
    // small bleed
    { x: 0.58, y: 0.15, w: 0.06, h: 0.04, intensity: 0.42 },
    { x: 0.88, y: 0.14, w: 0.04, h: 0.04, intensity: 0.36 },
  ],

  // Counterfeit-Print — diffuse mid-intensity across logo + seal region
  counterfeit_print: [
    { x: 0.08, y: 0.12, w: 0.18, h: 0.18, intensity: 0.62 },
    { x: 0.78, y: 0.6, w: 0.16, h: 0.22, intensity: 0.68 },
    { x: 0.42, y: 0.46, w: 0.18, h: 0.12, intensity: 0.51 },
    { x: 0.32, y: 0.78, w: 0.12, h: 0.08, intensity: 0.44 },
  ],

  // Borderline — some elevated noise but not concentrated
  borderline: [
    { x: 0.21, y: 0.32, w: 0.1, h: 0.08, intensity: 0.32 },
    { x: 0.62, y: 0.28, w: 0.12, h: 0.08, intensity: 0.38 },
    { x: 0.48, y: 0.62, w: 0.1, h: 0.08, intensity: 0.41 },
  ],
};
