import { NextRequest } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { compensations } from "@/db/schema";
import { apiError, authedUser, json, validDate } from "@/lib/api";
import { enrichCompensations } from "@/lib/compensations";
import type { WorkSettings } from "@/lib/time";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const { user } = await authedUser();

  const comps = await db
    .select()
    .from(compensations)
    .where(eq(compensations.userId, user.id))
    .orderBy(desc(compensations.createdAt));

  const enriched = await enrichCompensations(comps, settingsOf(user));
  return json({ compensations: enriched });
}

export async function POST(req: NextRequest) {
  const { user } = await authedUser();

  const body = await req.json().catch(() => null);
  const sourceDate = String(body?.sourceDate ?? "");
  const targetDate = String(body?.targetDate ?? "");
  const minutes = Number(body?.minutes);
  const note = typeof body?.note === "string" && body.note.trim() !== "" ? body.note.trim() : null;

  if (!validDate(sourceDate) || !validDate(targetDate)) return apiError("Datas inválidas.");
  if (sourceDate === targetDate) return apiError("Os dias de origem e destino devem ser diferentes.");
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 720) {
    return apiError("As horas devem ficar entre 5min e 12h.");
  }
  if (note && note.length > 200) return apiError("Observação muito longa.");

  const [comp] = await db
    .insert(compensations)
    .values({
      userId: user.id,
      sourceDate,
      targetDate,
      minutes,
      status: "pendente",
      note,
    })
    .returning();

  const enriched = await enrichCompensations([comp], settingsOf(user));
  return json({ compensation: enriched[0] }, 201);
}
