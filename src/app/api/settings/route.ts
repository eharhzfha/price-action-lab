import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsInput = z.object({
  defaultInstrument: z.enum(["NQ", "MNQ"]).optional(),
  accountSize: z.number().positive().optional(),
  riskPct: z.number().positive().max(20).optional(),
  commissionPerSide: z.number().min(0).optional(),
  slippageTicks: z.number().min(0).max(20).optional(),
  observationStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  observationEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  defaultRR: z.number().positive().max(10).optional(),
  timezone: z.string().optional(),
});

const DEFAULTS = {
  id: "default",
  defaultInstrument: "MNQ",
  accountSize: 100000,
  riskPct: 1,
  commissionPerSide: 2.5,
  slippageTicks: 1,
  observationStart: "09:50",
  observationEnd: "10:10",
  defaultRR: 2,
  timezone: "America/New_York",
};

export async function GET() {
  try {
    const settings = await prisma.userSettings.upsert({
      where: { id: "default" },
      update: {},
      create: DEFAULTS,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = settingsInput.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid settings", issues: parsed.error.flatten() }, { status: 400 });
    }
    const settings = await prisma.userSettings.upsert({
      where: { id: "default" },
      update: parsed.data,
      create: { ...DEFAULTS, ...parsed.data },
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 },
    );
  }
}
