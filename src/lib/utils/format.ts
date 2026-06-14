export function formatNGN(amount: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && Math.abs(amount) >= 1_000_000) {
    return `₦${(amount / 1_000_000).toFixed(amount >= 100_000_000 ? 0 : 1)}M`;
  }
  if (opts?.compact && Math.abs(amount) >= 1_000) {
    return `₦${(amount / 1_000).toFixed(0)}k`;
  }
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export function formatBVN(bvn: string): string {
  return bvn.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3");
}

export function formatNUBAN(nuban: string): string {
  return nuban.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
}

export function maskNUBAN(nuban: string): string {
  return `${"•".repeat(6)}${nuban.slice(-4)}`;
}

export function formatHash(hash: string, head = 8, tail = 6): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function formatGPS(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatISO(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}

export function formatTimeOfDay(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  const mss = d.getUTCMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${mss}`;
}
