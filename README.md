# PRICE ACTION LAB

Professional NASDAQ futures research desk for NQ / MNQ. It combines a deterministic price-action strategy engine, a strict zero-look-ahead replay backtester, paper execution, a risk calculator, and a trading journal in one local-first Next.js application.

All timestamps are evaluated in **America/New_York**. The desktop shell is designed for a 1440 px+ workstation.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 3 + Radix primitives + Lucide icons
- lightweight-charts 4 for candlesticks, volume, and canvas overlays
- Zustand for replay / engine / settings state
- Prisma 5 + SQLite for local persistence
- Luxon for timezone-safe session math
- Vitest for engine, risk, CSV, integrity, and backtest tests

## Run locally

```bash
npm install
npx prisma generate
npx prisma migrate deploy        # or: npx prisma migrate dev
npm run prisma:seed              # optional demo trades + journal entries
npm run dev                      # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start
```

Useful scripts:

| Script | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Full Vitest suite |
| `npm run data:generate` | Regenerate `data/sample_nq.csv` |
| `npm run db:push` | Push the Prisma schema without a migration |

`DATABASE_URL` lives in `.env` and defaults to `file:./dev.db`.

## Workspace tabs

1. **Command Center** — live engine decision, alignment, signal ticket, validation checklist, liquidity map, and the latest research snapshot.
2. **Market Structure** — 1M / 5M / 15M / 1H / 4H candlestick chart with FVG, order block, breaker, liquidity, BOS/CHoCH, equilibrium, and trade-level overlays.
3. **Strategy Engine** — six-stage decision path, pass/fail tree, and engine configuration (window, lookbacks, R target, freshness).
4. **Backtest & Replay** — chronological run over the loaded M1 dataset, equity curve, trade ledger, CSV import/export, and saved research runs.
5. **Paper Desk** — simulated market execution with automatic bracket management, persisted account state, and fill history.
6. **Risk Calculator** — strict NQ / MNQ contract math, margin cap, and side-by-side instrument comparison.
7. **Trading Journal** — searchable review stream, emotion/discipline tracking, linked trades, and lessons.

The replay clock is global: scrubbing or playing the cursor in one tab updates every tab. Playback can be paused; clicking the chart or stepping the clock pauses it.

## Strategy model

### 1. Higher-timeframe bias

Only **closed** 4H and 1H candles are used.

- 4H and 1H both bullish or both bearish → `ALIGNED`.
- Mixed → `CONFLICTED`.
- No usable HTF structure → `UNCLEAR` → `NO_SETUP`.

### 2. Route by alignment

- `ALIGNED` → look for a **5M BOS**.
- `CONFLICTED` → look for a **15M BOS**.
- `UNCLEAR` → no setup.

### 3. Liquidity sweep

A sweep is a wick through a mapped level (PDH/PDL, session highs/lows, equal highs/lows, equilibrium) followed by a close back on the original side, within the configured lookback.

### 4. Point of interest

Eligible POIs: fair value gaps, order blocks, breakers, and equilibrium. Equilibrium is non-blocking by default (`requireEquilibrium: false`) and acts as confluence only.

### 5. Entry

Inside the New York observation window (**09:50–10:10 ET** by default), price must tap the POI and then confirm with a **1M BOS** in the bias direction. A sweep without a POI tap, or a POI tap without a subsequent 1M BOS, is not a setup.

### 6. Risk and target

The engine measures the structural stop beyond the POI and sweep extreme, then projects the configured R target (default `2R`). Setups are graded on alignment, sweep quality, POI quality, freshness, and window compliance.

### Look-ahead guarantees

- HTF candles must be closed before the cursor.
- LTF candles are aggregated only from bars at or before the replay cursor.
- The backtest fills entries at the next bar open after a signal, never at the signal bar close.
- If stop and target are both touched in one bar, the stop is assumed first.
- Slippage and commissions are applied on both sides.

## Risk math

| Contract | Point value | Tick size | Tick value |
| --- | --- | --- | --- |
| NQ | $20 / point | 0.25 | $5.00 |
| MNQ | $2 / point | 0.25 | $0.50 |

Position size is floored to whole contracts and capped so initial margin does not exceed the configured percentage of account equity. Commission defaults to $2.50 per side; the backtest defaults to 1 tick of slippage.

Backtest defaults: MNQ, $100,000 starting balance, 1% risk per trade, 2R target, one trade per day, 180-minute maximum hold, 15:55 ET exit, two warm-up days. These are all editable in the UI.

## Data

The bundled dataset is `data/sample_nq.csv`: 27,600 one-minute NQ bars across 20 sessions. It is generated deterministically by `scripts/generate-sample-data.ts`.

CSV import accepts:

```csv
timestamp,open,high,low,close,volume
2026-11-06 09:30:00,18500.25,18502.00,18499.75,18501.50,842
```

The importer tolerates common aliases (`time`, `date`, `datetime`, `o/h/l/c/v`), comma/semicolon/tab delimiters, Unix seconds or milliseconds, and ISO or NY-local timestamps. Rows failing OHLC validation are skipped and reported.

## Persistence

Prisma models: `Trade`, `BacktestRun`, `JournalEntry`, `UserSettings`, and `PaperAccount`. Paper state (positions, fills, balance, open risk) is serialized into the paper account record, so it survives reloads.

## Tests

```bash
npm test
```

Coverage includes:

- NQ/MNQ point and tick math, sizing, margin caps, and break-even win rate.
- CSV parsing: aliases, delimiters, timestamps, duplicate handling, invalid rows.
- Market structure, sweeps, FVGs, and deterministic decision output.
- Zero-look-ahead integrity: changing future candles cannot change the current signal.
- Backtest invariants: chronological entries, stop-first ambiguity, costs, and equity accounting.

## Notes

- The app is a research and simulation tool, not a live brokerage connection.
- All market data, paper fills, and research results stay local.
- Chart overlays are drawn on a canvas layer using logical chart coordinates, so they remain aligned while panning and zooming.
