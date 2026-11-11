"use client";

import { useId } from "react";
import type { EquityPoint } from "@/lib/engine/metrics";
import { fmtMoney } from "@/lib/utils";

export function EquityCurve({
  points,
  startingBalance,
  height = 170,
  compact = false,
}: {
  points: EquityPoint[];
  startingBalance: number;
  height?: number;
  compact?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  if (points.length < 2) {
    return (
      <div className="flex h-[170px] items-center justify-center text-[11px] text-ink-500">
        Equity curve appears after a completed backtest.
      </div>
    );
  }

  const width = 720;
  const padding = compact ? 4 : 12;
  const values = [startingBalance, ...points.map((p) => p.equity)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) => padding + (index / (points.length - 1)) * (width - padding * 2);
  const y = (value: number) => padding + (1 - (value - min) / span) * (height - padding * 2);
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.equity).toFixed(2)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(2)},${height - padding} L${x(0).toFixed(2)},${height - padding} Z`;
  const baseY = y(startingBalance);
  const positive = points[points.length - 1].equity >= startingBalance;
  const stroke = positive ? "#2DD4A7" : "#F2557A";

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`eq-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={padding}
            x2={width - padding}
            y1={padding + fraction * (height - padding * 2)}
            y2={padding + fraction * (height - padding * 2)}
            stroke="rgba(255,255,255,.045)"
            strokeDasharray="3 5"
          />
        ))}
        <line
          x1={padding}
          x2={width - padding}
          y1={baseY}
          y2={baseY}
          stroke="rgba(255,255,255,.18)"
          strokeDasharray="4 4"
        />
        <path d={area} fill={`url(#eq-${id})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => (
          <circle
            key={`${point.time}-${index}`}
            cx={x(index)}
            cy={y(point.equity)}
            r={compact ? 1.2 : 2}
            fill={point.equity >= startingBalance ? "#2DD4A7" : "#F2557A"}
            opacity={compact ? 0 : 0.75}
          />
        ))}
      </svg>
      {!compact && (
        <>
          <span className="numeric absolute left-0 top-0 text-[8px] text-ink-500">{fmtMoney(max)}</span>
          <span className="numeric absolute bottom-0 left-0 text-[8px] text-ink-500">{fmtMoney(min)}</span>
        </>
      )}
    </div>
  );
}

export function Sparkline({
  values,
  tone = "auto",
  width = 120,
  height = 34,
}: {
  values: number[];
  tone?: "bull" | "bear" | "auto";
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * width},${height - 2 - ((value - min) / span) * (height - 4)}`)
    .join(" ");
  const color = tone === "bull" ? "#2DD4A7" : tone === "bear" ? "#F2557A" : values[values.length - 1] >= values[0] ? "#2DD4A7" : "#F2557A";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
