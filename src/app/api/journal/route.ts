import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const journalInput = z.object({
  date: z.string().min(4),
  title: z.string().min(3).max(160),
  content: z.string().min(10).max(12000),
  emotion: z.string().max(40).nullable().optional(),
  discipline: z.number().int().min(1).max(5).default(3),
  lessons: z.string().max(4000).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  tradeId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const entries = await prisma.journalEntry.findMany({
      where: query
        ? {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } },
              { tags: { contains: query } },
            ],
          }
        : undefined,
      orderBy: { date: "desc" },
      take: 200,
      include: {
        trade: {
          select: {
            id: true,
            direction: true,
            entryPrice: true,
            exitPrice: true,
            pnl: true,
            rMultiple: true,
            source: true,
            instrument: true,
          },
        },
      },
    });
    return NextResponse.json({ entries, count: entries.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load journal" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = journalInput.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid journal payload", issues: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "date is not valid" }, { status: 400 });
    }
    const entry = await prisma.journalEntry.create({
      data: {
        date,
        title: data.title,
        content: data.content,
        emotion: data.emotion ?? null,
        discipline: data.discipline,
        lessons: data.lessons ?? null,
        tags: data.tags ?? null,
        tradeId: data.tradeId || null,
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create journal entry" },
      { status: 500 },
    );
  }
}
