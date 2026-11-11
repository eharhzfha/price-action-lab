import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tradeInput = z.object({
  symbol: z.string().min(1).default("NQ1!"),
  instrument: z.enum(["NQ", "MNQ"]).default("MNQ"),
  direction: z.enum(["LONG", "SHORT"]),
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive().nullable().optional(),
  quantity: z.number().int().positive(),
  entryTime: z.string().min(4),
  exitTime: z.string().nullable().optional(),
  stopPrice: z.number().positive().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
  fees: z.number().min(0).default(0),
  slippage: z.number().min(0).default(0),
  pnl: z.number().nullable().optional(),
  rMultiple: z.number().nullable().optional(),
  source: z.enum(["BACKTEST", "PAPER", "LIVE", "MANUAL"]).default("MANUAL"),
  setupGrade: z.string().max(8).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");
    const limit = Math.min(500, Number(searchParams.get("limit") ?? 200) || 200);
    const query = searchParams.get("q")?.trim();

    const trades = await prisma.trade.findMany({
      where: {
        ...(source && source !== "ALL" ? { source } : {}),
        ...(query
          ? {
              OR: [
                { notes: { contains: query } },
                { tags: { contains: query } },
                { symbol: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: { entryTime: "desc" },
      take: limit,
      include: { journalEntries: { select: { id: true, title: true } } },
    });

    return NextResponse.json({ trades, count: trades.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load trades" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = tradeInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid trade payload", issues: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const entryTime = new Date(data.entryTime);
    if (Number.isNaN(entryTime.getTime())) {
      return NextResponse.json({ error: "entryTime is not a valid date" }, { status: 400 });
    }
    const exitTime = data.exitTime ? new Date(data.exitTime) : null;
    if (exitTime && Number.isNaN(exitTime.getTime())) {
      return NextResponse.json({ error: "exitTime is not a valid date" }, { status: 400 });
    }

    const trade = await prisma.trade.create({
      data: {
        symbol: data.symbol,
        instrument: data.instrument,
        direction: data.direction,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice ?? null,
        quantity: data.quantity,
        entryTime,
        exitTime,
        stopPrice: data.stopPrice ?? null,
        targetPrice: data.targetPrice ?? null,
        fees: data.fees,
        slippage: data.slippage,
        pnl: data.pnl ?? null,
        rMultiple: data.rMultiple ?? null,
        source: data.source,
        setupGrade: data.setupGrade ?? null,
        notes: data.notes ?? null,
        tags: data.tags ?? null,
      },
    });

    return NextResponse.json({ trade }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create trade" },
      { status: 500 },
    );
  }
}
