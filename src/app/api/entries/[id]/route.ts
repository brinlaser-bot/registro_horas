import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { apiError, authedUser, json, validTime } from "@/lib/api";

export const dynamic = "force-dynamic";

async function ownedEntry(id: number, userId: number) {
  const [entry] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)));
  return entry ?? null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await authedUser();

  const { id } = await ctx.params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return apiError("Registro inválido.");

  const entry = await ownedEntry(entryId, user.id);
  if (!entry) return apiError("Registro não encontrado.", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Requisição inválida.");

  const updates: Record<string, unknown> = {};
  if (typeof body.time === "string") {
    if (!validTime(body.time)) return apiError("Horário inválido. Use HH:MM.");
    updates.time = body.time;
  }
  if (typeof body.type === "string") {
    if (body.type !== "entrada" && body.type !== "saida") {
      return apiError("Tipo deve ser 'entrada' ou 'saida'.");
    }
    updates.type = body.type;
  }
  if (body.note !== undefined) {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 160) return apiError("Observação muito longa (máx. 160 caracteres).");
    updates.note = note === "" ? null : note;
  }

  const [updated] = await db
    .update(timeEntries)
    .set(updates)
    .where(eq(timeEntries.id, entryId))
    .returning();

  return json({ entry: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await authedUser();

  const { id } = await ctx.params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return apiError("Registro inválido.");

  const entry = await ownedEntry(entryId, user.id);
  if (!entry) return apiError("Registro não encontrado.", 404);

  await db.delete(timeEntries).where(eq(timeEntries.id, entryId));
  return json({ ok: true });
}
