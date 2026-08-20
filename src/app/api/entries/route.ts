import { NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { apiError, authedUser, json, validDate, validMonth, validTime } from "@/lib/api";
import { monthBounds } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user } = await authedUser();

  const { searchParams } = req.nextUrl;
  const month = searchParams.get("month");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let where;
  if (month) {
    if (!validMonth(month)) return apiError("Mês inválido. Use YYYY-MM.");
    const b = monthBounds(month);
    where = and(
      eq(timeEntries.userId, user.id),
      gte(timeEntries.date, b.from),
      lte(timeEntries.date, b.to),
    );
  } else if (from && to) {
    if (!validDate(from) || !validDate(to)) return apiError("Datas inválidas.");
    where = and(
      eq(timeEntries.userId, user.id),
      gte(timeEntries.date, from),
      lte(timeEntries.date, to),
    );
  } else {
    return apiError("Informe ?month=YYYY-MM ou ?from=&to=.");
  }

  const entries = await db
    .select()
    .from(timeEntries)
    .where(where)
    .orderBy(asc(timeEntries.date), asc(timeEntries.time));

  return json({ entries });
}

export async function POST(req: NextRequest) {
  const { user } = await authedUser();

  const body = await req.json().catch(() => null);
  const date = String(body?.date ?? "");
  const time = String(body?.time ?? "");
  const type = String(body?.type ?? "");
  const note =
    typeof body?.note === "string" && body.note.trim() !== "" ? body.note.trim() : null;

  if (!validDate(date)) return apiError("Data inválida.");
  if (!validTime(time)) return apiError("Horário inválido. Use HH:MM.");
  if (type !== "entrada" && type !== "saida") return apiError("Tipo deve ser 'entrada' ou 'saida'.");
  if (note && note.length > 160) return apiError("Observação muito longa (máx. 160 caracteres).");

  const [entry] = await db
    .insert(timeEntries)
    .values({ userId: user.id, date, time, type, note })
    .returning();

  return json({ entry }, 201);
}
