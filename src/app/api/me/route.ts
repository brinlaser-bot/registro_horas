import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiError, authedUser, json, validTime } from "@/lib/api";

export const dynamic = "force-dynamic";

function toPublic(u: typeof users.$inferSelect) {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

export async function GET() {
  const { user } = await authedUser();
  return json({ user: toPublic(user) });
}

export async function PATCH(req: NextRequest) {
  const { user } = await authedUser();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Requisição inválida.");

  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) return apiError("Nome muito curto.");
    updates.name = name;
  }

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiError("E-mail inválido.");
    const [dup] = await db.select().from(users).where(eq(users.email, email));
    if (dup && dup.id !== user.id) return apiError("Este e-mail já está em uso.", 409);
    updates.email = email;
  }

  for (const key of ["workStart", "workEnd", "lunchStart", "lunchEnd"] as const) {
    if (typeof body[key] === "string") {
      if (!validTime(body[key])) return apiError(`Horário inválido em ${key}.`);
      updates[key] = body[key];
    }
  }

  if (body.maxDailyMinutes !== undefined) {
    const v = Number(body.maxDailyMinutes);
    if (!Number.isInteger(v) || v < 300 || v > 720) {
      return apiError("O limite diário deve ficar entre 5h e 12h.");
    }
    updates.maxDailyMinutes = v;
  }

  if (typeof body.autoDeductLunch === "boolean") {
    updates.autoDeductLunch = body.autoDeductLunch;
  }

  if (Object.keys(updates).length === 0) return json({ user: toPublic(user) });

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, user.id))
    .returning();

  return json({ user: toPublic(updated) });
}
