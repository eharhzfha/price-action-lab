import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DateTime } from "luxon";
import { NY_ZONE } from "@/lib/engine/time";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtPrice(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtMoney(value: number | null | undefined, opts?: { sign?: boolean; compact?: boolean }): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const compact = opts?.compact ?? false;
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact && abs >= 10000 ? "compact" : "standard",
    minimumFractionDigits: compact && abs >= 10000 ? 1 : 2,
    maximumFractionDigits: compact && abs >= 10000 ? 1 : 2,
  });
  if (value < 0) return `-${formatted}`;
  if (opts?.sign && value > 0) return `+${formatted}`;
  return formatted;
}

export function fmtPct(value: number | null | undefined, digits = 1, sign = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const prefix = sign && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

export function fmtR(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}R`;
}

export function fmtPoints(value: number | null | undefined, sign = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const prefix = sign && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)} pts`;
}

export function fmtSigned(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function toNyDate(seconds: number): DateTime {
  return DateTime.fromSeconds(seconds, { zone: NY_ZONE });
}

export function fmtTime(seconds: number | null | undefined, secondsVisible = false): string {
  if (!seconds) return "—";
  return toNyDate(seconds).toFormat(secondsVisible ? "HH:mm:ss" : "HH:mm");
}

export function fmtDate(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  return toNyDate(seconds).toFormat("LLL dd");
}

export function fmtLongDate(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  return toNyDate(seconds).toFormat("cccc, LLLL dd, yyyy");
}

export function fmtDateTime(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  return toNyDate(seconds).toFormat("LLL dd · HH:mm") + " ET";
}

export function fmtDateInput(seconds: number | null | undefined): string {
  if (!seconds) return "";
  return toNyDate(seconds).toFormat("yyyy-LL-dd");
}

export function fmtDateTimeInput(date: Date | number | null | undefined): string {
  if (!date) return "";
  const dt = typeof date === "number" ? toNyDate(date) : DateTime.fromJSDate(date, { zone: NY_ZONE });
  return dt.toFormat("yyyy-LL-dd'T'HH:mm");
}

export function nyInputToIso(value: string): string | null {
  const dt = DateTime.fromISO(value, { zone: NY_ZONE });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO();
}

export function relativeMinutes(secondsAgo: number): string {
  if (secondsAgo < 60) return `${Math.max(0, Math.round(secondsAgo))}s`;
  if (secondsAgo < 3600) return `${Math.round(secondsAgo / 60)}m`;
  return `${(secondsAgo / 3600).toFixed(1)}h`;
}

export function pnlTone(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "text-ink-300";
  return value > 0 ? "text-bull" : "text-bear";
}

export function sourceTone(source: string): string {
  switch (source) {
    case "LIVE":
      return "border-bear/30 bg-bear/10 text-bear";
    case "PAPER":
      return "border-accent/30 bg-accent/10 text-accent";
    case "BACKTEST":
      return "border-violet/30 bg-violet/10 text-violet";
    default:
      return "border-white/10 bg-white/5 text-ink-300";
  }
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
