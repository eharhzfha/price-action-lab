"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward, Zap } from "lucide-react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAppStore, type PlaybackSpeed } from "@/store/useAppStore";
import { atNyTime, observationWindow } from "@/lib/engine/time";
import { fmtDate, fmtTime, fmtLongDate } from "@/lib/utils";
import { Badge, Button, Segmented, Select } from "@/components/ui/primitives";

const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 20, 60];

export function ReplayBar() {
  const dayKey = useAppStore((s) => s.dayKey);
  const days = useAppStore((s) => s.days);
  const cursor = useAppStore((s) => s.cursor);
  const setCursor = useAppStore((s) => s.setCursor);
  const setDay = useAppStore((s) => s.setDay);
  const step = useAppStore((s) => s.step);
  const playing = useAppStore((s) => s.playing);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const speed = useAppStore((s) => s.speed);
  const setSpeed = useAppStore((s) => s.setSpeed);
  const config = useAppStore((s) => s.engineConfig);
  const { analysis } = useAnalysis();

  if (!dayKey) return null;

  const start = atNyTime(dayKey, "09:30");
  const end = atNyTime(dayKey, "16:00");
  const window = observationWindow(dayKey, config);
  const progress = end > start ? ((cursor - start) / (end - start)) * 100 : 0;
  const windowProgress =
    cursor <= window.start ? 0 : cursor >= window.end ? 100 : ((cursor - window.start) / (window.end - window.start)) * 100;

  return (
    <div className="z-20 shrink-0 border-t border-white/[0.06] bg-base-950/85 px-4 py-2.5 backdrop-blur-xl lg:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Back to observation window"
            onClick={() => setCursor(analysis?.setup.signal?.triggerTime ?? window.start)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" size="icon" title="Back 1 minute" onClick={() => step(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={playing ? "secondary" : "default"}
            size="icon"
            title={playing ? "Pause replay" : "Play replay"}
            onClick={() => setPlaying(!playing)}
            className="h-9 w-9"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
          </Button>
          <Button variant="secondary" size="icon" title="Forward 1 minute" onClick={() => step(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" title="Forward 5 minutes" onClick={() => step(5)}>
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="min-w-[118px] rounded-md border border-white/[0.07] bg-black/20 px-2.5 py-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="numeric text-[13px] font-semibold text-ink-100">{fmtTime(cursor, true)}</span>
            <span className="text-[9px] font-medium uppercase tracking-wider text-ink-500">ET</span>
          </div>
          <div className="text-[9px] text-ink-500">{fmtLongDate(cursor)}</div>
        </div>

        <div className="min-w-[160px] flex-1">
          <input
            aria-label="Replay time"
            type="range"
            min={start}
            max={end}
            step={60}
            value={Math.max(start, Math.min(end, cursor))}
            onChange={(event) => setCursor(Number(event.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-accent"
            style={{
              background: `linear-gradient(to right, #5AA9FF 0%, #5AA9FF ${Math.max(0, Math.min(100, progress))}%, rgba(255,255,255,.08) ${Math.max(0, Math.min(100, progress))}%, rgba(255,255,255,.08) 100%)`,
            }}
          />
          <div className="mt-1 flex items-center justify-between text-[8px] uppercase tracking-[0.12em] text-ink-500">
            <span>09:30</span>
            <span
              className="relative -top-0.5 h-1 flex-1 mx-2 overflow-hidden rounded-full bg-white/[0.045]"
              title={`Observation window ${config.observationStart}–${config.observationEnd} ET`}
            >
              <span
                className="absolute inset-y-0 bg-accent/55"
                style={{ left: `${((window.start - start) / (end - start)) * 100}%`, width: `${((window.end - window.start) / (end - start)) * 100}%` }}
              />
              <span
                className="absolute top-1/2 h-2 w-[2px] -translate-y-1/2 rounded bg-ink-100"
                style={{ left: `${windowProgress}%` }}
              />
            </span>
            <span>16:00</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={dayKey}
            onChange={(event) => setDay(event.target.value)}
            className="h-8 w-[132px] text-[11px]"
            aria-label="Trading session"
          >
            {[...days].reverse().map((day) => (
              <option key={day} value={day}>
                {fmtDate(atNyTime(day, "12:00"))} · {day}
              </option>
            ))}
          </Select>

          <Segmented
            size="sm"
            value={String(speed)}
            onChange={(value) => setSpeed(Number(value) as PlaybackSpeed)}
            options={SPEEDS.map((value) => ({ value: String(value), label: value === 60 ? "60×" : `${value}×` }))}
          />

          <div className="hidden items-center gap-1.5 xl:flex">
            <Badge variant={analysis?.inWindow ? "pass" : "dark"} dot>
              {analysis?.inWindow ? "WINDOW OPEN" : "WINDOW CLOSED"}
            </Badge>
            <Zap className="h-3 w-3 text-ink-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReplayHint() {
  return (
    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-ink-500">
      <SkipBack className="h-3 w-3" /> Global replay · all tabs synchronized
    </div>
  );
}
