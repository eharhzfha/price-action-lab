"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Crosshair,
  History,
  Layers3,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAppStore } from "@/store/useAppStore";
import { calculatePositionSize } from "@/lib/engine/risk";
import { INSTRUMENTS, type Instrument, type TradeDirection } from "@/lib/engine/types";
import type { EquityPoint } from "@/lib/engine/metrics";
import { fmtDateTime, fmtMoney, fmtPoints, fmtPrice, fmtR, fmtTime, pnlTone, cn } from "@/lib/utils";
import { Badge, Button, Field, Input, Metric, Panel, Segmented, Select, TableShell, Td, Th } from "@/components/ui/primitives";
import { EquityCurve } from "@/components/trading/Charts";
import { SignalTicket } from "@/components/trading/SignalTicket";

interface PaperPosition {
  id: string;
  instrument: Instrument;
  direction: TradeDirection;
  quantity: number;
  entryPrice: number;
  entryTime: number;
  stop: number;
  target: number | null;
  fees: number;
  source: "SIGNAL" | "MANUAL";
}

interface PaperFill {
  id: string;
  instrument: Instrument;
  direction: TradeDirection;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  rMultiple: number;
  fees: number;
  reason: "TARGET" | "STOP" | "MANUAL";
}

interface PaperAccountPayload {
  account?: {
    startingBalance: number;
    balance: number;
    equity: number;
    state?: {
      positions?: PaperPosition[];
      fills?: PaperFill[];
      orders?: unknown[];
      dayRealized?: number;
    };
  };
}

const emptyForm = { direction: "LONG" as TradeDirection, quantity: 1, stop: "", target: "" };

export function PaperPage() {
  const { analysis } = useAnalysis();
  const settings = useAppStore((s) => s.settings);
  const config = useAppStore((s) => s.engineConfig);
  const setTab = useAppStore((s) => s.setTab);
  const price = analysis?.price ?? 0;
  const signal = analysis?.setup.signal ?? null;

  const [loaded, setLoaded] = React.useState(false);
  const [startingBalance, setStartingBalance] = React.useState(settings.accountSize);
  const [balance, setBalance] = React.useState(settings.accountSize);
  const [positions, setPositions] = React.useState<PaperPosition[]>([]);
  const [fills, setFills] = React.useState<PaperFill[]>([]);
  const [instrument, setInstrument] = React.useState<Instrument>(settings.defaultInstrument);
  const [form, setForm] = React.useState(emptyForm);
  const [orderError, setOrderError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [autoManage, setAutoManage] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/paper", { cache: "no-store" });
        if (!response.ok) throw new Error("Paper account could not be loaded.");
        const payload = (await response.json()) as PaperAccountPayload;
        if (cancelled || !payload.account) return;
        setStartingBalance(payload.account.startingBalance ?? settings.accountSize);
        setBalance(payload.account.balance ?? settings.accountSize);
        setPositions(Array.isArray(payload.account.state?.positions) ? payload.account.state!.positions! : []);
        setFills(Array.isArray(payload.account.state?.fills) ? payload.account.state!.fills! : []);
      } catch {
        if (!cancelled) {
          setStartingBalance(settings.accountSize);
          setBalance(settings.accountSize);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [settings.accountSize]);

  React.useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        const dayRealized = fills
          .filter((fill) => new Date(fill.exitTime * 1000).toDateString() === new Date().toDateString())
          .reduce((sum, fill) => sum + fill.pnl, 0);
        const response = await fetch("/api/paper", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            balance,
            equity: balance + unrealizedTotal,
            state: { positions, fills, orders: [], dayRealized },
          }),
        });
        if (response.ok) setLastSaved(new Date().toLocaleTimeString());
      } catch {
        // Keep simulating locally; persistence retries on the next change.
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
    // unrealizedTotal is derived from positions and the replay price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, balance, positions, fills]);

  React.useEffect(() => {
    if (!form.stop && price) {
      setForm((prev) => ({
        ...prev,
        stop: (price - (prev.direction === "LONG" ? 20 : -20)).toFixed(2),
        target: (price + (prev.direction === "LONG" ? 40 : -40)).toFixed(2),
      }));
    }
  }, [form.stop, price]);

  const spec = INSTRUMENTS[instrument];
  const unrealizedByPosition = (position: PaperPosition) => {
    if (!price) return 0;
    const direction = position.direction === "LONG" ? 1 : -1;
    return (price - position.entryPrice) * direction * position.quantity * INSTRUMENTS[position.instrument].pointValue;
  };
  const unrealizedTotal = positions.reduce((sum, position) => sum + unrealizedByPosition(position), 0);
  const equity = balance + unrealizedTotal;
  const openRisk = positions.reduce(
    (sum, position) => sum + Math.abs(position.entryPrice - position.stop) * position.quantity * INSTRUMENTS[position.instrument].pointValue,
    0,
  );
  const wins = fills.filter((fill) => fill.pnl > 0).length;
  const winRate = fills.length ? (wins / fills.length) * 100 : 0;
  const dayRealized = fills
    .filter((fill) => new Date(fill.exitTime * 1000).toDateString() === new Date().toDateString())
    .reduce((sum, fill) => sum + fill.pnl, 0);

  const entry = price;
  const stop = Number(form.stop);
  const target = form.target ? Number(form.target) : undefined;
  const sizing = React.useMemo(() => {
    if (!entry || !stop) return null;
    return calculatePositionSize({
      instrument,
      accountSize: equity,
      riskPct: settings.riskPct,
      entry,
      stop,
      target,
    });
  }, [entry, instrument, settings.riskPct, stop, target, equity]);

  const closePosition = React.useCallback(
    (id: string, exitPrice: number, reason: PaperFill["reason"]) => {
      const position = positions.find((item) => item.id === id);
      if (!position) return;
      const positionSpec = INSTRUMENTS[position.instrument];
      const direction = position.direction === "LONG" ? 1 : -1;
      const gross = (exitPrice - position.entryPrice) * direction * position.quantity * positionSpec.pointValue;
      const pnl = gross - position.fees;
      const riskDollars = Math.abs(position.entryPrice - position.stop) * position.quantity * positionSpec.pointValue;
      setBalance((value) => value + pnl);
      setFills((value) => [
        {
          id: `FILL_${Date.now()}_${position.id.slice(-5)}`,
          instrument: position.instrument,
          direction: position.direction,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          exitPrice: Number(exitPrice.toFixed(2)),
          entryTime: position.entryTime,
          exitTime: analysis?.asOf ?? Math.floor(Date.now() / 1000),
          pnl: Number(pnl.toFixed(2)),
          rMultiple: riskDollars > 0 ? Number((pnl / riskDollars).toFixed(2)) : 0,
          fees: position.fees,
          reason,
        },
        ...value,
      ]);
      setPositions((value) => value.filter((item) => item.id !== id));
      setNotice(`${position.direction} ${position.quantity} ${position.instrument} closed at ${fmtPrice(exitPrice)} · ${fmtMoney(pnl, { sign: true })}`);
    },
    [analysis?.asOf, positions],
  );

  React.useEffect(() => {
    if (!autoManage || !price || !positions.length) return;
    for (const position of positions) {
      if (position.direction === "LONG") {
        if (position.stop && price <= position.stop) closePosition(position.id, position.stop, "STOP");
        else if (position.target && price >= position.target) closePosition(position.id, position.target, "TARGET");
      } else {
        if (position.stop && price >= position.stop) closePosition(position.id, position.stop, "STOP");
        else if (position.target && price <= position.target) closePosition(position.id, position.target, "TARGET");
      }
    }
  }, [autoManage, closePosition, positions, price]);

  const applySignal = () => {
    if (!signal) return;
    const paper = calculatePositionSize({
      instrument,
      accountSize: equity,
      riskPct: settings.riskPct,
      entry: price,
      stop: signal.direction === "LONG" ? Math.min(price, signal.stop) : Math.max(price, signal.stop),
      target: signal.direction === "LONG" ? Math.max(price, signal.target) : Math.min(price, signal.target),
    });
    setForm({
      direction: signal.direction,
      quantity: Math.max(1, paper.contracts),
      stop: signal.stop.toFixed(2),
      target: signal.target.toFixed(2),
    });
    setNotice(`Loaded ${signal.grade} ${signal.direction} plan from the strategy engine.`);
  };

  const placeOrder = () => {
    setOrderError(null);
    setNotice(null);
    if (!price) {
      setOrderError("No market price at the replay cursor.");
      return;
    }
    if (!Number.isFinite(stop) || stop <= 0) {
      setOrderError("Enter a valid protective stop.");
      return;
    }
    if (form.direction === "LONG" && stop >= price) {
      setOrderError("A long stop must be below the current price.");
      return;
    }
    if (form.direction === "SHORT" && stop <= price) {
      setOrderError("A short stop must be above the current price.");
      return;
    }
    if (target && form.direction === "LONG" && target <= price) {
      setOrderError("A long target must be above the current price.");
      return;
    }
    if (target && form.direction === "SHORT" && target >= price) {
      setOrderError("A short target must be below the current price.");
      return;
    }
    const quantity = Math.max(1, Math.floor(form.quantity));
    const slip = config.timezone ? settings.slippageTicks * spec.tickSize : 0;
    const entryPrice = price + (form.direction === "LONG" ? slip : -slip);
    const position: PaperPosition = {
      id: `POS_${Date.now()}`,
      instrument,
      direction: form.direction,
      quantity,
      entryPrice: Number(entryPrice.toFixed(2)),
      entryTime: analysis?.asOf ?? Math.floor(Date.now() / 1000),
      stop: Number(stop.toFixed(2)),
      target: target ? Number(target.toFixed(2)) : null,
      fees: settings.commissionPerSide * 2 * quantity,
      source: signal ? "SIGNAL" : "MANUAL",
    };
    setPositions((value) => [position, ...value]);
    setNotice(`${form.direction} ${quantity} ${instrument} filled at ${fmtPrice(entryPrice)} · stop ${fmtPrice(stop)}${target ? ` · target ${fmtPrice(target)}` : ""}`);
  };

  const resetAccount = () => {
    if (!window.confirm("Reset the paper account? Open positions and fills will be cleared.")) return;
    setPositions([]);
    setFills([]);
    setBalance(startingBalance);
    setNotice("Paper account reset to starting balance.");
  };

  const equityPoints: EquityPoint[] = React.useMemo(() => {
    if (!fills.length) return [];
    const sorted = [...fills].sort((a, b) => a.exitTime - b.exitTime);
    let value = startingBalance;
    let peak = startingBalance;
    return [
      { time: sorted[0].entryTime, equity: startingBalance, drawdown: 0, drawdownPct: 0 },
      ...sorted.map((fill) => {
        value += fill.pnl;
        peak = Math.max(peak, value);
        return {
          time: fill.exitTime,
          equity: Number(value.toFixed(2)),
          drawdown: Number((value - peak).toFixed(2)),
          drawdownPct: peak > 0 ? Number((((value - peak) / peak) * 100).toFixed(2)) : 0,
        };
      }),
    ];
  }, [fills, startingBalance]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Metric label="Account equity" value={fmtMoney(equity)} icon={<WalletCards />} sub={`${fmtMoney(balance)} realized cash · ${positions.length} open`} />
        <Metric label="Open P&L" value={fmtMoney(unrealizedTotal, { sign: true })} tone={unrealizedTotal >= 0 ? "bull" : "bear"} icon={<CircleDollarSign />} sub={`Marked at ${fmtPrice(price)} · replay cursor`} />
        <Metric label="Open risk" value={fmtMoney(openRisk)} tone="warn" icon={<ShieldAlert />} sub={`${((openRisk / Math.max(equity, 1)) * 100).toFixed(2)}% of equity at stop`} />
        <Metric label="Win rate" value={`${winRate.toFixed(1)}%`} tone="accent" icon={<History />} sub={`${wins}W / ${fills.length - wins}L · ${fmtMoney(dayRealized, { sign: true })} today`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(330px,0.8fr)_minmax(0,1.35fr)]">
        <Panel
          title="Order ticket"
          subtitle={`Simulated market execution at ${fmtPrice(price)}`}
          icon={<Crosshair />}
          action={<Badge variant="info" dot>PAPER</Badge>}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Instrument">
                <Select value={instrument} onChange={(event) => setInstrument(event.target.value as Instrument)}>
                  <option value="MNQ">MNQ · $2/pt</option>
                  <option value="NQ">NQ · $20/pt</option>
                </Select>
              </Field>
              <Field label="Direction">
                <Segmented
                  className="h-10 w-full sm:h-9"
                  value={form.direction}
                  onChange={(value) => setForm((prev) => ({ ...prev, direction: value }))}
                  options={[
                    { value: "LONG", label: "LONG" },
                    { value: "SHORT", label: "SHORT" },
                  ]}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label="Quantity" className="col-span-2 sm:col-span-1">
                <Input type="number" min={1} max={100} value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))} />
              </Field>
              <Field label="Stop">
                <Input type="number" step={0.25} value={form.stop} onChange={(event) => setForm((prev) => ({ ...prev, stop: event.target.value }))} />
              </Field>
              <Field label="Target">
                <Input type="number" step={0.25} value={form.target} onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <TicketStat label="Market" value={fmtPrice(price)} />
              <TicketStat label="Risk" value={sizing ? fmtMoney(sizing.riskActual) : "—"} tone="text-bear" />
              <TicketStat label="Reward" value={sizing ? fmtMoney(sizing.totalReward) : "—"} tone="text-bull" />
            </div>

            {sizing && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2 text-[10px]">
                <span className="min-w-0 text-ink-500">
                  Risk model suggests <span className="font-semibold text-ink-200">{sizing.contracts} {instrument}</span> · {sizing.rr ?? "—"}R
                </span>
                <Button variant="ghost" size="xs" onClick={() => setForm((prev) => ({ ...prev, quantity: Math.max(1, sizing.contracts) }))}>
                  Use qty
                </Button>
              </div>
            )}

            {orderError && <p className="rounded border border-bear/20 bg-bear/[0.04] px-2.5 py-1.5 text-[10px] text-bear">{orderError}</p>}
            {notice && <p className="rounded border border-accent/15 bg-accent/[0.035] px-2.5 py-1.5 text-[10px] leading-relaxed text-accent/90">{notice}</p>}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={placeOrder} disabled={!price}>
                <ArrowUpRight className="h-3.5 w-3.5" /> Place {form.direction} order
              </Button>
              <Button variant="secondary" onClick={applySignal} disabled={!signal}>
                <Sparkles className="h-3.5 w-3.5" /> Use signal
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[9px] text-ink-500">
              <button type="button" className="flex items-center gap-1.5 hover:text-ink-300" onClick={() => setAutoManage((value) => !value)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", autoManage ? "bg-bull" : "bg-ink-500")} />
                Auto-close brackets {autoManage ? "on" : "off"}
              </button>
              <span>{saving ? "Syncing…" : lastSaved ? `Saved ${lastSaved}` : "Local paper account"}</span>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Open positions"
            subtitle={positions.length ? "Marked at the replay cursor" : "Flat · no simulated exposure"}
            icon={<Layers3 />}
            action={
              <Button variant="ghost" size="xs" onClick={resetAccount}>
                <RotateCcw className="h-3 w-3" /> Reset account
              </Button>
            }
            flush
          >
            {positions.length ? (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Instrument</Th>
                    <Th>Side</Th>
                    <Th>Qty</Th>
                    <Th>Entry</Th>
                    <Th>Stop / target</Th>
                    <Th>Open P&L</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const pnl = unrealizedByPosition(position);
                    return (
                      <tr key={position.id}>
                        <Td>
                          <div className="text-[10px] font-medium text-ink-200">{position.instrument}</div>
                          <div className="text-[9px] text-ink-500">{fmtTime(position.entryTime)} ET · {position.source}</div>
                        </Td>
                        <Td>
                          <span className={cn("text-[10px] font-semibold", position.direction === "LONG" ? "text-bull" : "text-bear")}>{position.direction}</span>
                        </Td>
                        <Td className="numeric text-[10px]">{position.quantity}</Td>
                        <Td className="numeric text-[10px]">{fmtPrice(position.entryPrice)}</Td>
                        <Td className="numeric text-[9px] text-ink-500">{fmtPrice(position.stop)} / {fmtPrice(position.target)}</Td>
                        <Td className={cn("numeric text-[10px] font-medium", pnlTone(pnl))}>{fmtMoney(pnl, { sign: true })}</Td>
                        <Td>
                          <Button variant="ghost" size="xs" onClick={() => closePosition(position.id, price, "MANUAL")}>
                            <X className="h-3 w-3" /> Close
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <ShieldCheck className="h-6 w-6 text-ink-600" />
                <div className="mt-2 text-[11px] font-medium text-ink-300">Flat and disciplined</div>
                <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-ink-500">
                  The paper desk only executes at the current replay timestamp. Bracket levels are managed bar-by-bar as you step the clock.
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Paper equity" subtitle={`${fills.length} closed simulated fills`} icon={<CircleDollarSign />}>
            <EquityCurve points={equityPoints} startingBalance={startingBalance} height={150} />
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TicketStat label="Start" value={fmtMoney(startingBalance, { compact: true })} />
              <TicketStat label="Realized" value={fmtMoney(balance - startingBalance, { sign: true })} tone={balance >= startingBalance ? "text-bull" : "text-bear"} />
              <TicketStat label="Unrealized" value={fmtMoney(unrealizedTotal, { sign: true })} tone={unrealizedTotal >= 0 ? "text-bull" : "text-bear"} />
              <TicketStat label="Open risk" value={fmtMoney(openRisk)} tone="text-warn" />
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <Panel title="Simulated fills" subtitle="Bracket outcomes processed in replay order" icon={<History />} flush>
          {fills.length ? (
            <div className="max-h-[300px] overflow-auto">
              <TableShell>
                <thead className="sticky top-0 bg-base-850">
                  <tr>
                    <Th>Exit time</Th>
                    <Th>Instrument</Th>
                    <Th>Side</Th>
                    <Th>Qty</Th>
                    <Th>Entry / exit</Th>
                    <Th>Reason</Th>
                    <Th>R</Th>
                    <Th>P&L</Th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((fill) => (
                    <tr key={fill.id}>
                      <Td className="text-[10px]">{fmtDateTime(fill.exitTime)}</Td>
                      <Td className="text-[10px]">{fill.instrument}</Td>
                      <Td><span className={fill.direction === "LONG" ? "text-[10px] text-bull" : "text-[10px] text-bear"}>{fill.direction}</span></Td>
                      <Td className="numeric text-[10px]">{fill.quantity}</Td>
                      <Td className="numeric text-[10px]">{fmtPrice(fill.entryPrice)} → {fmtPrice(fill.exitPrice)}</Td>
                      <Td><Badge variant={fill.reason === "TARGET" ? "pass" : fill.reason === "STOP" ? "fail" : "neutral"}>{fill.reason}</Badge></Td>
                      <Td className={cn("numeric text-[10px]", fill.rMultiple >= 0 ? "text-bull" : "text-bear")}>{fmtR(fill.rMultiple)}</Td>
                      <Td className={cn("numeric text-[10px] font-medium", fill.pnl >= 0 ? "text-bull" : "text-bear")}>{fmtMoney(fill.pnl, { sign: true })}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[11px] text-ink-500">No simulated fills yet. Open a position above.</div>
          )}
        </Panel>

        <div className="space-y-4">
          <SignalTicket analysis={analysis} compact hideActions />
          <Panel title="Execution rules" subtitle="Non-negotiable desk constraints" icon={<ShieldCheck />}>
            <div className="space-y-2 text-[10px] text-ink-400">
              <Rule label="One research idea at a time" value="1 trade / session" />
              <Rule label="Observation window" value={`${config.observationStart}–${config.observationEnd} ET`} />
              <Rule label="Default risk" value={`${settings.riskPct}% of equity`} />
              <Rule label="Simulated commissions" value={`${fmtMoney(settings.commissionPerSide)} / side`} />
              <Rule label="Slippage" value={`${settings.slippageTicks} tick(s)`} />
              <Rule label="All timestamps" value="America/New_York" />
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setTab("risk")}>
              Open risk calculator
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function TicketStat({ label, value, tone = "text-ink-200" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-white/[0.05] bg-black/20 px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div className={cn("numeric mt-0.5 text-[10px] font-medium", tone)}>{value}</div>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/[0.035] pb-1.5 last:border-0 last:pb-0">
      <span className="text-ink-500">{label}</span>
      <span className="numeric text-right text-ink-300">{value}</span>
    </div>
  );
}
