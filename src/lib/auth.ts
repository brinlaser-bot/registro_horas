import { asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

/**
 * App de uso pessoal (sem login): retorna sempre o único usuário do sistema,
 * criando-o automaticamente (com dados de exemplo) na primeira execução.
 */
export async function getDefaultUser(): Promise<User> {
  await ensureSeeded();
  const [user] = await db.select().from(users).orderBy(asc(users.id)).limit(1);
  if (!user) throw new Error("Nenhum usuário configurado no banco.");
  return user;
}
