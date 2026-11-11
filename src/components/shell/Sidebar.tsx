"use client";

import {
  Activity,
  Calculator,
  ChartCandlestick,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  NotebookPen,
  Radio,
  WalletCards,
  Workflow,
} from "lucide-react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAppStore, type TabKey } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/primitives";

const GROUPS: Array<{
  label: string;
  items: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard; hint: string }>;
}> = [
  {
    label: "Workspace",
    items: [
      { key: "dashboard", label: "Command Center", icon: LayoutDashboard, hint: "Session overview" },
      { key: "charts", label: "Market Structure", icon: ChartCandlestick, hint: "Liquidity & POIs" },
    ],
  },
  {
    label: "Research",
    items: [
      { key: "engine", label: "Strategy Engine", icon: Workflow, hint: "Validation tree" },
      { key: "backtest", label: "Backtest & Replay", icon: FlaskConical, hint: "Historical proof" },
    ],
  },
  {
    label: "Execution",
    items: [
      { key: "paper", label: "Paper Desk", icon: WalletCards, hint: "Simulated fills" },
      { key: "risk", label: "Risk Calculator", icon: Calculator, hint: "NQ / MNQ sizing" },
      { key: "journal", label: "Trading Journal", icon: NotebookPen, hint: "Review database" },
    ],
  },
];

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-accent/25 bg-[#0b1520]">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-transparent to-bull/10" />
        <svg viewBox="0 0 36 36" className="relative h-6 w-6" aria-hidden="true">
          <path d="M6 25.5 13 18l5 4.5L30 9" fill="none" stroke="#5AA9FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 30.5h24" stroke="rgba(255,255,255,.16)" strokeWidth="1" />
          <circle cx="30" cy="9" r="2.4" fill="#2DD4A7" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0 leading-none">
          <div className="truncate text-[12px] font-bold tracking-[0.15em] text-ink-100">PRICE ACTION</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[9px] font-semibold tracking-[0.28em] text-accent">LAB</span>
            <span className="h-px w-4 bg-white/15" />
            <span className="text-[8px] uppercase tracking-[0.16em] text-ink-500">NQ / MNQ</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const mode = useAppStore((s) => s.mode);
  const datasetName = useAppStore((s) => s.datasetName);
  const days = useAppStore((s) => s.days);
  const { analysis } = useAnalysis();

  const triggered = analysis?.setup.state === "TRIGGERED";
  const stateLabel = analysis?.setup.state.replaceAll("_", " ") ?? "LOADING";

  return (
    <aside className="hidden h-full w-[226px] shrink-0 flex-col border-r border-white/[0.055] bg-base-950/70 md:flex">
      <div className="flex h-[62px] items-center border-b border-white/[0.055] px-4">
        <BrandMark />
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="mb-1.5 flex items-center gap-2 px-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-500/80">{group.label}</span>
              <span className="h-px flex-1 bg-white/[0.04]" />
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[9px] text-left transition",
                      active
                        ? "bg-white/[0.065] text-ink-100"
                        : "text-ink-400 hover:bg-white/[0.035] hover:text-ink-200",
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-accent" />}
                    <Icon
                      className={cn(
                        "h-[15px] w-[15px] shrink-0 transition",
                        active ? "text-accent" : "text-ink-500 group-hover:text-ink-300",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[9px] tracking-wide text-ink-500/80">{item.hint}</span>
                    </span>
                    {item.key === "engine" && triggered ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-bull shadow-[0_0_8px_rgba(45,212,167,.8)]" />
                    ) : active ? (
                      <ChevronRight className="h-3 w-3 text-ink-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2.5 border-t border-white/[0.055] p-3">
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="micro-label">Engine status</span>
            <StatusDot tone={triggered ? "bull" : "accent"} pulse={triggered} />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge variant={triggered ? "pass" : "info"}>{triggered ? "SIGNAL ARMED" : stateLabel}</Badge>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-ink-500">
            <span>{analysis?.htf.contextLabel?.split("·")[0].trim() ?? "Awaiting data"}</span>
            <span className="numeric">{analysis?.meta.engineVersion ? `v${analysis.meta.engineVersion}` : "—"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-white/[0.05] px-3 py-2">
          <Radio className="h-3 w-3 text-bull" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[10px] font-medium text-ink-300">{datasetName}</div>
            <div className="text-[9px] text-ink-500">{days.length} sessions · local feed</div>
          </div>
          <Activity className="h-3 w-3 text-ink-500" />
        </div>

        <div className="flex items-center justify-between px-1 text-[9px] uppercase tracking-[0.14em] text-ink-500">
          <span>{mode === "REPLAY" ? "Replay mode" : "Sim feed"}</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-bull" /> Local
          </span>
        </div>
      </div>
    </aside>
  );
}
