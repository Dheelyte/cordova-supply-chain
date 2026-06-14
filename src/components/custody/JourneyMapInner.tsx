"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  Tooltip as LeafletTooltip,
} from "react-leaflet";
import type { CustodyHop } from "@/lib/mock-api/fixtures/batches";
import { useCustodyHover } from "@/stores/custody-hover";

function pinIcon(opts: { active: boolean; index: number; anomaly: boolean }) {
  const ring = opts.anomaly
    ? "var(--risk)"
    : opts.active
      ? "var(--accent)"
      : "var(--text-secondary)";
  const fill = opts.anomaly
    ? "var(--risk-soft)"
    : opts.active
      ? "var(--accent-soft)"
      : "var(--bg-elevated)";
  const text = opts.anomaly
    ? "var(--risk)"
    : opts.active
      ? "var(--accent)"
      : "var(--text-secondary)";

  return L.divIcon({
    className: "aegis-pin",
    html: `
      <div style="
        width: 28px; height: 28px; border-radius: 14px;
        border: 2px solid ${ring}; background: ${fill};
        display: flex; align-items: center; justify-content: center;
        color: ${text}; font-family: var(--font-jetbrains-mono, monospace);
        font-size: 11px; font-weight: 600;
        box-shadow: 0 4px 10px -2px rgba(0,0,0,0.5);
      ">${opts.index + 1}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitToHops({ hops }: { hops: CustodyHop[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (hops.length === 0) return;
    if (hops.length === 1) {
      map.setView([hops[0].lat, hops[0].lng], 11);
      return;
    }
    const bounds = L.latLngBounds(hops.map((h) => [h.lat, h.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
  }, [hops, map]);
  return null;
}

function AnimatedPolyline({ points }: { points: [number, number][] }) {
  const ref = React.useRef<L.Polyline | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const el = (ref.current as unknown as { _path?: SVGPathElement })._path;
    if (!el) return;
    const length = el.getTotalLength();
    el.style.transition = "none";
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.2,0,0,1)";
      el.style.strokeDashoffset = "0";
    });
  }, [points]);

  return (
    <Polyline
      ref={ref}
      positions={points}
      pathOptions={{
        color: "var(--accent)",
        weight: 2,
        opacity: 0.85,
        dashArray: undefined,
      }}
    />
  );
}

export default function JourneyMapInner({ hops }: { hops: CustodyHop[] }) {
  const hovered = useCustodyHover((s) => s.hoveredHopId);
  const setHovered = useCustodyHover((s) => s.setHovered);
  const points: [number, number][] = hops.map((h) => [h.lat, h.lng]);
  const center: [number, number] =
    hops[0] ? [hops[0].lat, hops[0].lng] : [9.082, 8.6753];

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
      <FitToHops hops={hops} />
      <AnimatedPolyline points={points} />
      {hops.map((hop, i) => (
        <Marker
          key={hop.hopId}
          position={[hop.lat, hop.lng]}
          icon={pinIcon({
            active: hovered === hop.hopId,
            index: i,
            anomaly: !!hop.anomaly,
          })}
          eventHandlers={{
            mouseover: () => setHovered(hop.hopId),
            mouseout: () => setHovered(null),
          }}
        >
          <LeafletTooltip
            direction="top"
            offset={[0, -14]}
            opacity={1}
            className="aegis-tooltip"
          >
            <div style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
              <strong style={{ color: "var(--text-primary)" }}>
                {hop.actorName}
              </strong>
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginTop: 2,
                }}
              >
                {hop.city} · hop {i + 1}
              </div>
            </div>
          </LeafletTooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
