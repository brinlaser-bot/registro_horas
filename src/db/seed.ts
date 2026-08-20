import { eq } from "drizzle-orm";
import { db } from "./index";
import { compensations, timeEntries, users, type NewTimeEntry } from "./schema";
import { hashPassword } from "../lib/auth";
import { addDays, isWeekend, nextWorkday, todayString } from "../lib/time";

export const DEMO_EMAIL = "demo@exemplo.com";
export const DEMO_PASSWORD = "demo123";

type Pattern = Array<[string, "entrada" | "saida"]>;

/** Padrões de dia (do mais recente para o mais antigo), pulando fins de semana. */
const PATTERNS: Pattern[] = [
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["19:45", "saida"]], // 10h45 — excedente 45min
  [["08:02", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["20:30", "saida"]], // 11h30 — excedente 1h30
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["15:30", "saida"]], // 6h30 — dia de compensação
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:30", "saida"]], // 8h30
  [["07:45", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["16:45", "saida"]], // 8h
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["19:15", "saida"]], // 10h15 — excedente 15min
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["16:45", "saida"]], // 7h45
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:10", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:20", "saida"]], // 8h10
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["16:30", "saida"]], // 7h30
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["18:45", "saida"]], // 9h45
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
  [["08:00", "entrada"], ["12:00", "saida"], ["13:00", "entrada"], ["17:00", "saida"]],
];

/**
 * Cria o usuário demo com ~4 semanas de registros realistas.
 * Idempotente: não faz nada se o usuário demo já existir.
 */
export async function seedDemoUser(): Promise<boolean> {
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) return false;

  const [user] = await db
    .insert(users)
    .values({
      name: "Alex Santos",
      email: DEMO_EMAIL,
      passwordHash: hashPassword(DEMO_PASSWORD),
      workStart: "08:00",
      workEnd: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
      maxDailyMinutes: 600,
      autoDeductLunch: true,
    })
    .returning();

  const today = todayString();
  const days: { date: string; pattern: Pattern }[] = [];
  let offset = 1;
  for (const pattern of PATTERNS) {
    let date = addDays(today, -offset);
    while (isWeekend(date)) {
      offset += 1;
      date = addDays(today, -offset);
    }
    days.push({ date, pattern });
    offset += 1;
  }

  const entryRows: NewTimeEntry[] = [];
  const dayOf = (n: number) => days[n]?.date ?? "";

  days.forEach(({ date, pattern }, i) => {
    pattern.forEach(([time, type], j) => {
      const note =
        i === 1 && j === 3
          ? "Fechamento de projeto — excedeu o limite"
          : i === 3 && j === 3
            ? "Dia longo, compensar amanhã"
            : i === 9
              ? "Home office"
              : null;
      entryRows.push({ userId: user.id, date, time, type, note });
    });
  });

  if (entryRows.length > 0) await db.insert(timeEntries).values(entryRows);

  // Compensações seguindo a regra da empresa
  const pendingTarget = isWeekend(today) ? nextWorkday(today) : today;
  await db.insert(compensations).values([
    {
      userId: user.id,
      sourceDate: dayOf(3), // 11h30 → excedente 1h30
      targetDate: dayOf(4), // compensado no dia seguinte (6h30)
      minutes: 90,
      status: "concluida",
      note: "Compensação do dia com 11h30 de trabalho.",
    },
    {
      userId: user.id,
      sourceDate: dayOf(9), // 10h15 → excedente 15min
      targetDate: dayOf(10), // saiu 15min mais cedo
      minutes: 15,
      status: "concluida",
      note: "Saída 15min antes do horário.",
    },
    {
      userId: user.id,
      sourceDate: dayOf(1), // 10h45 → excedente 45min
      targetDate: pendingTarget,
      minutes: 45,
      status: "pendente",
      note: "Planejo sair às 16h15 hoje para compensar.",
    },
  ]);

  return true;
}

/** Garante que o usuário demo exista (chamado no login/registro). */
export async function ensureSeeded(): Promise<void> {
  await seedDemoUser();
}
