import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(3).max(160).optional(),
  content: z.string().min(10).max(12000).optional(),
  emotion: z.string().max(40).nullable().optional(),
  discipline: z.number().int().min(1).max(5).optional(),
  lessons: z.string().max(4000).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  date: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const entry = await prisma.journalEntry.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.emotion !== undefined ? { emotion: data.emotion } : {}),
        ...(data.discipline !== undefined ? { discipline: data.discipline } : {}),
        ...(data.lessons !== undefined ? { lessons: data.lessons } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
      },
    });
    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update journal entry" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.journalEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete journal entry" },
      { status: 500 },
    );
  }
}
