"use client";

import * as React from "react";
import { Check, Save, Settings2, ShieldCheck, SlidersHorizontal, Undo2, Workflow } from "lucide-react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAppStore } from "@/store/useAppStore";
import { SETUP_STATE_LABEL } from "@/lib/engine/types";
import { fmtPrice, fmtTime, cn } from "@/lib/utils";
import { Badge, Button, Field, Input, Panel, Select, Toggle } from "@/components/ui/primitives";
import { ChecklistList, GateProgress, StatusSummary } from "@/components/trading/Checklist";
import { SignalTicket } from "@/components/trading/SignalTicket";

const FLOW = [
  { key: "htf", label: "HTF bias", detail: "Closed 4H + 1H structure" },
  { key: "route", label: "Route BOS", detail: "Aligned → 5M · conflict → 15M" },
  { key: "sweep", label: "Liquidity sweep", detail: "PDH/PDL · sessions · EQH/EQL" },
  { key: "poi", label: "POI tap", detail: "FVG · order block · breaker" },
  { key: "trigger", label: "1M BOS", detail: "After tap, inside window" },
  { key: "risk", label: "Risk model", detail: "Structural stop · R target" },
];

export function EnginePage() {
  const { analysis, config } = useAnalysis();
  const setEngineConfig = useAppStore((s) => s.setEngineConfig);
  const resetEngineConfig = useAppStore((s) => s.resetEngineConfig);
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const structureRows = analysis
    ? [
        { label: "4H", structure: analysis.htf.bias4h.structure },
        { label: "1H", structure: analysis.htf.bias1h.structure },
        { label: "15M", structure: analysis.htf.structure15m },
        { label: "5M", structure: analysis.htf.structure5m },
        { label: "1M", structure: analysis.trigger.structure1m },
      ]
    : [];

  const saveDefaults = async () => {
    setSaving(true);
    setSaved(false);
    const next = {
      ...settings,
      observationStart: config.observationStart,
      observationEnd: config.observationEnd,
      defaultRR: config.rr,
    };
    setSettings({
      observationStart: next.observationStart,
      observationEnd: next.observationEnd,
      defaultRR: next.defaultRR,
    });
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultInstrument: next.defaultInstrument,
          accountSize: next.accountSize,
          riskPct: next.riskPct,
          commissionPerSide: next.commissionPerSide,
          slippageTicks: next.slippageTicks,
          observationStart: next.observationStart,
          observationEnd: next.observationEnd,
          defaultRR: next.defaultRR,
          timezone: next.timezone,
        }),
      });
      if (response.ok) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Decision engine"
        subtitle="NQ / MNQ price action model · deterministic, zero look-ahead evaluation"
        icon={<Workflow />}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={analysis?.setup.state === "TRIGGERED" ? "pass" : analysis?.setup.state === "CONTEXT_UNCLEAR" ? "wait" : "info"} dot>
              {analysis ? SETUP_STATE_LABEL[analysis.setup.state] : "LOADING"}
            </Badge>
            <GateProgress items={analysis?.checklist ?? []} />
          </div>
        }
      >
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {FLOW.map((stage, index) => {
            const checklistItems = analysis?.checklist ?? [];
            const matched =
              stage.key === "htf"
                ? checklistItems.filter((item) => item.id === "htf-4h" || item.id === "htf-1h")
                : stage.key === "route"
                  ? checklistItems.filter((item) => item.id === "bias-alignment" || item.id === "directional-bos")
                  : stage.key === "sweep"
                    ? checklistItems.filter((item) => item.id === "liquidity-sweep")
                    : stage.key === "poi"
                      ? checklistItems.filter((item) => item.id === "confluence-zone")
                      : stage.key === "trigger"
                        ? checklistItems.filter((item) => item.id === "entry-trigger" || item.id === "observation-window")
                        : checklistItems.filter((item) => item.id === "risk-model");
            const passed = matched.length > 0 && matched.every((item) => item.status === "PASS" || item.status === "INFO");
            const failed = matched.some((item) => item.status === "FAIL");
            return (
              <div
                key={stage.key}
                className={cn(
                  "relative rounded-md border px-3 py-2.5",
                  passed ? "border-bull/20 bg-bull/[0.035]" : failed ? "border-bear/15 bg-bear/[0.025]" : "border-white/[0.06] bg-black/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-ink-500">STAGE {index + 1}</span>
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border text-[8px]", passed ? "border-bull/30 bg-bull/10 text-bull" : failed ? "border-bear/30 bg-bear/10 text-bear" : "border-white/10 text-ink-500")}>
                    {passed ? <Check className="h-2.5 w-2.5" /> : index + 1}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-medium text-ink-200">{stage.label}</div>
                <div className="mt-0.5 text-[9px] leading-relaxed text-ink-500">{stage.detail}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Panel
          title="Validation tree"
          subtitle={analysis?.setup.reason ?? "Waiting for data"}
          icon={<ShieldCheck />}
          action={<StatusSummary items={analysis?.checklist ?? []} />}
          bodyClassName="p-2.5"
        >
          <ChecklistList items={analysis?.checklist ?? []} />
          <div className="mt-2 rounded-md border border-white/[0.05] bg-black/20 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-ink-500">
              <span>Engine v{analysis?.meta.engineVersion ?? "—"}</span>
              <span>{analysis?.meta.barsUsed.toLocaleString() ?? "—"} bars available</span>
              <span>Evaluated at {analysis ? fmtTime(analysis.asOf, true) : "—"} ET</span>
              <span className="text-bull">lookAhead: false</span>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <SignalTicket analysis={analysis} hideActions />
          <Panel
            title="Engine configuration"
            subtitle="Changes recompute the current cursor instantly"
            icon={<SlidersHorizontal />}
            action={
              <Button variant="ghost" size="xs" onClick={resetEngineConfig}>
                <Undo2 className="h-3 w-3" /> Reset
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Window start">
                <Input type="time" value={config.observationStart} onChange={(event) => setEngineConfig({ observationStart: event.target.value })} />
              </Field>
              <Field label="Window end">
                <Input type="time" value={config.observationEnd} onChange={(event) => setEngineConfig({ observationEnd: event.target.value })} />
              </Field>
              <Field label="Target R">
                <Input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.25}
                  value={config.rr}
                  onChange={(event) => setEngineConfig({ rr: Number(event.target.value) })}
                />
              </Field>
              <Field label="Sweep lookback (m)">
                <Input
                  type="number"
                  min={15}
                  max={360}
                  value={config.sweepLookbackMinutes}
                  onChange={(event) => setEngineConfig({ sweepLookbackMinutes: Number(event.target.value) })}
                />
              </Field>
              <Field label="Zone lookback (m)">
                <Input
                  type="number"
                  min={30}
                  max={720}
                  value={config.zoneLookbackMinutes}
                  onChange={(event) => setEngineConfig({ zoneLookbackMinutes: Number(event.target.value) })}
                />
              </Field>
              <Field label="BOS freshness (m)">
                <Input
                  type="number"
                  min={30}
                  max={720}
                  value={config.bosFreshnessMinutes}
                  onChange={(event) => setEngineConfig({ bosFreshnessMinutes: Number(event.target.value) })}
                />
              </Field>
              <Field label="1M trigger freshness">
                <Input
                  type="number"
                  min={2}
                  max={60}
                  value={config.entryBosFreshnessMinutes}
                  onChange={(event) => setEngineConfig({ entryBosFreshnessMinutes: Number(event.target.value) })}
                />
              </Field>
              <Field label="History (days)">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={config.historyDays}
                  onChange={(event) => setEngineConfig({ historyDays: Number(event.target.value) })}
                />
              </Field>
              <Field label="EQH/EQL tolerance">
                <Input
                  type="number"
                  min={0.25}
                  max={20}
                  step={0.25}
                  value={config.equalTolerancePoints}
                  onChange={(event) => setEngineConfig({ equalTolerancePoints: Number(event.target.value) })}
                />
              </Field>
              <Field label="Zone tolerance">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={0.25}
                  value={config.zoneTolerancePoints}
                  onChange={(event) => setEngineConfig({ zoneTolerancePoints: Number(event.target.value) })}
                />
              </Field>
              <Field label="Min FVG gap">
                <Input
                  type="number"
                  min={0.25}
                  max={10}
                  step={0.25}
                  value={config.minGapPoints}
                  onChange={(event) => setEngineConfig({ minGapPoints: Number(event.target.value) })}
                />
              </Field>
              <Field label="Entry buffer (pts)">
                <Input
                  type="number"
                  min={0.25}
                  max={20}
                  step={0.25}
                  value={config.entryBufferPoints}
                  onChange={(event) => setEngineConfig({ entryBufferPoints: Number(event.target.value) })}
                />
              </Field>
            </div>
            <div className="mt-3 space-y-2">
              <Toggle
                checked={config.requireEquilibrium}
                onChange={(checked) => setEngineConfig({ requireEquilibrium: checked })}
                label="Require discount / premium equilibrium at entry (strict gate)"
              />
              <Toggle
                checked={config.requireHtfBos}
                onChange={(checked) => setEngineConfig({ requireHtfBos: checked })}
                label="Require directional HTF BOS before liquidity evaluation"
              />
            </div>
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={saveDefaults} disabled={saving}>
              <Save className="h-3 w-3" /> {saved ? "Saved to local settings" : saving ? "Saving…" : "Save window & R defaults"}
            </Button>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Structure matrix" subtitle="Every timeframe is derived from M1 data at the cursor" icon={<Settings2 />} flush>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.05] text-[9px] uppercase tracking-[0.1em] text-ink-500">
                  <th className="px-3 py-2">TF</th>
                  <th className="px-3 py-2">Bias</th>
                  <th className="px-3 py-2">Last event</th>
                  <th className="px-3 py-2">Range</th>
                  <th className="px-3 py-2">EQ</th>
                  <th className="px-3 py-2 text-right">Bars</th>
                </tr>
              </thead>
              <tbody>
                {structureRows.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.03] last:border-0">
                    <td className="px-3 py-2 font-medium text-ink-200">{row.label}</td>
                    <td className={cn("px-3 py-2 font-semibold", row.structure.direction === "BULLISH" ? "text-bull" : row.structure.direction === "BEARISH" ? "text-bear" : "text-warn")}>
                      {row.structure.direction}
                    </td>
                    <td className="px-3 py-2 text-ink-400">
                      {row.structure.lastEvent ? `${row.structure.lastEvent.kind} ${row.structure.lastEvent.direction.slice(0, 4)} @ ${fmtPrice(row.structure.lastEvent.level)}` : "—"}
                    </td>
                    <td className="numeric px-3 py-2 text-ink-400">
                      {fmtPrice(row.structure.rangeLow)} – {fmtPrice(row.structure.rangeHigh)}
                    </td>
                    <td className="numeric px-3 py-2 text-ink-300">{fmtPrice(row.structure.equilibrium)}</td>
                    <td className="numeric px-3 py-2 text-right text-ink-500">{row.structure.bars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Liquidity & zones" subtitle="Confirmed at the replay cursor" icon={<ShieldCheck />} flush>
          <div className="max-h-[300px] overflow-y-auto">
            {analysis?.liquidity.sweeps.length ? (
              analysis.liquidity.sweeps.slice(0, 5).map((sweep) => (
                <div key={sweep.id} className="border-b border-white/[0.035] px-3.5 py-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-ink-300">{sweep.level.label}</span>
                    <Badge variant={sweep.implication === "LONG" ? "bull" : "bear"}>{sweep.implication} BIAS</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[9px] text-ink-500">
                    <span>{fmtTime(sweep.time)} ET</span>
                    <span>·</span>
                    <span>{fmtPrice(sweep.levelPrice)} swept by {sweep.penetration.toFixed(2)} pts</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-[11px] text-ink-500">No liquidity sweep in the current lookback.</div>
            )}
            <div className="border-t border-white/[0.055] bg-black/15 px-3.5 py-2">
              <div className="micro-label mb-1.5">POI inventory</div>
              <div className="flex flex-wrap gap-1">
                {[...(analysis?.confluences.orderBlocks ?? []), ...(analysis?.confluences.breakers ?? []), ...(analysis?.confluences.fvgs ?? [])]
                  .slice(0, 8)
                  .map((zone) => (
                    <Badge key={zone.id} variant={zone.direction === "LONG" ? "bull" : "bear"}>
                      {zone.kind} {fmtPrice(zone.bottom)}–{fmtPrice(zone.top)}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
