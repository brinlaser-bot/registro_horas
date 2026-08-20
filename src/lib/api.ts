import { NextResponse } from "next/server";
import { getDefaultUser } from "@/lib/auth";
import type { User } from "@/db/schema";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Retorna o usuário único do app (criado automaticamente se necessário). */
export async function authedUser(): Promise<{ user: User }> {
  const user = await getDefaultUser();
  return { user };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validTime(t: string): boolean {
  return TIME_RE.test(t);
}

export function validDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day;
}

export function validMonth(m: string): boolean {
  return /^\d{4}-\d{2}$/.test(m);
}
