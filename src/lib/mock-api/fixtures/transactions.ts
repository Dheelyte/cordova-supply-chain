export type TransactionType = "validated" | "fraud_blocked" | "pending";

export interface MockTransaction {
  id: string; // TXN_xxxxxx
  timestamp: string;
  amount: number; // NGN
  type: TransactionType;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  /** Linked scan + batch (forensic evidence) */
  linkedScanId?: string;
  linkedBatchId?: string;
  /** Final consensus score from the linked scan */
  verdictScore?: number;
  /** Squad settlement reference, if validated */
  squadRef?: string;
  /** Reason for fraud_blocked transactions */
  blockReason?: string;
  /** Recipient bank info (masked) */
  recipientBank?: string;
  recipientNubanMasked?: string;
}

export const MOCK_TRANSACTIONS: MockTransaction[] = [
  // Validated transfers (9)
  {
    id: "TXN_8a4f9c12c102",
    timestamp: "2026-05-10T14:22:18.491Z",
    amount: 2_400_000,
    type: "validated",
    fromUserId: "usr_91c4f2e8a047",
    fromName: "HealthPlus Pharmacy · VI",
    toUserId: "usr_3f1a82c7e9d4",
    toName: "Idumota Health Distribution",
    linkedScanId: "scan_authentic_a",
    linkedBatchId: "batch-coartem-001",
    verdictScore: 95.4,
    squadRef: "SQD_TRF_001a7b",
    recipientBank: "Access Bank",
    recipientNubanMasked: "••••1847",
  },
  {
    id: "TXN_a04f9c8b4e72",
    timestamp: "2026-05-09T10:08:42.221Z",
    amount: 1_850_000,
    type: "validated",
    fromUserId: "usr_a3b4d1e29f12",
    fromName: "Medplus Pharmacy · Wuse II",
    toUserId: "usr_3f1a82c7e9d4",
    toName: "Idumota Health Distribution",
    linkedScanId: "scan_authentic_b",
    linkedBatchId: "batch-augmentin-001",
    verdictScore: 93.6,
    squadRef: "SQD_TRF_002c8d",
    recipientBank: "Access Bank",
    recipientNubanMasked: "••••1847",
  },
  {
    id: "TXN_b7e2c81f4a39",
    timestamp: "2026-05-08T16:42:11.118Z",
    amount: 980_000,
    type: "validated",
    fromUserId: "usr_b7e2c81f4a39",
    fromName: "ChemCare Pharmacy · Bodija",
    toUserId: "usr_72b1e09f1c38",
    toName: "MediBio Industries",
    linkedScanId: "scan_authentic_c",
    linkedBatchId: "batch-augmentin-002",
    verdictScore: 94.5,
    squadRef: "SQD_TRF_003e9f",
    recipientBank: "Zenith Bank",
    recipientNubanMasked: "••••2841",
  },
  {
    id: "TXN_c4d1e2f3a4b5",
    timestamp: "2026-05-07T09:14:55.402Z",
    amount: 4_200_000,
    type: "validated",
    fromUserId: "usr_3f1a82c7e9d4",
    fromName: "Idumota Health Distribution",
    toUserId: "usr_8a4f9c12c102",
    toName: "Lagos Pharma Ltd",
    linkedScanId: "scan_authentic_a",
    linkedBatchId: "batch-coartem-001",
    verdictScore: 95.4,
    squadRef: "SQD_TRF_004g0h",
    recipientBank: "GTBank",
    recipientNubanMasked: "••••2913",
  },
  {
    id: "TXN_d5e6f7a8b9c0",
    timestamp: "2026-05-06T13:21:08.221Z",
    amount: 1_120_000,
    type: "validated",
    fromUserId: "usr_5d8e3f7b1a92",
    fromName: "Northern Meds Distribution",
    toUserId: "usr_8a4f9c12c102",
    toName: "Lagos Pharma Ltd",
    linkedScanId: "scan_authentic_a",
    linkedBatchId: "batch-lonart-002",
    verdictScore: 95.4,
    squadRef: "SQD_TRF_005i1j",
    recipientBank: "GTBank",
    recipientNubanMasked: "••••2913",
  },
  {
    id: "TXN_e1f2a3b4c5d6",
    timestamp: "2026-05-05T11:08:14.117Z",
    amount: 2_750_000,
    type: "validated",
    fromUserId: "usr_91c4f2e8a047",
    fromName: "HealthPlus Pharmacy · VI",
    toUserId: "usr_8a4f9c12c102",
    toName: "Lagos Pharma Ltd",
    linkedScanId: "scan_authentic_c",
    linkedBatchId: "batch-lonart-001",
    verdictScore: 94.5,
    squadRef: "SQD_TRF_006k2l",
    recipientBank: "GTBank",
    recipientNubanMasked: "••••2913",
  },
  {
    id: "TXN_f7a8b9c0d1e2",
    timestamp: "2026-05-04T15:42:33.881Z",
    amount: 3_400_000,
    type: "validated",
    fromUserId: "usr_a3b4d1e29f12",
    fromName: "Medplus Pharmacy · Wuse II",
    toUserId: "usr_72b1e09f1c38",
    toName: "MediBio Industries",
    linkedScanId: "scan_authentic_b",
    linkedBatchId: "batch-augmentin-001",
    verdictScore: 93.6,
    squadRef: "SQD_TRF_007m3n",
    recipientBank: "Zenith Bank",
    recipientNubanMasked: "••••2841",
  },
  {
    id: "TXN_a3b4d1e29f12",
    timestamp: "2026-05-03T08:11:42.221Z",
    amount: 720_000,
    type: "validated",
    fromUserId: "usr_b7e2c81f4a39",
    fromName: "ChemCare Pharmacy · Bodija",
    toUserId: "usr_3f1a82c7e9d4",
    toName: "Idumota Health Distribution",
    linkedScanId: "scan_authentic_b",
    linkedBatchId: "batch-augmentin-002",
    verdictScore: 93.6,
    squadRef: "SQD_TRF_008o4p",
    recipientBank: "Access Bank",
    recipientNubanMasked: "••••1847",
  },
  {
    id: "TXN_a4b5c6d7e8f9",
    timestamp: "2026-05-02T17:32:18.402Z",
    amount: 1_540_000,
    type: "validated",
    fromUserId: "usr_5d8e3f7b1a92",
    fromName: "Northern Meds Distribution",
    toUserId: "usr_72b1e09f1c38",
    toName: "MediBio Industries",
    linkedScanId: "scan_authentic_c",
    linkedBatchId: "batch-augmentin-003",
    verdictScore: 94.5,
    squadRef: "SQD_TRF_009q5r",
    recipientBank: "Zenith Bank",
    recipientNubanMasked: "••••2841",
  },

  // Fraud blocked (4)
  {
    id: "TXN_FRAUD_001x9z",
    timestamp: "2026-05-10T20:11:08.491Z",
    amount: 1_800_000,
    type: "fraud_blocked",
    fromUserId: "usr_91c4f2e8a047",
    fromName: "HealthPlus Pharmacy · VI",
    toUserId: "usr_ghost_tin_mismatch",
    toName: "Quick Pharma Wholesale",
    linkedScanId: "scan_counterfeit_digital",
    verdictScore: 41.2,
    blockReason:
      "Forensic AI verdict FAIL (41.2/100). ELA flagged tampering on expiry-date region. Vendor TIN/CAC mismatch.",
  },
  {
    id: "TXN_FRAUD_002y0a",
    timestamp: "2026-05-09T18:42:33.118Z",
    amount: 2_240_000,
    type: "fraud_blocked",
    fromUserId: "usr_a3b4d1e29f12",
    fromName: "Medplus Pharmacy · Wuse II",
    toUserId: "usr_ghost_residential",
    toName: "Premier Drug Mart",
    linkedScanId: "scan_counterfeit_print",
    verdictScore: 48.1,
    blockReason:
      "Forensic AI verdict FAIL (48.1/100). VLM flagged 3 print discrepancies. Vendor premise resolves to residential apartment.",
  },
  {
    id: "TXN_FRAUD_003a1b",
    timestamp: "2026-05-08T22:08:14.221Z",
    amount: 940_000,
    type: "fraud_blocked",
    fromUserId: "usr_b7e2c81f4a39",
    fromName: "ChemCare Pharmacy · Bodija",
    toUserId: "usr_ghost_tin_mismatch",
    toName: "Quick Pharma Wholesale",
    linkedScanId: "scan_counterfeit_digital",
    verdictScore: 41.2,
    blockReason:
      "Forensic AI verdict FAIL. Identity Wall blocked vendor (suspended status).",
  },
  {
    id: "TXN_FRAUD_004c2d",
    timestamp: "2026-05-07T15:18:42.991Z",
    amount: 1_360_000,
    type: "fraud_blocked",
    fromUserId: "usr_91c4f2e8a047",
    fromName: "HealthPlus Pharmacy · VI",
    toUserId: "usr_ghost_residential",
    toName: "Premier Drug Mart",
    linkedScanId: "scan_counterfeit_print",
    verdictScore: 48.1,
    blockReason:
      "Custody chain anomaly: claimed handoff did not appear in source manufacturer's outbound ledger.",
  },

  // Pending (2)
  {
    id: "TXN_PEND_001e3f",
    timestamp: "2026-05-11T09:14:08.401Z",
    amount: 1_640_000,
    type: "pending",
    fromUserId: "usr_91c4f2e8a047",
    fromName: "HealthPlus Pharmacy · VI",
    toUserId: "usr_3f1a82c7e9d4",
    toName: "Idumota Health Distribution",
    linkedScanId: "scan_borderline",
    verdictScore: 62.0,
    recipientBank: "Access Bank",
    recipientNubanMasked: "••••1847",
  },
  {
    id: "TXN_PEND_002g4h",
    timestamp: "2026-05-11T10:42:55.118Z",
    amount: 820_000,
    type: "pending",
    fromUserId: "usr_b7e2c81f4a39",
    fromName: "ChemCare Pharmacy · Bodija",
    toUserId: "usr_72b1e09f1c38",
    toName: "MediBio Industries",
    linkedScanId: undefined,
    recipientBank: "Zenith Bank",
    recipientNubanMasked: "••••2841",
  },
];

export const TRANSACTION_TOTALS = {
  validatedYTD: MOCK_TRANSACTIONS.filter((t) => t.type === "validated").reduce(
    (s, t) => s + t.amount,
    487_204_910
  ),
  fraudBlockedYTD: MOCK_TRANSACTIONS.filter(
    (t) => t.type === "fraud_blocked"
  ).reduce((s, t) => s + t.amount, 84_120_440),
};
