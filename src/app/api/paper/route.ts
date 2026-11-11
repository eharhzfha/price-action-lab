import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const putSchema = z.object({
  balance: z.number(),
  equity: z.number(),
  state: z.record(z.unknown()),
});

const EMPTY_STATE = { positions: [], orders: [], fills: [], dayRealized: 0 };

export async function GET() {
  try {
    const account = await prisma.paperAccount.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        name: "Paper Account",
        startingBalance: 100000,
        balance: 100000,
        equity: 100000,
        stateJson: JSON.stringify(EMPTY_STATE),
      },
    });
    let state: unknown = EMPTY_STATE;
    try {
      state = JSON.parse(account.stateJson);
    } catch {
      state = EMPTY_STATE;
    }
    return NextResponse.json({ account: { ...account, state }, stateJson: undefined });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load paper account" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = putSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid paper state", issues: parsed.error.flatten() }, { status: 400 });
    }
    const { balance, equity, state } = parsed.data;
    const account = await prisma.paperAccount.upsert({
      where: { id: "default" },
      update: {
        balance,
        equity,
        stateJson: JSON.stringify(state),
      },
      create: {
        id: "default",
        name: "Paper Account",
        startingBalance: 100000,
        balance,
        equity,
        stateJson: JSON.stringify(state),
      },
    });
    return NextResponse.json({ ok: true, updatedAt: account.updatedAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save paper state" },
      { status: 500 },
    );
  }
}
