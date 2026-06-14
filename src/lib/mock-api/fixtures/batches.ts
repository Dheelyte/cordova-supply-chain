export type CustodyAction =
  | "initialized"
  | "dispatched"
  | "in_transit"
  | "received"
  | "stored"
  | "split"
  | "dispensed";

export interface CustodyHop {
  hopId: string;
  actorId: string;
  actorName: string;
  actorRole: "manufacturer" | "wholesaler" | "retailer" | "consumer";
  action: CustodyAction;
  timestamp: string;
  lat: number;
  lng: number;
  city: string;
  deviceFingerprint: string;
  /** Server-side signature; mono display */
  signature: string;
  units?: number;
  notes?: string;
  /** Mark a hop as anomalous (e.g. impossible travel) */
  anomaly?: {
    kind: "impossible_travel" | "device_mismatch" | "out_of_window";
    detail: string;
    distanceKm?: number;
    claimedMinutes?: number;
    minimumMinutes?: number;
  };
}

export interface MockBatch {
  id: string; // 64 hex chars
  shortId: string; // first 12 for display
  productName: string;
  dosage: string;
  manufacturerId: string;
  manufacturerName: string;
  nafdacReg: string; // e.g. "04-1234"
  manufactureDate: string; // ISO
  expiryDate: string; // ISO
  unitCount: number;
  currentHolderId: string;
  status: "in_custody" | "delivered" | "flagged" | "split";
  custody: CustodyHop[];
  elaFingerprint: string; // 16-char hash
  flagged?: boolean;
}

function hex(len: number, seed: string): string {
  // Deterministic faux-hex from a seed
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  while (out.length < len) {
    h = Math.imul(h ^ (h >>> 13), 1597334677);
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, len);
}

export const MOCK_BATCHES: MockBatch[] = [
  {
    id: hex(64, "batch-coartem-001"),
    shortId: "",
    productName: "Coartem",
    dosage: "80/480mg · 6 tablets",
    manufacturerId: "usr_8a4f9c12c102",
    manufacturerName: "Lagos Pharma Ltd",
    nafdacReg: "04-1284",
    manufactureDate: "2025-03-14T00:00:00.000Z",
    expiryDate: "2027-03-14T00:00:00.000Z",
    unitCount: 12000,
    currentHolderId: "usr_91c4f2e8a047",
    status: "in_custody",
    elaFingerprint: hex(16, "ela-coartem-001"),
    custody: [
      {
        hopId: "hop_001a",
        actorId: "usr_8a4f9c12c102",
        actorName: "Lagos Pharma Ltd",
        actorRole: "manufacturer",
        action: "initialized",
        timestamp: "2025-03-14T08:21:11.482Z",
        lat: 6.5933,
        lng: 3.3711,
        city: "Lagos",
        deviceFingerprint: "Mozilla/5.0 (X11; Linux x86_64) IndustrialKiosk/3.2",
        signature: hex(32, "sig-001a"),
        units: 12000,
      },
      {
        hopId: "hop_001b",
        actorId: "usr_3f1a82c7e9d4",
        actorName: "Idumota Health Distribution",
        actorRole: "wholesaler",
        action: "received",
        timestamp: "2025-03-15T14:08:22.991Z",
        lat: 6.4541,
        lng: 3.3947,
        city: "Lagos",
        deviceFingerprint: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) Safari/17.4",
        signature: hex(32, "sig-001b"),
        units: 12000,
      },
      {
        hopId: "hop_001c",
        actorId: "usr_91c4f2e8a047",
        actorName: "HealthPlus Pharmacy · VI",
        actorRole: "retailer",
        action: "received",
        timestamp: "2025-03-18T09:42:08.117Z",
        lat: 6.4281,
        lng: 3.4219,
        city: "Lagos",
        deviceFingerprint: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Mobile/15E148",
        signature: hex(32, "sig-001c"),
        units: 4200,
        notes: "Partial transfer — 4,200 of 12,000 units",
      },
    ],
  },
  {
    id: hex(64, "batch-coartem-002"),
    shortId: "",
    productName: "Coartem",
    dosage: "80/480mg · 6 tablets",
    manufacturerId: "usr_8a4f9c12c102",
    manufacturerName: "Lagos Pharma Ltd",
    nafdacReg: "04-1284",
    manufactureDate: "2025-04-02T00:00:00.000Z",
    expiryDate: "2027-04-02T00:00:00.000Z",
    unitCount: 8000,
    currentHolderId: "usr_5d8e3f7b1a92",
    status: "flagged",
    flagged: true,
    elaFingerprint: hex(16, "ela-coartem-002"),
    custody: [
      {
        hopId: "hop_002a",
        actorId: "usr_8a4f9c12c102",
        actorName: "Lagos Pharma Ltd",
        actorRole: "manufacturer",
        action: "initialized",
        timestamp: "2025-04-02T07:14:11.111Z",
        lat: 6.5933,
        lng: 3.3711,
        city: "Lagos",
        deviceFingerprint: "IndustrialKiosk/3.2",
        signature: hex(32, "sig-002a"),
        units: 8000,
      },
      {
        hopId: "hop_002b",
        actorId: "usr_8a4f9c12c102",
        actorName: "Lagos Pharma Ltd",
        actorRole: "manufacturer",
        action: "dispatched",
        timestamp: "2025-04-02T11:30:00.000Z",
        lat: 6.5933,
        lng: 3.3711,
        city: "Lagos",
        deviceFingerprint: "IndustrialKiosk/3.2",
        signature: hex(32, "sig-002b"),
        units: 8000,
      },
      {
        hopId: "hop_002c",
        actorId: "usr_5d8e3f7b1a92",
        actorName: "Northern Meds Distribution",
        actorRole: "wholesaler",
        action: "received",
        timestamp: "2025-04-02T11:38:14.402Z",
        lat: 12.0022,
        lng: 8.5919,
        city: "Kano",
        deviceFingerprint: "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0",
        signature: hex(32, "sig-002c"),
        units: 8000,
        anomaly: {
          kind: "impossible_travel",
          detail:
            "Custody hand-off claims Lagos → Kano in 8 minutes. Great-circle distance 824km; minimum feasible transit by air is 95 minutes.",
          distanceKm: 824,
          claimedMinutes: 8,
          minimumMinutes: 95,
        },
      },
    ],
  },
  {
    id: hex(64, "batch-augmentin-001"),
    shortId: "",
    productName: "Augmentin",
    dosage: "625mg · 14 tablets",
    manufacturerId: "usr_72b1e09f1c38",
    manufacturerName: "MediBio Industries",
    nafdacReg: "04-2918",
    manufactureDate: "2025-02-08T00:00:00.000Z",
    expiryDate: "2027-02-08T00:00:00.000Z",
    unitCount: 24000,
    currentHolderId: "usr_a3b4d1e29f12",
    status: "in_custody",
    elaFingerprint: hex(16, "ela-augmentin-001"),
    custody: [
      {
        hopId: "hop_003a",
        actorId: "usr_72b1e09f1c38",
        actorName: "MediBio Industries",
        actorRole: "manufacturer",
        action: "initialized",
        timestamp: "2025-02-08T06:00:11.011Z",
        lat: 4.8093,
        lng: 7.0341,
        city: "Port Harcourt",
        deviceFingerprint: "IndustrialKiosk/4.1",
        signature: hex(32, "sig-003a"),
        units: 24000,
      },
      {
        hopId: "hop_003b",
        actorId: "usr_3f1a82c7e9d4",
        actorName: "Idumota Health Distribution",
        actorRole: "wholesaler",
        action: "received",
        timestamp: "2025-02-10T13:21:08.491Z",
        lat: 6.4541,
        lng: 3.3947,
        city: "Lagos",
        deviceFingerprint: "Mozilla/5.0 (Macintosh) Safari/17.4",
        signature: hex(32, "sig-003b"),
        units: 24000,
      },
      {
        hopId: "hop_003c",
        actorId: "usr_a3b4d1e29f12",
        actorName: "Medplus Pharmacy · Wuse II",
        actorRole: "retailer",
        action: "received",
        timestamp: "2025-02-14T10:14:42.118Z",
        lat: 9.0825,
        lng: 7.4787,
        city: "Abuja",
        deviceFingerprint: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)",
        signature: hex(32, "sig-003c"),
        units: 6000,
      },
    ],
  },
  {
    id: hex(64, "batch-augmentin-002"),
    shortId: "",
    productName: "Augmentin",
    dosage: "625mg · 14 tablets",
    manufacturerId: "usr_72b1e09f1c38",
    manufacturerName: "MediBio Industries",
    nafdacReg: "04-2918",
    manufactureDate: "2025-03-22T00:00:00.000Z",
    expiryDate: "2027-03-22T00:00:00.000Z",
    unitCount: 18000,
    currentHolderId: "usr_b7e2c81f4a39",
    status: "in_custody",
    elaFingerprint: hex(16, "ela-augmentin-002"),
    custody: [
      {
        hopId: "hop_004a",
        actorId: "usr_72b1e09f1c38",
        actorName: "MediBio Industries",
        actorRole: "manufacturer",
        action: "initialized",
        timestamp: "2025-03-22T07:11:00.000Z",
        lat: 4.8093,
        lng: 7.0341,
        city: "Port Harcourt",
        deviceFingerprint: "IndustrialKiosk/4.1",
        signature: hex(32, "sig-004a"),
        units: 18000,
      },
      {
        hopId: "hop_004b",
        actorId: "usr_b7e2c81f4a39",
        actorName: "ChemCare Pharmacy · Bodija",
        actorRole: "retailer",
        action: "received",
        timestamp: "2025-03-24T15:42:18.401Z",
        lat: 7.4314,
        lng: 3.9116,
        city: "Ibadan",
        deviceFingerprint: "Mozilla/5.0 (Linux; Android 14)",
        signature: hex(32, "sig-004b"),
        units: 3500,
      },
    ],
  },
  {
    id: hex(64, "batch-lonart-001"),
    shortId: "",
    productName: "Lonart",
    dosage: "80/480mg · 6 tablets",
    manufacturerId: "usr_8a4f9c12c102",
    manufacturerName: "Lagos Pharma Ltd",
    nafdacReg: "04-1492",
    manufactureDate: "2025-01-19T00:00:00.000Z",
    expiryDate: "2027-01-19T00:00:00.000Z",
    unitCount: 6000,
    currentHolderId: "usr_91c4f2e8a047",
    status: "in_custody",
    elaFingerprint: hex(16, "ela-lonart-001"),
    custody: [
      {
        hopId: "hop_005a",
        actorId: "usr_8a4f9c12c102",
        actorName: "Lagos Pharma Ltd",
        actorRole: "manufacturer",
        action: "initialized",
        timestamp: "2025-01-19T07:30:00.000Z",
        lat: 6.5933,
        lng: 3.3711,
        city: "Lagos",
        deviceFingerprint: "IndustrialKiosk/3.2",
        signature: hex(32, "sig-005a"),
        units: 6000,
      },
      {
        hopId: "hop_005b",
        actorId: "usr_91c4f2e8a047",
        actorName: "HealthPlus Pharmacy · VI",
        actorRole: "retailer",
        action: "received",
        timestamp: "2025-01-21T12:08:55.821Z",
        lat: 6.4281,
        lng: 3.4219,
        city: "Lagos",
        deviceFingerprint: "Mozilla/5.0 (iPhone)",
        signature: hex(32, "sig-005b"),
        units: 6000,
      },
    ],
  },
  {
    id: hex(64, "batch-lonart-002"),
    shortId: "",
    productName: "Lonart",
    dosage: "80/480mg · 6 tablets",
    manufacturerId: "usr_8a4f9c12c102",
    manufacturerName: "Lagos Pharma Ltd",
    nafdacReg: "04-1492",
    manufactureDate: "2024-12-04T00:00:00.000Z",
    expiryDate: "2026-12-04T00:00:00.000Z",
    unitCount: 10000,
    currentHolderId: "usr_5d8e3f7b1a92",
    status: "in_custody",
    elaFingerprint: hex(16, "ela-lonart-002"),
    custody: [
      {
        hopId: "hop_006a",
        actorId: "usr_8a4f9c12c102",
        actorName: "Lagos Pharma Ltd",
        actorRole: "manufacturer",
        action: "initialized",
        timestamp: "2024-12-04T08:00:00.000Z",
        lat: 6.5933,
        lng: 3.3711,
        city: "Lagos",
        deviceFingerprint: "IndustrialKiosk/3.2",
        signature: hex(32, "sig-006a"),
        units: 10000,
      },
      {
        hopId: "hop_006b",
        actorId: "usr_5d8e3f7b1a92",
        actorName: "Northern Meds Distribution",
        actorRole: "wholesaler",
        action: "received",
        timestamp: "2024-12-06T17:42:00.000Z",
        lat: 12.0022,
        lng: 8.5919,
        city: "Kano",
        deviceFingerprint: "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0",
        signature: hex(32, "sig-006b"),
        units: 10000,
      },
    ],
  },
  {
    id: hex(64, "batch-coartem-003"),
    shortId: "",
    productName: "Coartem",
    dosage: "80/480mg · 6 tablets",
    manufacturerId: "usr_72b1e09f1c38",
    manufacturerName: "MediBio Industries",
    nafdacReg: "04-1284",
    manufactureDate: "2025-04-18T00:00:00.000Z",
    expiryDate: "2027-04-18T00:00:00.000Z",
    unitCount: 14000,
    currentHolderId: "usr_72b1e09f1c38",
    status: "in_custody",
    elaFingerprint: hex(16, "ela-coartem-003"),
    custody: [
      {
        hopId: "hop_007a",
        actorId: "usr_72b1e09f1c38",
        actorName: "MediBio Industries",
        actorRole: "manufacturer",
        action: "initialized",
        timestamp: "2025-04-18T06:42:00.000Z",
        lat: 4.8093,
        lng: 7.0341,
        city: "Port Harcourt",
        deviceFingerprint: "IndustrialKiosk/4.1",
        signature: hex(32, "sig-007a"),
        units: 14000,
      },
    ],
  },
  {
    id: hex(64, "batch-augmentin-003"),
    shortId: "",
    productName: "Augmentin",
    dosage: "625mg · 14 tablets",
    manufacturerId: "usr_8a4f9c12c102",
    manufacturerName: "Lagos Pharma Ltd",
    nafdacReg: "04-2918",
    manufactureDate: "2025-04-25T00:00:00.000Z",
    expiryDate: "2027-04-25T00:00:00.000Z",
    unitCount: 20000,
    currentHolderId: "usr_3f1a82c7e9d4",
    status: "in_custody",
    elaFingerprint: hex(16, "ela-augmentin-003"),
    custody: [
      {
        hopId: "hop_008a",
        actorId: "usr_8a4f9c12c102",
        actorName: "Lagos Pharma Ltd",
        actorRole: "manufacturer",
        action: "initialized",
        timestamp: "2025-04-25T07:18:00.000Z",
        lat: 6.5933,
        lng: 3.3711,
        city: "Lagos",
        deviceFingerprint: "IndustrialKiosk/3.2",
        signature: hex(32, "sig-008a"),
        units: 20000,
      },
      {
        hopId: "hop_008b",
        actorId: "usr_3f1a82c7e9d4",
        actorName: "Idumota Health Distribution",
        actorRole: "wholesaler",
        action: "received",
        timestamp: "2025-04-26T14:08:11.000Z",
        lat: 6.4541,
        lng: 3.3947,
        city: "Lagos",
        deviceFingerprint: "Mozilla/5.0 (Macintosh) Safari/17.4",
        signature: hex(32, "sig-008b"),
        units: 20000,
      },
    ],
  },
];

// Populate shortIds
MOCK_BATCHES.forEach((b) => (b.shortId = b.id.slice(0, 12)));

export function findBatch(id: string): MockBatch | undefined {
  return MOCK_BATCHES.find(
    (b) => b.id === id || b.shortId === id || b.id.startsWith(id)
  );
}
