import { ELA_MAPS } from "./ela-maps";
import type { ElaRect, Verdict, VlmFinding } from "@/lib/contract/scan";

// Re-export the canonical wire primitives so existing imports keep working.
export type { ElaRect, Verdict, VlmFinding } from "@/lib/contract/scan";

/**
 * The mock catalogue entry — the in-browser simulator's source data.
 *
 * It is NOT a wire type and does not cross the network: it carries two
 * catalogue-only fields (`label`, `category`) plus its own catalogue `id`.
 * The simulator maps a `ScanFixture` + a minted `sessionId` into the
 * canonical contract events (see `ws-simulator.ts`). Build Stage 6 retires
 * the simulator and the frontend consumes `ScanResult` from the backend
 * directly.
 *
 * Its forensic fields (scores, `verdict`, `elaMap`, `vlmFindings`) are typed
 * from the canonical contract primitives so the catalogue can never drift
 * from the wire shape.
 */
export interface ScanFixture {
  /** Catalogue id — selects which scenario the simulator plays. */
  id: string;
  /** Drug context the scan is run against. */
  productName: string;
  /** Optional batchId the scan was performed in support of. */
  batchId?: string;
  /** Short label for list rows — catalogue-only. */
  label: string;
  /** Catalogue grouping — catalogue-only. */
  category:
    | "authentic"
    | "counterfeit_digital"
    | "counterfeit_print"
    | "borderline";
  capturedAt: string;
  elaScore: number; // 0–100
  vlmScore: number; // 0–100
  consensusScore: number; // weighted average
  verdict: Verdict;
  elaMap: ElaRect[];
  vlmFindings: VlmFinding[];
  /** A summary line shown above the verdict card. */
  summary: string;
  /** Reference image path under /reference. */
  referenceImage: string;
}

export const SCAN_FIXTURES: ScanFixture[] = [
  {
    id: "scan_authentic_a",
    productName: "Coartem 80/480mg",
    batchId: undefined,
    label: "Authentic · Coartem",
    category: "authentic",
    capturedAt: "2026-05-11T17:42:18.001Z",
    elaScore: 96.2,
    vlmScore: 94.4,
    consensusScore: 95.4,
    verdict: "PASS",
    elaMap: ELA_MAPS.authentic_a,
    vlmFindings: [],
    summary: "All forensic checks consistent with NAFDAC reference image.",
    referenceImage: "/reference/coartem.svg",
  },
  {
    id: "scan_authentic_b",
    productName: "Augmentin 625mg",
    label: "Authentic · Augmentin",
    category: "authentic",
    capturedAt: "2026-05-11T17:44:02.214Z",
    elaScore: 94.8,
    vlmScore: 92.1,
    consensusScore: 93.6,
    verdict: "PASS",
    elaMap: ELA_MAPS.authentic_b,
    vlmFindings: [],
    summary: "Print and digital integrity within tolerance.",
    referenceImage: "/reference/augmentin.svg",
  },
  {
    id: "scan_authentic_c",
    productName: "Lonart 80/480mg",
    label: "Authentic · Lonart",
    category: "authentic",
    capturedAt: "2026-05-11T17:45:33.881Z",
    elaScore: 95.1,
    vlmScore: 93.7,
    consensusScore: 94.5,
    verdict: "PASS",
    elaMap: ELA_MAPS.authentic_c,
    vlmFindings: [],
    summary: "Manufacturer signature matches initialization hop.",
    referenceImage: "/reference/lonart.svg",
  },
  {
    id: "scan_counterfeit_digital",
    productName: "Coartem 80/480mg",
    label: "Counterfeit · Digital",
    category: "counterfeit_digital",
    capturedAt: "2026-05-11T17:47:11.402Z",
    elaScore: 24.8,
    vlmScore: 78.4,
    consensusScore: 41.2,
    verdict: "FAIL",
    elaMap: ELA_MAPS.counterfeit_digital,
    vlmFindings: [
      {
        id: 1,
        x: 0.74,
        y: 0.16,
        title: "Expiry-date region resampled",
        detail:
          "ELA noise concentrated 920% above local baseline. Pixel-level inconsistencies indicate digital alteration.",
        severity: "critical",
      },
    ],
    summary: "Expiry date appears digitally altered. Block transfer.",
    referenceImage: "/reference/coartem.svg",
  },
  {
    id: "scan_counterfeit_print",
    productName: "Augmentin 625mg",
    label: "Counterfeit · Print",
    category: "counterfeit_print",
    capturedAt: "2026-05-11T17:49:22.118Z",
    elaScore: 71.2,
    vlmScore: 32.8,
    consensusScore: 48.1,
    verdict: "FAIL",
    elaMap: ELA_MAPS.counterfeit_print,
    vlmFindings: [
      {
        id: 1,
        x: 0.18,
        y: 0.22,
        title: "Font weight discrepancy",
        detail:
          "Batch number rendered 18% lighter than the NAFDAC reference. Indicates inkjet print substitution.",
        severity: "critical",
      },
      {
        id: 2,
        x: 0.84,
        y: 0.68,
        title: "Logo positioning offset",
        detail:
          "Manufacturer logo offset by 2.4mm (1.2% relative). Genuine packaging tolerance is ≤ 0.3mm.",
        severity: "warning",
      },
      {
        id: 3,
        x: 0.5,
        y: 0.52,
        title: "Security seal pattern mismatch",
        detail:
          "Diagonal spacing inconsistent with reference micro-pattern. Holographic foil absent under polarized inspection.",
        severity: "critical",
      },
    ],
    summary: "Three print discrepancies from NAFDAC reference. Block transfer.",
    referenceImage: "/reference/augmentin.svg",
  },
  {
    id: "scan_borderline",
    productName: "Lonart 80/480mg",
    label: "Borderline · scratch-code escalation",
    category: "borderline",
    capturedAt: "2026-05-11T17:51:04.011Z",
    elaScore: 64.8,
    vlmScore: 60.2,
    consensusScore: 62.0,
    verdict: "REVIEW",
    elaMap: ELA_MAPS.borderline,
    vlmFindings: [
      {
        id: 1,
        x: 0.27,
        y: 0.36,
        title: "Mild noise on dosage panel",
        detail:
          "Localised ELA noise on the dosage panel. Within ambiguity band — scratch-code escalation required.",
        severity: "info",
      },
    ],
    summary: "Confidence in ambiguity band. Escalating to scratch-code verification.",
    referenceImage: "/reference/lonart.svg",
  },
];

export function findScan(id: string): ScanFixture | undefined {
  return SCAN_FIXTURES.find((s) => s.id === id);
}
