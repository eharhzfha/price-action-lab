import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  exitPrice: z.number().positive().nullable().optional(),
  exitTime: z.string().nullable().optional(),
  pnl: z.number().nullable().optional(),
  rMultiple: z.number().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  setupGrade: z.string().max(8).nullable().optional(),
  stopPrice: z.number().positive().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
  fees: z.number().min(0).optional(),
  source: z.enum(["BACKTEST", "PAPER", "LIVE", "MANUAL"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const updated = await prisma.trade.update({
      where: { id },
      data: {
        ...(data.exitPrice !== undefined ? { exitPrice: data.exitPrice } : {}),
        ...(data.exitTime !== undefined
          ? { exitTime: data.exitTime ? new Date(data.exitTime) : null }
          : {}),
        ...(data.pnl !== undefined ? { pnl: data.pnl } : {}),
        ...(data.rMultiple !== undefined ? { rMultiple: data.rMultiple } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.setupGrade !== undefined ? { setupGrade: data.setupGrade } : {}),
        ...(data.stopPrice !== undefined ? { stopPrice: data.stopPrice } : {}),
        ...(data.targetPrice !== undefined ? { targetPrice: data.targetPrice } : {}),
        ...(data.fees !== undefined ? { fees: data.fees } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
      },
    });
    return NextResponse.json({ trade: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update trade" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.trade.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete trade" },
      { status: 500 },
    );
  }
}
