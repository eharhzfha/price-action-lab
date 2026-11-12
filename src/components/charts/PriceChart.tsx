"use client";

import * as React from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { aggregateCandles } from "@/lib/engine/candles";
import type { StrategyAnalysis, Timeframe } from "@/lib/engine/types";
import { toNyTime } from "@/lib/engine/time";
import { useAppStore, type OverlayState } from "@/store/useAppStore";
import { fmtPrice, fmtTime, cn } from "@/lib/utils";

const TF_DAYS: Record<Timeframe, number> = {
  "1M": 2,
  "5M": 4,
  "15M": 8,
  "1H": 16,
  "4H": 30,
};

const ZONE_COLORS = {
  LONG: { fill: "rgba(45,212,167,0.075)", border: "rgba(45,212,167,0.38)", text: "#63E4C4" },
  SHORT: { fill: "rgba(242,85,122,0.075)", border: "rgba(242,85,122,0.38)", text: "#FF89A2" },
  OB: { fill: "rgba(90,169,255,0.075)", border: "rgba(90,169,255,0.35)", text: "#8FC6FF" },
  BREAKER: { fill: "rgba(167,139,250,0.075)", border: "rgba(167,139,250,0.35)", text: "#C4B5FD" },
};

interface ChartBar extends CandlestickData<UTCTimestamp> {
  volume: number;
}

function nearestTime(times: number[], target: number): number {
  if (!times.length) return target;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (times[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return times[Math.max(0, lo)];
}

function nearestIndex(times: number[], target: number): number {
  if (!times.length) return 0;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (times[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

export function PriceChart({ analysis, height = 470 }: { analysis: StrategyAnalysis | null; height?: number }) {
  const candles = useAppStore((s) => s.candles);
  const cursor = useAppStore((s) => s.cursor);
  const dayKey = useAppStore((s) => s.dayKey);
  const timeframe = useAppStore((s) => s.timeframe);
  const overlays = useAppStore((s) => s.overlays);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const candleSeriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = React.useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = React.useRef<Array<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>>>([]);
  const barsRef = React.useRef<ChartBar[]>([]);
  const drawRef = React.useRef<() => void>(() => {});
  const rafRef = React.useRef<number | null>(null);
  const [hover, setHover] = React.useState<ChartBar | null>(null);
  const [ready, setReady] = React.useState(false);

  const bars = React.useMemo<ChartBar[]>(() => {
    if (!cursor || !candles.length) return [];
    const from = cursor - TF_DAYS[timeframe] * 86400;
    const source = candles.filter((candle) => candle.time >= from && candle.time <= cursor);
    return aggregateCandles(source, timeframe).map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));
  }, [candles, cursor, timeframe]);

  const lastBar = bars[bars.length - 1] ?? null;
  const display = hover ?? lastBar;
  const previous = display ? bars[Math.max(0, bars.findIndex((bar) => bar.time === display.time) - 1)] : null;
  const change = display && previous ? display.close - previous.open : 0;

  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const heightValue = container.clientHeight || height;

    const chart = createChart(container, {
      width,
      height: heightValue,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#7F8B97",
        fontSize: 10,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.032)" },
        horzLines: { color: "rgba(255,255,255,0.038)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.08, bottom: 0.24 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 6,
        minBarSpacing: 1,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.18)", width: 1, style: 2, labelBackgroundColor: "#1B2128" },
        horzLine: { color: "rgba(255,255,255,0.18)", width: 1, style: 2, labelBackgroundColor: "#1B2128" },
      },
      localization: {
        timeFormatter: (time: Time) => (typeof time === "number" ? toNyTime(time) : ""),
        priceFormatter: (price: number) => price.toFixed(2),
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#2DD4A7",
      downColor: "#F2557A",
      borderUpColor: "#2DD4A7",
      borderDownColor: "#F2557A",
      wickUpColor: "rgba(45,212,167,0.72)",
      wickDownColor: "rgba(242,85,122,0.72)",
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 2, minMove: 0.25 },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    barsRef.current = bars;
    setReady(true);

    const scheduleDraw = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        drawRef.current();
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
      scheduleDraw();
    });
    resizeObserver.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleDraw);
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.point) {
        setHover(null);
        return;
      }
      const data = param.seriesData.get(candleSeries) as CandlestickData<UTCTimestamp> | undefined;
      if (!data) {
        setHover(null);
        return;
      }
      const bar = barsRef.current.find((item) => item.time === data.time);
      setHover(bar ? { ...data, volume: bar.volume } : null);
    });
    scheduleDraw();

    return () => {
      resizeObserver.disconnect();
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesRef.current = [];
      setReady(false);
    };
    // Chart is created once; data and overlays are pushed through dedicated effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    barsRef.current = bars;
    const series = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !volumeSeries || !chart || !bars.length) return;

    series.setData(bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    volumeSeries.setData(
      bars.map((bar) => ({
        time: bar.time,
        value: bar.volume,
        color: bar.close >= bar.open ? "rgba(45,212,167,0.22)" : "rgba(242,85,122,0.22)",
      })),
    );

    if (!hover || !bars.some((bar) => bar.time === hover.time)) setHover(bars[bars.length - 1]);
    const from = timeframe === "1M" || timeframe === "5M" ? Math.max(bars[0].time, cursor - 6.5 * 3600) : timeframe === "15M" ? cursor - 2 * 86400 : timeframe === "1H" ? cursor - 6 * 86400 : cursor - 20 * 86400;
    const first = bars.find((bar) => bar.time >= from)?.time ?? bars[0].time;
    try {
      chart.timeScale().setVisibleRange({ from: first as UTCTimestamp, to: cursor as UTCTimestamp });
    } catch {
      chart.timeScale().fitContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, timeframe, cursor]);

  React.useEffect(() => {
    const series = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || !bars.length) return;
    const times = bars.map((bar) => bar.time as number);
    const markers: SeriesMarker<Time>[] = [];

    const addMarker = (
      target: number,
      position: "aboveBar" | "belowBar",
      shape: "arrowUp" | "arrowDown" | "circle" | "square",
      color: string,
      text: string,
    ) => {
      if (target < times[0] || target > times[times.length - 1]) return;
      markers.push({ time: nearestTime(times, target) as UTCTimestamp, position, shape, color, text, size: 1 });
    };

    if (overlays.structure && analysis) {
      const structure =
        timeframe === "1M"
          ? analysis.trigger.structure1m
          : timeframe === "5M"
            ? analysis.htf.structure5m
            : timeframe === "15M"
              ? analysis.htf.structure15m
              : timeframe === "1H"
                ? analysis.htf.bias1h.structure
                : analysis.htf.bias4h.structure;
      structure.events.slice(-12).forEach((event) => {
        addMarker(
          event.time,
          event.direction === "BULLISH" ? "belowBar" : "aboveBar",
          event.direction === "BULLISH" ? "arrowUp" : "arrowDown",
          event.direction === "BULLISH" ? "#2DD4A7" : "#F2557A",
          event.kind,
        );
      });
    }

    if (overlays.liquidity && analysis) {
      analysis.liquidity.sweeps.slice(0, 6).forEach((sweep) => {
        addMarker(
          sweep.time,
          sweep.implication === "LONG" ? "belowBar" : "aboveBar",
          "circle",
          sweep.implication === "LONG" ? "#F5B544" : "#A78BFA",
          "SWEEP",
        );
      });
    }

    if (overlays.signal && analysis?.setup.signal) {
      const signal = analysis.setup.signal;
      addMarker(
        signal.triggerTime,
        signal.direction === "LONG" ? "belowBar" : "aboveBar",
        signal.direction === "LONG" ? "arrowUp" : "arrowDown",
        signal.direction === "LONG" ? "#5AA9FF" : "#F2557A",
        `${signal.direction} ${signal.grade}`,
      );
    }

    const byTime = new Map<string, SeriesMarker<Time>>();
    for (const marker of markers) byTime.set(`${marker.time}-${marker.text}`, marker);
    series.setMarkers(Array.from(byTime.values()).sort((a, b) => Number(a.time) - Number(b.time)));

    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        // Chart may have been recreated between renders.
      }
    }
    priceLinesRef.current = [];

    if (overlays.equilibrium && analysis) {
      const eq = analysis.confluences.equilibrium;
      priceLinesRef.current.push(
        series.createPriceLine({
          price: eq.equilibrium,
          color: "rgba(167,139,250,0.5)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "EQ",
        }),
      );
    }
    if (overlays.liquidity && analysis) {
      const levels = analysis.liquidity.levels.filter((level) => level.kind === "PDH" || level.kind === "PDL");
      for (const level of levels) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: level.price,
            color: level.kind === "PDH" ? "rgba(242,85,122,0.32)" : "rgba(45,212,167,0.32)",
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: level.kind,
          }),
        );
      }
    }
    drawRef.current();
  }, [analysis, overlays, bars, timeframe, ready]);

  const drawOverlays = React.useCallback(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const canvas = overlayRef.current;
    if (!chart || !series || !canvas) return;

    const container = canvas.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    const heightValue = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(heightValue * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(heightValue * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${heightValue}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, heightValue);

    const timeScale = chart.timeScale();
    const times = barsRef.current.map((bar) => bar.time as number);
    if (!times.length) return;
    const xForTime = (target: number) => {
      const index = nearestIndex(times, Math.max(times[0], Math.min(times[times.length - 1], target)));
      const coordinate = (timeScale as unknown as { logicalToCoordinate: (logical: number) => number | null }).logicalToCoordinate(index);
      return coordinate ?? null;
    };
    const latestX = (timeScale as unknown as { logicalToCoordinate: (logical: number) => number | null }).logicalToCoordinate(times.length - 1);

    const yForPrice = (price: number) => series.priceToCoordinate(price);

    const drawZone = (zone: { startTime: number; top: number; bottom: number; kind: string; direction: string; id: string }, muted = false) => {
      const x1 = xForTime(zone.startTime);
      const x2 = latestX;
      const yTop = yForPrice(zone.top);
      const yBottom = yForPrice(zone.bottom);
      if (x1 === null || x2 === null || yTop === null || yBottom === null) return;
      if (x2 < x1) return;
      const palette =
        zone.kind === "OB"
          ? ZONE_COLORS.OB
          : zone.kind === "BREAKER"
            ? ZONE_COLORS.BREAKER
            : zone.direction === "LONG"
              ? ZONE_COLORS.LONG
              : ZONE_COLORS.SHORT;
      ctx.save();
      ctx.globalAlpha = muted ? 0.55 : 1;
      ctx.fillStyle = palette.fill;
      ctx.fillRect(x1, Math.min(yTop, yBottom), Math.max(4, x2 - x1), Math.abs(yBottom - yTop));
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1 + 0.5, Math.min(yTop, yBottom) + 0.5, Math.max(4, x2 - x1) - 1, Math.max(1, Math.abs(yBottom - yTop)) - 1);
      const boxHeight = Math.abs(yBottom - yTop);
      if (boxHeight > 13) {
        ctx.fillStyle = palette.text;
        ctx.font = "600 9px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${zone.kind} · ${zone.direction === "LONG" ? "DEMAND" : "SUPPLY"}`, x1 + 5, Math.min(yTop, yBottom) + 4);
      }
      ctx.restore();
    };

    if (analysis) {
      if (overlays.orderBlocks) {
        analysis.confluences.orderBlocks.slice(0, 8).forEach((zone) => drawZone(zone));
        analysis.confluences.breakers.slice(0, 4).forEach((zone) => drawZone(zone, true));
      }
      if (overlays.fvg) {
        analysis.confluences.fvgs.filter((zone) => !zone.invalidated).slice(-10).forEach((zone) => drawZone(zone, true));
      }

      if (overlays.equilibrium) {
        const eq = analysis.confluences.equilibrium;
        const y = yForPrice(eq.equilibrium);
        if (y !== null) {
          ctx.save();
          ctx.strokeStyle = "rgba(167,139,250,0.55)";
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
          drawLabel(ctx, `EQ ${eq.equilibrium.toFixed(2)}`, 8, y - 5, "rgba(167,139,250,.9)");
          ctx.restore();
        }
      }

      if (overlays.liquidity) {
        const { pdh, pdl } = analysis.liquidity;
        for (const [price, label, color] of [
          [pdh, "PDH", "rgba(242,85,122,.45)"],
          [pdl, "PDL", "rgba(45,212,167,.45)"],
        ] as const) {
          if (price === null) continue;
          const y = yForPrice(price);
          if (y === null) continue;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.setLineDash([2, 5]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
          drawLabel(ctx, `${label} ${price.toFixed(2)}`, width - 96, y - 5, color);
          ctx.restore();
        }
        if (analysis.liquidity.activeSweep) {
          const sweep = analysis.liquidity.activeSweep;
          const y = yForPrice(sweep.levelPrice);
          if (y !== null) {
            ctx.save();
            ctx.strokeStyle = "rgba(245,181,68,.55)";
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            drawLabel(ctx, `SWEPT ${sweep.level.kind} ${sweep.levelPrice.toFixed(2)}`, 8, y - 5, "rgba(245,181,68,.9)");
            ctx.restore();
          }
        }
      }

      if (overlays.signal && analysis.setup.signal) {
        const signal = analysis.setup.signal;
        const [entryY, stopY, targetY] = [signal.entry, signal.stop, signal.target].map(yForPrice);
        const xStart = xForTime(signal.triggerTime) ?? 0;
        if (entryY !== null && stopY !== null && targetY !== null) {
          ctx.save();
          ctx.fillStyle = "rgba(242,85,122,0.055)";
          ctx.fillRect(xStart, Math.min(entryY, stopY), Math.max(0, width - xStart), Math.abs(stopY - entryY));
          ctx.fillStyle = "rgba(45,212,167,0.055)";
          ctx.fillRect(xStart, Math.min(entryY, targetY), Math.max(0, width - xStart), Math.abs(targetY - entryY));
          const levels = [
            { price: signal.entry, label: `ENTRY ${signal.entry.toFixed(2)}`, color: "rgba(90,169,255,.85)", dash: [] as number[] },
            { price: signal.stop, label: `STOP ${signal.stop.toFixed(2)}`, color: "rgba(242,85,122,.8)", dash: [4, 4] },
            { price: signal.target, label: `TARGET ${signal.target.toFixed(2)}`, color: "rgba(45,212,167,.8)", dash: [4, 4] },
          ];
          for (const level of levels) {
            const y = yForPrice(level.price);
            if (y === null) continue;
            ctx.strokeStyle = level.color;
            ctx.setLineDash(level.dash);
            ctx.beginPath();
            ctx.moveTo(xStart, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            drawLabel(ctx, level.label, Math.max(8, xStart + 4), y - 5, level.color);
          }
          ctx.restore();
        }
      }
    }
  }, [analysis, overlays]);

  drawRef.current = drawOverlays;

  React.useEffect(() => {
    drawOverlays();
  }, [drawOverlays]);

  return (
    <div
      className="relative h-[clamp(320px,58vh,var(--pal-chart-h))] sm:h-[var(--pal-chart-h)]"
      style={{ "--pal-chart-h": `${height}px` } as React.CSSProperties}
    >
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-2 gap-y-1 rounded border border-white/[0.055] bg-base-950/78 px-2 py-1 backdrop-blur-sm sm:left-3 sm:top-2.5 sm:gap-x-3 sm:px-2.5 sm:py-1.5">
        <span className="text-[10px] font-semibold tracking-wide text-ink-200">NQ1!</span>
        <span className="text-[9px] text-ink-500">{timeframe}</span>
        {display ? (
          <>
            <LegendValue label="O" value={display.open} />
            <LegendValue label="H" value={display.high} />
            <LegendValue label="L" value={display.low} />
            <LegendValue label="C" value={display.close} tone={display.close >= display.open ? "text-bull" : "text-bear"} />
            <span className={cn("numeric whitespace-nowrap text-[9px]", change >= 0 ? "text-bull" : "text-bear")}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}
            </span>
            <span className="hidden whitespace-nowrap text-[9px] text-ink-500 sm:inline">
              Vol {Math.round(display.volume).toLocaleString()}
            </span>
            <span className="whitespace-nowrap text-[9px] text-ink-500">{fmtTime(Number(display.time))} ET</span>
          </>
        ) : (
          <span className="text-[9px] text-ink-500">Loading candles…</span>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-5 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-2 gap-y-1 text-[8px] uppercase tracking-[0.12em] text-ink-500 sm:left-3">
        <span className="h-1.5 w-3 rounded-sm bg-bull/60" /> Demand / FVG
        <span className="h-1.5 w-3 rounded-sm bg-bear/60" /> Supply / FVG
        <span className="h-1.5 w-3 rounded-sm bg-accent/60" /> Order block
        <span className="hidden h-1.5 w-3 rounded-sm bg-violet/60 sm:inline-block" /> <span className="hidden sm:inline">Breaker</span>
      </div>

      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 z-[5]" />
    </div>
  );
}

function LegendValue({ label, value, tone = "text-ink-300" }: { label: string; value: number; tone?: string }) {
  return (
    <span className="numeric flex items-center gap-1 text-[9px] text-ink-500">
      {label}
      <span className={tone}>{fmtPrice(value)}</span>
    </span>
  );
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.font = "600 9px Inter, sans-serif";
  const width = ctx.measureText(text).width + 8;
  ctx.fillStyle = "rgba(8,10,12,0.78)";
  ctx.fillRect(x, y - 10, width, 12);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x + 4, y);
}
