"use client";

import { Crosshair, Layers, Maximize2, RotateCcw, ScanLine, Spline, Target } from "lucide-react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAppStore, type OverlayState } from "@/store/useAppStore";
import type { Timeframe } from "@/lib/engine/types";
import { fmtPrice, fmtTime, cn } from "@/lib/utils";
import { Badge, Button, Panel, Segmented, Toggle } from "@/components/ui/primitives";
import { PriceChart } from "@/components/charts/PriceChart";
import { SignalTicket } from "@/components/trading/SignalTicket";
import { LiquidityMap } from "@/components/trading/LiquidityMap";

const TIMEFRAMES: Timeframe[] = ["1M", "5M", "15M", "1H", "4H"];

const OVERLAY_LABELS: Array<{ key: keyof OverlayState; label: string }> = [
  { key: "fvg", label: "FVG" },
  { key: "orderBlocks", label: "Order blocks" },
  { key: "liquidity", label: "Liquidity" },
  { key: "structure", label: "BOS / CHoCH" },
  { key: "equilibrium", label: "Equilibrium" },
  { key: "signal", label: "Trade levels" },
];

export function ChartsPage() {
  const { analysis } = useAnalysis();
  const timeframe = useAppStore((s) => s.timeframe);
  const setTimeframe = useAppStore((s) => s.setTimeframe);
  const overlays = useAppStore((s) => s.overlays);
  const toggleOverlay = useAppStore((s) => s.toggleOverlay);
  const featured = useAppStore((s) => s.featuredSignalTime);
  const setCursor = useAppStore((s) => s.setCursor);
  const cursor = useAppStore((s) => s.cursor);

  const structure =
    timeframe === "1M"
      ? analysis?.trigger.structure1m
      : timeframe === "5M"
        ? analysis?.htf.structure5m
        : timeframe === "15M"
          ? analysis?.htf.structure15m
          : timeframe === "1H"
            ? analysis?.htf.bias1h.structure
            : analysis?.htf.bias4h.structure;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={timeframe}
            onChange={setTimeframe}
            options={TIMEFRAMES.map((value) => ({ value, label: value }))}
          />
          <div className="hidden h-5 w-px bg-white/10 sm:block" />
          <div className="flex items-center gap-2">
            <span className={cn("numeric text-[15px] font-semibold", (analysis?.htf.bias4h.direction === "BULLISH") ? "text-bull" : analysis?.htf.bias4h.direction === "BEARISH" ? "text-bear" : "text-ink-200")}>
              {fmtPrice(analysis?.price)}
            </span>
            <Badge variant="dark">{analysis?.htf.contextLabel ?? "Loading context"}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {featured && (
            <Button variant="outline" size="sm" onClick={() => setCursor(featured)}>
              <Target className="h-3 w-3" /> Jump to signal
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setCursor(cursor)}>
            <RotateCcw className="h-3 w-3" /> Reset view
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Panel
          title="NQ1! · Price action"
          subtitle={`${fmtTime(cursor, true)} ET · forming bars include data up to replay cursor`}
          icon={<Crosshair />}
          action={
            <div className="flex items-center gap-1.5">
              <Badge variant="info">{timeframe}</Badge>
              <Badge variant="dark">M1 SOURCE</Badge>
            </div>
          }
          flush
          bodyClassName="p-0"
        >
          <div className="border-b border-white/[0.045] px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {OVERLAY_LABELS.map((overlay) => (
                <Toggle
                  key={overlay.key}
                  checked={overlays[overlay.key]}
                  onChange={() => toggleOverlay(overlay.key)}
                  label={overlay.label}
                />
              ))}
              <span className="ml-auto flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-ink-500">
                <Maximize2 className="h-3 w-3" /> Scroll to zoom · drag to pan
              </span>
            </div>
          </div>
          <PriceChart analysis={analysis} height={520} />
        </Panel>

        <div className="space-y-4">
          <Panel title="Live read" subtitle="Structures and POI context" icon={<ScanLine />}>
            <div className="space-y-2">
              <ContextRow
                label="4H structure"
                value={analysis?.htf.bias4h.direction ?? "—"}
                detail={analysis?.htf.bias4h.structure.lastEvent ? `Last ${analysis.htf.bias4h.structure.lastEvent.kind} @ ${fmtPrice(analysis.htf.bias4h.structure.lastEvent.level)}` : "No confirmed break"}
                tone={analysis?.htf.bias4h.direction === "BULLISH" ? "bull" : analysis?.htf.bias4h.direction === "BEARISH" ? "bear" : "neutral"}
              />
              <ContextRow
                label="1H structure"
                value={analysis?.htf.bias1h.direction ?? "—"}
                detail={analysis?.htf.bias1h.structure.lastEvent ? `Last ${analysis.htf.bias1h.structure.lastEvent.kind} @ ${fmtPrice(analysis.htf.bias1h.structure.lastEvent.level)}` : "No confirmed break"}
                tone={analysis?.htf.bias1h.direction === "BULLISH" ? "bull" : analysis?.htf.bias1h.direction === "BEARISH" ? "bear" : "neutral"}
              />
              <ContextRow
                label={`${analysis?.htf.selectedBosTimeframe ?? "BOS"} trigger`}
                value={analysis?.htf.directionalBos?.kind ?? "NONE"}
                detail={analysis?.htf.directionalBos ? `${analysis.htf.directionalBos.direction} @ ${fmtPrice(analysis.htf.directionalBos.level)}` : "Waiting for directional break"}
                tone={analysis?.htf.directionalBos?.direction === "BULLISH" ? "bull" : analysis?.htf.directionalBos?.direction === "BEARISH" ? "bear" : "neutral"}
              />
              <ContextRow
                label="POI / zone"
                value={analysis?.confluences.activeZone?.kind ?? "NONE"}
                detail={
                  analysis?.confluences.activeZone
                    ? `${analysis.confluences.activeZone.direction} · ${fmtPrice(analysis.confluences.activeZone.bottom)} – ${fmtPrice(analysis.confluences.activeZone.top)}`
                    : "No valid tap after sweep"
                }
                tone={analysis?.confluences.activeZone ? "accent" : "neutral"}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniBox label="FVG" value={analysis?.confluences.fvgs.length ?? 0} />
              <MiniBox label="Order blocks" value={analysis?.confluences.orderBlocks.length ?? 0} />
              <MiniBox label="Breakers" value={analysis?.confluences.breakers.length ?? 0} />
              <MiniBox label="Sweeps" value={analysis?.liquidity.sweeps.length ?? 0} />
            </div>
          </Panel>

          <Panel title="Liquidity map" subtitle="Nearest levels first" icon={<Layers />} flush>
            <LiquidityMap analysis={analysis} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel
          title={`${timeframe} structure events`}
          subtitle="Confirmed BOS / CHoCH pivots available at this cursor"
          icon={<Spline />}
          action={<Badge variant="dark">{structure?.events.length ?? 0} EVENTS</Badge>}
          flush
        >
          <div className="max-h-[260px] overflow-y-auto">
            {structure?.events.length ? (
              [...structure.events].reverse().slice(0, 12).map((event, index) => (
                <div key={`${event.time}-${index}`} className="flex items-center gap-3 border-b border-white/[0.035] px-3.5 py-2 last:border-0">
                  <Badge variant={event.direction === "BULLISH" ? "bull" : "bear"}>{event.kind}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-ink-300">
                      {event.direction === "BULLISH" ? "Bullish" : "Bearish"} break of {fmtPrice(event.level)}
                    </div>
                    <div className="mt-0.5 text-[9px] text-ink-500">Closed at {fmtPrice(event.price)} · {fmtTime(event.time)} ET</div>
                  </div>
                  <Button variant="ghost" size="xs" onClick={() => setCursor(event.time)}>
                    Replay
                  </Button>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-[11px] text-ink-500">No confirmed structure events on this timeframe.</div>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <SignalTicket analysis={analysis} compact />
          <Panel title="Overlay legend" subtitle="What is drawn on the canvas" icon={<Crosshair />}>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-400">
              <Legend color="bg-bull/20 border-bull/40" label="Bullish FVG / demand" />
              <Legend color="bg-bear/20 border-bear/40" label="Bearish FVG / supply" />
              <Legend color="bg-accent/20 border-accent/40" label="Order block" />
              <Legend color="bg-violet/20 border-violet/40" label="Breaker block" />
              <Legend color="bg-warn/20 border-warn/40" label="Liquidity sweep" />
              <Legend color="bg-white/10 border-white/20" label="Equilibrium" />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-ink-500">
              Rectangles are a canvas overlay anchored to the chart&apos;s time and price scales. Zones are clipped at the replay cursor so future price action never leaks into the view.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ContextRow({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "bull" | "bear" | "accent" | "neutral" }) {
  const toneClass = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : tone === "accent" ? "text-accent" : "text-ink-300";
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-white/[0.05] bg-black/15 px-2.5 py-2">
      <div className="min-w-0">
        <div className="micro-label">{label}</div>
        <div className="mt-0.5 truncate text-[9px] text-ink-500">{detail}</div>
      </div>
      <span className={cn("shrink-0 text-[10px] font-semibold uppercase tracking-wide", toneClass)}>{value}</span>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-black/20 px-2.5 py-2">
      <div className="text-[8px] uppercase tracking-[0.12em] text-ink-500">{label}</div>
      <div className="numeric mt-0.5 text-[13px] font-semibold text-ink-200">{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-4 rounded-sm border", color)} />
      {label}
    </div>
  );
}
