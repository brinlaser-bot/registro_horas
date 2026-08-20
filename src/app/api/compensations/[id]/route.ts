import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { compensations } from "@/db/schema";
import { apiError, authedUser, json, validDate } from "@/lib/api";
import { enrichCompensations } from "@/lib/compensations";
import type { WorkSettings } from "@/lib/time";

export const dynamic = "force-dynamic";

const STATUSES = ["pendente", "concluida", "cancelada"];

function settingsOf(user: { workStart: string; workEnd: string; lunchStart: string; lunchEnd: string; maxDailyMinutes: number; autoDeductLunch: boolean }): WorkSettings {
  return {
    workStart: user.workStart,
    workEnd: user.workEnd,
    lunchStart: user.lunchStart,
    lunchEnd: user.lunchEnd,
    maxDailyMinutes: user.maxDailyMinutes,
    autoDeductLunch: user.autoDeductLunch,
  };
}

async function ownedComp(id: number, userId: number) {
  const [comp] = await db
    .select()
    .from(compensations)
    .where(and(eq(compensations.id, id), eq(compensations.userId, userId)));
  return comp ?? null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await authedUser();

  const { id } = await ctx.params;
  const compId = Number(id);
  if (!Number.isInteger(compId)) return apiError("Compensação inválida.");

  const comp = await ownedComp(compId, user.id);
  if (!comp) return apiError("Compensação não encontrada.", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Requisição inválida.");

  const updates: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) return apiError("Status inválido.");
    updates.status = body.status;
  }
  if (typeof body.sourceDate === "string") {
    if (!validDate(body.sourceDate)) return apiError("Data de origem inválida.");
    updates.sourceDate = body.sourceDate;
  }
  if (typeof body.targetDate === "string") {
    if (!validDate(body.targetDate)) return apiError("Data de destino inválida.");
    updates.targetDate = body.targetDate;
  }
  if (body.minutes !== undefined) {
    const m = Number(body.minutes);
    if (!Number.isInteger(m) || m < 5 || m > 720) {
      return apiError("As horas devem ficar entre 5min e 12h.");
    }
    updates.minutes = m;
  }
  if (body.note !== undefined) {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 200) return apiError("Observação muito longa.");
    updates.note = note === "" ? null : note;
  }

  if (updates.sourceDate && updates.targetDate && updates.sourceDate === updates.targetDate) {
    return apiError("Os dias de origem e destino devem ser diferentes.");
  }

  const [updated] = await db
    .update(compensations)
    .set(updates)
    .where(eq(compensations.id, compId))
    .returning();

  const enriched = await enrichCompensations([updated], settingsOf(user));
  return json({ compensation: enriched[0] });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await authedUser();

  const { id } = await ctx.params;
  const compId = Number(id);
  if (!Number.isInteger(compId)) return apiError("Compensação inválida.");

  const comp = await ownedComp(compId, user.id);
  if (!comp) return apiError("Compensação não encontrada.", 404);

  await db.delete(compensations).where(eq(compensations.id, compId));
  return json({ ok: true });
}
