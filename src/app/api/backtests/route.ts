import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  name: z.string().min(2).max(160),
  datasetName: z.string().min(1).max(260),
  config: z.record(z.unknown()),
  metrics: z.record(z.unknown()),
  trades: z.array(z.record(z.unknown())),
  equity: z.array(z.record(z.unknown())),
  totalTrades: z.number().int().min(0),
  winRate: z.number(),
  profitFactor: z.number(),
  expectancyR: z.number(),
  maxDrawdown: z.number(),
  netPnl: z.number(),
  notes: z.string().max(4000).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Number(searchParams.get("limit") ?? 30) || 30);
    const runs = await prisma.backtestRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ runs, count: runs.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load backtests" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid backtest payload", issues: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const run = await prisma.backtestRun.create({
      data: {
        name: data.name,
        datasetName: data.datasetName,
        configJson: JSON.stringify(data.config),
        metricsJson: JSON.stringify(data.metrics),
        tradesJson: JSON.stringify(data.trades),
        equityJson: JSON.stringify(data.equity),
        totalTrades: data.totalTrades,
        winRate: data.winRate,
        profitFactor: data.profitFactor,
        expectancyR: data.expectancyR,
        maxDrawdown: data.maxDrawdown,
        netPnl: data.netPnl,
        notes: data.notes ?? null,
      },
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save backtest" },
      { status: 500 },
    );
  }
}
