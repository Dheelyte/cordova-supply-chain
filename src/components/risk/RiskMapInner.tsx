"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip as LeafletTooltip,
} from "react-leaflet";

export interface RiskRegion {
  state: string;
  lat: number;
  lng: number;
  /** Number of incidents */
  incidents: number;
  /** Cumulative NGN at risk */
  amount: number;
  severity: "critical" | "high" | "medium" | "low";
}

const SEVERITY_COLOR: Record<RiskRegion["severity"], string> = {
  critical: "var(--risk)",
  high: "var(--pending)",
  medium: "var(--info)",
  low: "var(--text-tertiary)",
};

const SEVERITY_RADIUS: Record<RiskRegion["severity"], number> = {
  critical: 28,
  high: 22,
  medium: 16,
  low: 10,
};

export default function RiskMapInner({
  regions,
  onSelect,
}: {
  regions: RiskRegion[];
  onSelect?: (state: string) => void;
}) {
  // Center of Nigeria
  const center: [number, number] = [9.082, 8.6753];

  return (
    <MapContainer
      center={center}
      zoom={6}
      scrollWheelZoom={false}
      style={{
        height: "100%",
        width: "100%",
        background: "var(--bg-inset)",
      }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
      />

      {regions.map((r) => (
        <CircleMarker
          key={r.state}
          center={[r.lat, r.lng]}
          radius={SEVERITY_RADIUS[r.severity]}
          pathOptions={{
            color: SEVERITY_COLOR[r.severity],
            fillColor: SEVERITY_COLOR[r.severity],
            fillOpacity: 0.22,
            weight: 1.4,
          }}
          eventHandlers={{
            click: () => onSelect?.(r.state),
          }}
        >
          <LeafletTooltip
            direction="top"
            opacity={1}
            className="aegis-tooltip"
            offset={L.point(0, -SEVERITY_RADIUS[r.severity])}
          >
            <div style={{ fontFamily: "var(--font-inter, sans-serif)", minWidth: 140 }}>
              <strong style={{ color: "var(--text-primary)" }}>{r.state}</strong>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains-mono, monospace)",
                  color: "var(--text-secondary)",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {r.incidents} incidents · ₦{Math.round(r.amount / 1_000_000)}M
              </div>
              <div
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginTop: 4,
                  fontSize: 10,
                  color: SEVERITY_COLOR[r.severity],
                }}
              >
                severity · {r.severity}
              </div>
            </div>
          </LeafletTooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
