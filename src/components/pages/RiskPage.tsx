"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  Crosshair,
  DollarSign,
  Gauge,
  Save,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAppStore } from "@/store/useAppStore";
import { calculatePositionSize } from "@/lib/engine/risk";
import { INSTRUMENTS, type Instrument } from "@/lib/engine/types";
import { fmtMoney, fmtPct, fmtPoints, fmtPrice, cn } from "@/lib/utils";
import { Badge, Button, Field, Input, Metric, Panel, Progress, Segmented, Select, TableShell, Td, Th } from "@/components/ui/primitives";

export function RiskPage() {
  const { analysis } = useAnalysis();
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const price = analysis?.price ?? 0;
  const signal = analysis?.setup.signal ?? null;

  const [instrument, setInstrument] = React.useState<Instrument>(settings.defaultInstrument);
  const [accountSize, setAccountSize] = React.useState(String(settings.accountSize));
  const [riskPct, setRiskPct] = React.useState(String(settings.riskPct));
  const [entry, setEntry] = React.useState("");
  const [stop, setStop] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [maxMarginPct, setMaxMarginPct] = React.useState("50");
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!entry && price) {
      setEntry(price.toFixed(2));
      setStop((price - 20).toFixed(2));
      setTarget((price + 40).toFixed(2));
    }
  }, [entry, price]);

  const input = {
    instrument,
    accountSize: Number(accountSize),
    riskPct: Number(riskPct),
    entry: Number(entry),
    stop: Number(stop),
    target: target ? Number(target) : undefined,
    maxMarginPct: Number(maxMarginPct),
  };
  const result = calculatePositionSize(input);
  const nq = calculatePositionSize({ ...input, instrument: "NQ" });
  const mnq = calculatePositionSize({ ...input, instrument: "MNQ" });
  const spec = INSTRUMENTS[instrument];

  const applySignal = () => {
    if (!signal) return;
    setEntry(price.toFixed(2));
    setStop(signal.stop.toFixed(2));
    setTarget(signal.target.toFixed(2));
    setInstrument(settings.defaultInstrument);
  };

  const saveDefaults = async () => {
    setSaving(true);
    setSaved(false);
    setSettings({
      defaultInstrument: instrument,
      accountSize: Number(accountSize),
      riskPct: Number(riskPct),
    });
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultInstrument: instrument,
          accountSize: Number(accountSize),
          riskPct: Number(riskPct),
          commissionPerSide: settings.commissionPerSide,
          slippageTicks: settings.slippageTicks,
          observationStart: settings.observationStart,
          observationEnd: settings.observationEnd,
          defaultRR: settings.defaultRR,
          timezone: settings.timezone,
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

  const plannedRisk = (Number(accountSize) * Number(riskPct)) / 100;
  const riskUtilization = plannedRisk > 0 ? (result.riskActual / plannedRisk) * 100 : 0;
  const isLong = result.direction === "LONG";
  const entryValue = Number(entry);
  const stopValue = Number(stop);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Metric
          label="Contracts"
          value={`${result.contracts} ${instrument}`}
          tone={result.contracts > 0 ? "accent" : "warn"}
          icon={<Calculator />}
          sub={`${fmtMoney(result.riskPerContract)} risk per contract at this stop`}
        />
        <Metric
          label="Actual risk"
          value={fmtMoney(result.riskActual)}
          tone={result.riskActual > 0 ? "bear" : "default"}
          icon={<ShieldCheck />}
          sub={`${result.riskPctActual.toFixed(2)}% of account · budget ${fmtMoney(result.riskDollarsPlanned)}`}
        />
        <Metric
          label="Reward at target"
          value={fmtMoney(result.totalReward)}
          tone="bull"
          icon={<Target />}
          sub={result.rr ? `${result.rr.toFixed(2)}R · break-even ${result.breakevenWinRate?.toFixed(1)}%` : "Add a target or use signal"}
        />
        <Metric
          label="Stop distance"
          value={fmtPoints(result.stopDistancePoints)}
          tone="default"
          icon={<Gauge />}
          sub={`${result.stopDistanceTicks} ticks · ${fmtMoney(result.tickValue)} per tick (${instrument})`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(310px,0.8fr)_minmax(0,1.35fr)]">
        <Panel title="Sizing inputs" subtitle="Strict NQ / MNQ contract math" icon={<Calculator />}>
          <div className="space-y-3">
            <Field label="Instrument">
              <Segmented
                className="h-9 w-full"
                value={instrument}
                onChange={(value) => setInstrument(value)}
                options={[
                  { value: "MNQ", label: "MNQ · $2/pt" },
                  { value: "NQ", label: "NQ · $20/pt" },
                ]}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Account size">
                <Input type="number" min={1000} step={1000} value={accountSize} onChange={(event) => setAccountSize(event.target.value)} />
              </Field>
              <Field label="Risk %">
                <Input type="number" min={0.1} max={20} step={0.1} value={riskPct} onChange={(event) => setRiskPct(event.target.value)} />
              </Field>
              <Field label="Entry">
                <Input type="number" step={0.25} value={entry} onChange={(event) => setEntry(event.target.value)} />
              </Field>
              <Field label="Stop">
                <Input type="number" step={0.25} value={stop} onChange={(event) => setStop(event.target.value)} />
              </Field>
              <Field label="Target">
                <Input type="number" step={0.25} value={target} onChange={(event) => setTarget(event.target.value)} />
              </Field>
              <Field label="Max margin %">
                <Input type="number" min={5} max={100} step={5} value={maxMarginPct} onChange={(event) => setMaxMarginPct(event.target.value)} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => { if (price) { setEntry(price.toFixed(2)); setStop((price - 20).toFixed(2)); setTarget((price + 40).toFixed(2)); } }}>
                <Crosshair className="h-3 w-3" /> Use current price
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={applySignal} disabled={!signal}>
                <Target className="h-3 w-3" /> Use signal
              </Button>
            </div>
            {result.error && (
              <p className="flex items-start gap-1.5 rounded border border-bear/20 bg-bear/[0.04] px-2.5 py-2 text-[10px] text-bear">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {result.error}
              </p>
            )}
            {result.warnings.map((warning) => (
              <p key={warning} className="flex items-start gap-1.5 rounded border border-warn/15 bg-warn/[0.03] px-2.5 py-2 text-[10px] leading-relaxed text-warn/90">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {warning}
              </p>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Position plan"
            subtitle={`${spec.symbol} · ${spec.name} · $${spec.pointValue}/point · ${fmtMoney(spec.tickValue)} per ${spec.tickSize} tick`}
            icon={<ShieldCheck />}
            action={<Badge variant={result.direction === "LONG" ? "bull" : result.direction === "SHORT" ? "bear" : "dark"}>{result.direction ?? "INVALID"}</Badge>}
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="rounded-md border border-white/[0.06] bg-black/20 p-3.5">
                <div className="micro-label">Position size</div>
                <div className="mt-2 flex items-end gap-2">
                  <span className={cn("numeric text-[40px] font-semibold leading-none tracking-tight", result.contracts > 0 ? "text-ink-100" : "text-warn")}>{result.contracts}</span>
                  <span className="pb-1 text-[11px] font-medium text-ink-500">{instrument} contracts</span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[9px] text-ink-500">
                    <span>Risk utilisation</span>
                    <span className="numeric">{riskUtilization.toFixed(0)}%</span>
                  </div>
                  <Progress value={riskUtilization} tone={riskUtilization > 100 ? "bear" : "bull"} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Stat label="Planned risk" value={fmtMoney(result.riskDollarsPlanned)} />
                  <Stat label="Actual risk" value={fmtMoney(result.riskActual)} tone="text-bear" />
                  <Stat label="Margin est." value={fmtMoney(result.estMargin)} />
                  <Stat label="Notional" value={fmtMoney(result.notional, { compact: true })} />
                </div>
              </div>

              <div className="space-y-2">
                <PriceLadder
                  direction={result.direction}
                  entry={entryValue}
                  stop={stopValue}
                  target={result.target}
                  entryLabel={`ENTRY ${fmtPrice(entryValue)}`}
                  stopLabel={`STOP ${fmtPrice(stopValue)}`}
                  targetLabel={result.target ? `TARGET ${fmtPrice(result.target)}` : "TARGET —"}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="R:R" value={result.rr ? `${result.rr.toFixed(2)}R` : "—"} tone="text-accent" />
                  <Stat label="Break-even" value={result.breakevenWinRate ? `${result.breakevenWinRate.toFixed(1)}%` : "—"} />
                  <Stat label="Per tick" value={fmtMoney(spec.tickValue)} />
                </div>
                <div className="rounded-md border border-white/[0.055] bg-black/20 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bull" />
                    <p className="text-[10px] leading-relaxed text-ink-400">
                      {result.contracts > 0
                        ? `At ${result.contracts} ${instrument}, a stop at ${fmtPrice(stopValue)} risks ${fmtMoney(result.riskActual)} (${result.riskPctActual.toFixed(2)}%). Target pays ${fmtMoney(result.totalReward)}.`
                        : "The risk budget cannot fund one contract at this stop distance. Widen the account, reduce risk or tighten the structural stop."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="NQ vs MNQ comparison" subtitle="Same stop, same account risk budget" icon={<DollarSign />} flush>
            <TableShell>
              <thead>
                <tr>
                  <Th>Contract</Th>
                  <Th>$/point</Th>
                  <Th>Tick value</Th>
                  <Th>Risk / contract</Th>
                  <Th>Contracts</Th>
                  <Th>Actual risk</Th>
                  <Th>Reward</Th>
                  <Th>Margin</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: "NQ", value: nq },
                  { code: "MNQ", value: mnq },
                ].map(({ code, value }) => (
                  <tr key={code} className={cn(instrument === code && "bg-accent/[0.025]")}>
                    <Td className="font-medium text-ink-200">
                      <div className="flex items-center gap-1.5">
                        {code}
                        {instrument === code && <Badge variant="info">SELECTED</Badge>}
                      </div>
                    </Td>
                    <Td className="numeric">${INSTRUMENTS[code as Instrument].pointValue}</Td>
                    <Td className="numeric">{fmtMoney(INSTRUMENTS[code as Instrument].tickValue)}</Td>
                    <Td className="numeric">{fmtMoney(value.riskPerContract)}</Td>
                    <Td className="numeric font-medium text-ink-200">{value.contracts}</Td>
                    <Td className="numeric text-bear">{fmtMoney(value.riskActual)}</Td>
                    <Td className="numeric text-bull">{fmtMoney(value.totalReward)}</Td>
                    <Td className="numeric text-ink-500">{fmtMoney(value.estMargin, { compact: true })}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Account defaults" subtitle="Persisted to SQLite and used by the paper desk" icon={<Save />}>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Field label="Instrument">
              <Select value={instrument} onChange={(event) => setInstrument(event.target.value as Instrument)}>
                <option value="MNQ">MNQ</option>
                <option value="NQ">NQ</option>
              </Select>
            </Field>
            <Field label="Account size">
              <Input type="number" min={1000} step={1000} value={accountSize} onChange={(event) => setAccountSize(event.target.value)} />
            </Field>
            <Field label="Risk / trade (%)">
              <Input type="number" min={0.1} max={20} step={0.1} value={riskPct} onChange={(event) => setRiskPct(event.target.value)} />
            </Field>
          </div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={saveDefaults} disabled={saving}>
            <Save className="h-3 w-3" /> {saved ? "Saved" : saving ? "Saving…" : "Save account defaults"}
          </Button>
        </Panel>

        <Panel title="Risk protocol" subtitle="Rules the calculator enforces" icon={<ShieldCheck />}>
          <div className="space-y-2">
            {[
              ["1% nominal risk", "Position size is floored to whole contracts. Never round up."],
              ["Structural stop", "Stop sits beyond the POI and sweep-candle extreme, not an arbitrary number."],
              ["50% margin cap", "Never allocate more than half the account to initial margin."],
              ["Break-even math", "At 2R you only need 33.3% of trades to break even before commissions."],
              ["One trade / session", "The research engine models one setup per NY session to avoid overtrading."],
            ].map(([title, detail]) => (
              <div key={title} className="flex items-start gap-2 border-b border-white/[0.035] pb-1.5 last:border-0 last:pb-0">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-bull" />
                <div>
                  <div className="text-[10px] font-medium text-ink-300">{title}</div>
                  <div className="mt-0.5 text-[9px] leading-relaxed text-ink-500">{detail}</div>
                </div>
              </div>
            ))}
          </div>
          {signal && (
            <div className="mt-3 flex items-center justify-between rounded-md border border-accent/15 bg-accent/[0.03] px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[10px] text-accent">
                <ArrowUpRight className="h-3 w-3" /> Engine signal available
              </div>
              <Button variant="ghost" size="xs" onClick={applySignal}>Apply</Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-ink-200" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-white/[0.05] bg-black/20 px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div className={cn("numeric mt-0.5 text-[10px] font-medium", tone)}>{value}</div>
    </div>
  );
}

function PriceLadder({
  direction,
  entry,
  stop,
  target,
  entryLabel,
  stopLabel,
  targetLabel,
}: {
  direction: "LONG" | "SHORT" | null;
  entry: number;
  stop: number;
  target: number | null;
  entryLabel: string;
  stopLabel: string;
  targetLabel: string;
}) {
  const values = [entry, stop, target].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length < 2) {
    return <div className="rounded-md border border-white/[0.05] bg-black/20 px-3 py-6 text-center text-[10px] text-ink-500">Enter valid entry and stop levels.</div>;
  }
  const high = Math.max(...values);
  const low = Math.min(...values);
  const pos = (value: number) => (high === low ? 50 : 100 - ((value - low) / (high - low)) * 100);
  return (
    <div className="relative h-[122px] rounded-md border border-white/[0.05] bg-black/20 px-10 py-3">
      <div className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-white/[0.04]" />
      {[
        { label: targetLabel, value: target, color: "text-bull border-bull/40 bg-bull/10", dash: "border-bull/40" },
        { label: entryLabel, value: entry, color: "text-accent border-accent/40 bg-accent/10", dash: "border-accent/40" },
        { label: stopLabel, value: stop, color: "text-bear border-bear/40 bg-bear/10", dash: "border-bear/40" },
      ].map((level) => {
        if (typeof level.value !== "number" || !Number.isFinite(level.value)) return null;
        const top = pos(level.value);
        return (
          <div key={level.label} className="absolute left-0 right-0 flex items-center" style={{ top: `${top}%` }}>
            <span className={cn("w-full border-t border-dashed", level.dash)} />
            <span className={cn("absolute right-1 rounded border px-1.5 py-0.5 text-[8px] font-semibold tracking-wide", level.color)}>{level.label}</span>
          </div>
        );
      })}
      <div className="absolute bottom-2 left-2 text-[8px] uppercase tracking-[0.12em] text-ink-500">
        {direction ? `${direction} reward / risk map` : "Level map"}
      </div>
    </div>
  );
}
