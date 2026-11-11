"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { Bell, ChevronsUpDown, Command, PlugZap, Settings2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { NY_ZONE } from "@/lib/engine/time";
import { Badge, StatusDot } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const TITLES: Record<string, { title: string; eyebrow: string }> = {
  dashboard: { title: "Command Center", eyebrow: "Workspace / Dashboard" },
  charts: { title: "Market Structure", eyebrow: "Workspace / Charts" },
  engine: { title: "Strategy Engine", eyebrow: "Workspace / Validation" },
  backtest: { title: "Backtest & Replay", eyebrow: "Research / Simulation" },
  paper: { title: "Paper Desk", eyebrow: "Execution / Simulator" },
  risk: { title: "Risk Calculator", eyebrow: "Execution / Sizing" },
  journal: { title: "Trading Journal", eyebrow: "Review / Database" },
};

export function TopBar() {
  const tab = useAppStore((s) => s.tab);
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const dataSource = useAppStore((s) => s.dataSource);
  const datasetName = useAppStore((s) => s.datasetName);
  const [clock, setClock] = useState("--:--:--");
  const [date, setDate] = useState("—");

  useEffect(() => {
    const update = () => {
      const now = DateTime.now().setZone(NY_ZONE);
      setClock(now.toFormat("HH:mm:ss"));
      setDate(now.toFormat("ccc, LLL dd"));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const meta = TITLES[tab] ?? TITLES.dashboard;

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.055] bg-base-950/80 backdrop-blur-xl">
      <div className="flex h-[62px] items-center gap-4 px-4 lg:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
            <span>{meta.eyebrow}</span>
            <span className="text-ink-600">/</span>
            <span className="text-accent/80">v1.0</span>
          </div>
          <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-ink-100">{meta.title}</h1>
        </div>

        <div className="hidden items-center gap-2 rounded-md border border-white/[0.07] bg-black/20 px-2.5 py-1.5 md:flex">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-[10px] font-bold text-accent">
            NQ
          </span>
          <div className="leading-tight">
            <div className="text-[11px] font-semibold text-ink-100">NASDAQ-100</div>
            <div className="text-[9px] uppercase tracking-wider text-ink-500">{datasetName}</div>
          </div>
          <ChevronsUpDown className="ml-1 h-3 w-3 text-ink-600" />
        </div>

        <div className="hidden items-center gap-1 rounded-md border border-white/[0.07] bg-black/20 p-0.5 sm:flex">
          <button
            type="button"
            onClick={() => setMode("REPLAY")}
            className={cn(
              "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition",
              mode === "REPLAY" ? "bg-accent/15 text-accent" : "text-ink-500 hover:text-ink-200",
            )}
          >
            Replay
          </button>
          <button
            type="button"
            onClick={() => setMode("SIM")}
            className={cn(
              "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition",
              mode === "SIM" ? "bg-bull/15 text-bull" : "text-ink-500 hover:text-ink-200",
            )}
          >
            Sim feed
          </button>
        </div>

        <div className="hidden items-center gap-2 xl:flex">
          <PlugZap className="h-3.5 w-3.5 text-ink-500" />
          <div className="leading-tight">
            <div className="text-[10px] font-medium text-ink-300">Local data</div>
            <div className="max-w-[140px] truncate text-[9px] text-ink-500" title={dataSource}>
              {dataSource}
            </div>
          </div>
          <StatusDot tone="bull" pulse />
        </div>

        <div className="hidden text-right lg:block">
          <div className="numeric text-[13px] font-semibold text-ink-100">{clock}</div>
          <div className="text-[9px] uppercase tracking-[0.14em] text-ink-500">{date} · New York</div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Command palette"
            className="hidden h-8 w-8 items-center justify-center rounded-md border border-white/[0.07] text-ink-500 transition hover:border-white/15 hover:text-ink-200 sm:flex"
          >
            <Command className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.07] text-ink-500 transition hover:border-white/15 hover:text-ink-200"
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-accent" />
          </button>
          <button
            type="button"
            title="Desk settings"
            onClick={() => useAppStore.getState().setTab("engine")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.07] text-ink-500 transition hover:border-white/15 hover:text-ink-200"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-base-700 text-[10px] font-semibold text-ink-200">
            MD
          </div>
        </div>
      </div>
    </header>
  );
}

export function ModeBadge() {
  const mode = useAppStore((s) => s.mode);
  if (mode === "SIM") return <Badge variant="bull" dot>Simulated feed</Badge>;
  return <Badge variant="info" dot>Replay mode</Badge>;
}
