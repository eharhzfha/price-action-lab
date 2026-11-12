"use client";

import * as React from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Edit3,
  Filter,
  Link2,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { fmtDate, fmtDateTime, fmtMoney, fmtR, fmtTime, nyInputToIso, fmtDateTimeInput, cn } from "@/lib/utils";
import { Badge, Button, EmptyState, Field, Input, Metric, Modal, Panel, Progress, Segmented, Select, Textarea } from "@/components/ui/primitives";

interface JournalTrade {
  id: string;
  direction: string;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number | null;
  rMultiple: number | null;
  source: string;
  instrument: string;
}

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  emotion: string | null;
  discipline: number;
  lessons: string | null;
  tags: string | null;
  tradeId: string | null;
  trade?: JournalTrade | null;
}

interface TradeOption {
  id: string;
  direction: string;
  instrument: string;
  entryPrice: number;
  entryTime: string;
  pnl: number | null;
  rMultiple: number | null;
}

const EMPTY_FORM = {
  date: "",
  title: "",
  content: "",
  emotion: "NEUTRAL",
  discipline: 3,
  lessons: "",
  tags: "",
  tradeId: "",
};

const EMOTIONS = ["CALM", "CONFIDENT", "NEUTRAL", "ANXIOUS", "FRUSTRATED", "FOMO", "GREEDY", "FEARFUL"];

export function JournalPage() {
  const setTab = useAppStore((s) => s.setTab);
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [trades, setTrades] = React.useState<TradeOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [emotionFilter, setEmotionFilter] = React.useState("ALL");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<JournalEntry | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setError(null);
    try {
      const [journalResponse, tradesResponse] = await Promise.all([
        fetch("/api/journal", { cache: "no-store" }),
        fetch("/api/trades?limit=100", { cache: "no-store" }),
      ]);
      if (!journalResponse.ok) throw new Error("Journal could not be loaded.");
      const journalPayload = (await journalResponse.json()) as { entries?: JournalEntry[] };
      const nextEntries = journalPayload.entries ?? [];
      setEntries(nextEntries);
      if (tradesResponse.ok) {
        const tradesPayload = (await tradesResponse.json()) as { trades?: TradeOption[] };
        setTrades(tradesPayload.trades ?? []);
      }
      setSelectedId((current) => (current && nextEntries.some((entry) => entry.id === current) ? current : nextEntries[0]?.id ?? null));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Journal could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = entries.filter((entry) => {
    const matchesEmotion = emotionFilter === "ALL" || entry.emotion === emotionFilter;
    const search = query.trim().toLowerCase();
    const matchesQuery =
      !search ||
      entry.title.toLowerCase().includes(search) ||
      entry.content.toLowerCase().includes(search) ||
      (entry.tags ?? "").toLowerCase().includes(search);
    return matchesEmotion && matchesQuery;
  });

  const selected = entries.find((entry) => entry.id === selectedId) ?? filtered[0] ?? null;

  const openNew = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      date: fmtDateTimeInput(Math.floor(Date.now() / 1000)),
      tradeId: "",
    });
    setModalOpen(true);
  };

  const openEdit = (entry: JournalEntry) => {
    setEditing(entry);
    setForm({
      date: fmtDateTimeInput(new Date(entry.date)),
      title: entry.title,
      content: entry.content,
      emotion: entry.emotion ?? "NEUTRAL",
      discipline: entry.discipline,
      lessons: entry.lessons ?? "",
      tags: entry.tags ?? "",
      tradeId: entry.tradeId ?? "",
    });
    setModalOpen(true);
  };

  const saveEntry = async () => {
    setSaving(true);
    setError(null);
    const dateIso = nyInputToIso(form.date);
    if (!dateIso) {
      setError("Enter a valid date and time.");
      setSaving(false);
      return;
    }
    const payload = {
      date: dateIso,
      title: form.title.trim(),
      content: form.content.trim(),
      emotion: form.emotion || null,
      discipline: form.discipline,
      lessons: form.lessons.trim() || null,
      tags: form.tags.trim() || null,
      tradeId: form.tradeId || null,
    };
    try {
      const response = await fetch(editing ? `/api/journal/${editing.id}` : "/api/journal", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; entry?: JournalEntry };
      if (!response.ok) throw new Error(data.error ?? "Could not save the journal entry.");
      setModalOpen(false);
      await fetchData();
      if (data.entry) setSelectedId(data.entry.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the journal entry.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entry: JournalEntry) => {
    if (!window.confirm(`Delete “${entry.title}”?`)) return;
    try {
      const response = await fetch(`/api/journal/${entry.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed.");
      await fetchData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    }
  };

  const averageDiscipline = entries.length ? entries.reduce((sum, entry) => sum + entry.discipline, 0) / entries.length : 0;
  const linkedTrades = entries.filter((entry) => entry.tradeId).length;
  const emotionCounts = entries.reduce<Record<string, number>>((counts, entry) => {
    const key = entry.emotion ?? "UNLABELED";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Metric label="Journal entries" value={entries.length} icon={<BookOpen />} sub={`${filtered.length} shown by current filters`} />
        <Metric label="Avg discipline" value={`${averageDiscipline.toFixed(1)} / 5`} tone={averageDiscipline >= 4 ? "bull" : averageDiscipline >= 3 ? "warn" : "bear"} icon={<TrendingUp />} sub="Self-rated execution quality" />
        <Metric label="Linked trades" value={linkedTrades} icon={<Link2 />} sub={`${trades.length} trades available for review`} />
        <Metric label="Dominant emotion" value={topEmotion?.[0] ?? "—"} tone="accent" icon={<CalendarDays />} sub={topEmotion ? `${topEmotion[1]} entries tagged` : "Log a session to build the profile"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, content or tags…" className="pl-8" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
          <Filter className="h-3 w-3 shrink-0 text-ink-500" />
          <Select
            value={emotionFilter}
            onChange={(event) => setEmotionFilter(event.target.value)}
            className="h-10 w-full text-[16px] sm:h-9 sm:w-[142px] sm:text-[11px]"
          >
            <option value="ALL">All emotions</option>
            {EMOTIONS.map((emotion) => (
              <option key={emotion} value={emotion}>{emotion}</option>
            ))}
          </Select>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="h-3.5 w-3.5" /> New journal entry
        </Button>
      </div>

      {error && !modalOpen && (
        <div className="rounded-md border border-bear/20 bg-bear/[0.04] px-3 py-2 text-[11px] text-bear">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(330px,0.85fr)_minmax(0,1.15fr)]">
        <Panel
          title="Review stream"
          subtitle={loading ? "Loading journal…" : `${filtered.length} entries`}
          icon={<BookOpen />}
          flush
        >
          {loading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-[68px] animate-pulseSoft rounded-md bg-white/[0.03]" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="max-h-[580px] overflow-y-auto">
              {filtered.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={cn(
                    "block w-full border-b border-white/[0.035] px-3.5 py-3 text-left transition last:border-0",
                    selected?.id === entry.id ? "bg-accent/[0.045]" : "hover:bg-white/[0.025]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase tracking-[0.1em] text-ink-500">{fmtDate(new Date(entry.date).getTime() / 1000)}</span>
                        {entry.tradeId && <Link2 className="h-2.5 w-2.5 text-accent/70" />}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-ink-200">{entry.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[9px] text-ink-500">
                        <span>{entry.emotion ?? "UNLABELED"}</span>
                        <span>·</span>
                        <span>{entry.discipline}/5 discipline</span>
                      </div>
                    </div>
                    <ChevronRight className={cn("mt-1 h-3.5 w-3.5 shrink-0", selected?.id === entry.id ? "text-accent" : "text-ink-600")} />
                  </div>
                  {entry.tags && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.tags.split(",").slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[8px] text-ink-500">{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen />}
              title={entries.length ? "No matching entries" : "Start the review habit"}
              description={entries.length ? "Adjust the search or emotion filter." : "Log the setup, your emotional state and the lesson after each session."}
              action={<Button variant="secondary" size="sm" onClick={openNew}><Plus className="h-3 w-3" /> Write first entry</Button>}
            />
          )}
        </Panel>

        {selected ? (
          <Panel
            title="Entry detail"
            subtitle={`${fmtDateTime(new Date(selected.date).getTime() / 1000)} · discipline ${selected.discipline}/5`}
            icon={<BookOpen />}
            action={
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="xs" onClick={() => openEdit(selected)}>
                  <Edit3 className="h-3 w-3" /> Edit
                </Button>
                <Button variant="ghost" size="xs" onClick={() => deleteEntry(selected)} className="text-bear hover:text-bear">
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selected.emotion === "CALM" || selected.emotion === "CONFIDENT" ? "pass" : selected.emotion === "ANXIOUS" || selected.emotion === "FOMO" ? "fail" : "neutral"}>
                {selected.emotion ?? "UNLABELED"}
              </Badge>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <span key={value} className={cn("h-1.5 w-4 rounded-full", value <= selected.discipline ? "bg-accent" : "bg-white/[0.07]")} />
                ))}
              </div>
              <span className="text-[9px] text-ink-500">{selected.discipline}/5 discipline</span>
            </div>

            <h3 className="mt-4 text-[15px] font-semibold leading-snug text-ink-100">{selected.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-400">{selected.content}</p>

            {selected.lessons && (
              <div className="mt-4 rounded-md border border-bull/15 bg-bull/[0.035] p-3">
                <div className="micro-label text-bull/80">Lesson extracted</div>
                <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-300">{selected.lessons}</p>
              </div>
            )}

            {selected.trade && (
              <div className="mt-4 rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <div className="micro-label">Linked trade</div>
                  <Button variant="ghost" size="xs" onClick={() => setTab("paper")}>Open paper desk</Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-400">
                  <span className={selected.trade.direction === "LONG" ? "text-bull" : "text-bear"}>{selected.trade.direction} {selected.trade.instrument}</span>
                  <span className="numeric">Entry {selected.trade.entryPrice}</span>
                  <span className={cn("numeric", (selected.trade.pnl ?? 0) >= 0 ? "text-bull" : "text-bear")}>{fmtMoney(selected.trade.pnl, { sign: true })}</span>
                  <span className="numeric">{fmtR(selected.trade.rMultiple)}</span>
                  <Badge variant="dark">{selected.trade.source}</Badge>
                </div>
              </div>
            )}

            {selected.tags && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {selected.tags.split(",").map((tag) => (
                  <Badge key={tag} variant="neutral">#{tag.trim()}</Badge>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-white/[0.055] pt-3 text-[9px] text-ink-500">
              <span>Created {fmtDate(new Date(selected.date).getTime() / 1000)}</span>
              <span>{fmtTime(new Date(selected.date).getTime() / 1000)} ET</span>
            </div>
          </Panel>
        ) : (
          <Panel title="Entry detail" icon={<BookOpen />}>
            <EmptyState icon={<BookOpen />} title="Select an entry" description="Pick a journal entry from the left to review the full reflection." />
          </Panel>
        )}
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Emotion distribution" subtitle="Review where execution pressure comes from" icon={<TrendingUp />}>
            <div className="space-y-2">
              {Object.entries(emotionCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([emotion, count]) => (
                  <div key={emotion} className="flex items-center gap-2">
                    <span className="w-20 text-[9px] uppercase tracking-wide text-ink-500">{emotion}</span>
                    <Progress value={(count / entries.length) * 100} tone={emotion === "CALM" || emotion === "CONFIDENT" ? "bull" : emotion === "ANXIOUS" || emotion === "FOMO" ? "bear" : "accent"} />
                    <span className="numeric w-5 text-right text-[9px] text-ink-400">{count}</span>
                  </div>
                ))}
            </div>
          </Panel>
          <Panel title="Linked execution log" subtitle="Trades referenced in this journal" icon={<Link2 />} flush>
            {trades.length ? (
              <div className="max-h-[220px] overflow-y-auto">
                {trades.filter((trade) => entries.some((entry) => entry.tradeId === trade.id)).slice(0, 8).map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between gap-2 border-b border-white/[0.035] px-3.5 py-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={trade.direction === "LONG" ? "bull" : "bear"}>{trade.direction}</Badge>
                      <span className="text-[10px] text-ink-300">{trade.instrument} · {fmtDateTime(new Date(trade.entryTime).getTime() / 1000)}</span>
                    </div>
                    <span className={cn("numeric text-[10px]", (trade.pnl ?? 0) >= 0 ? "text-bull" : "text-bear")}>{fmtMoney(trade.pnl, { sign: true })}</span>
                  </div>
                ))}
                {!entries.some((entry) => entry.tradeId) && (
                  <div className="px-4 py-6 text-center text-[10px] text-ink-500">No journal entries are linked to trades yet.</div>
                )}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-[10px] text-ink-500">No trades available.</div>
            )}
          </Panel>
        </div>
      )}

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit journal entry" : "New journal entry"}
        description="Capture the process, not just the P&L. Entries are persisted in the local SQLite database."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={saveEntry} disabled={saving || form.title.trim().length < 3 || form.content.trim().length < 10}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create entry"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <p className="rounded border border-bear/20 bg-bear/[0.04] px-2.5 py-2 text-[10px] text-bear">{error}</p>}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label="Date & time (ET)">
              <Input type="datetime-local" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
            </Field>
            <Field label="Emotion">
              <Select value={form.emotion} onChange={(event) => setForm((prev) => ({ ...prev, emotion: event.target.value }))}>
                {EMOTIONS.map((emotion) => (
                  <option key={emotion} value={emotion}>{emotion}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Title">
            <Input value={form.title} maxLength={160} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="What happened, in one line?" />
          </Field>
          <Field label="Review">
            <Textarea value={form.content} maxLength={12000} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} placeholder="Context, execution, what you saw, what you did…" className="min-h-[120px]" />
          </Field>
          <Field label="Lesson">
            <Textarea value={form.lessons} maxLength={4000} onChange={(event) => setForm((prev) => ({ ...prev, lessons: event.target.value }))} placeholder="One concrete adjustment for the next session." className="min-h-[70px]" />
          </Field>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label="Discipline (1–5)">
              <Segmented
                className="h-10 w-full sm:h-9"
                value={String(form.discipline)}
                onChange={(value) => setForm((prev) => ({ ...prev, discipline: Number(value) }))}
                options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: String(value) }))}
              />
            </Field>
            <Field label="Tags (comma separated)">
              <Input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder="patience, FVG, process" />
            </Field>
          </div>
          <Field label="Linked trade">
            <Select value={form.tradeId} onChange={(event) => setForm((prev) => ({ ...prev, tradeId: event.target.value }))} disabled={!!editing}>
              <option value="">No linked trade</option>
              {trades.map((trade) => (
                <option key={trade.id} value={trade.id}>
                  {fmtDate(new Date(trade.entryTime).getTime() / 1000)} · {trade.direction} {trade.instrument} · {fmtMoney(trade.pnl, { sign: true })}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
