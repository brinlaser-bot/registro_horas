import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { timeEntries, type Compensation } from "@/db/schema";
import { computeDay, type WorkSettings } from "@/lib/time";
import type { CompWithDays } from "@/lib/types";

/** Enriquece compensações com o resumo dos dias de origem/destino. */
export async function enrichCompensations(
  comps: Compensation[],
  settings: WorkSettings,
): Promise<CompWithDays[]> {
  if (comps.length === 0) return [];

  const dates = new Set<string>();
  for (const c of comps) {
    dates.add(c.sourceDate);
    dates.add(c.targetDate);
  }

  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, comps[0].userId), inArray(timeEntries.date, [...dates])));

  const byDate = new Map<string, ReturnType<typeof computeDay>>();
  for (const date of dates) {
    const dayEntries = rows
      .filter((r) => r.date === date)
      .map((r) => ({ ...r, type: r.type as "entrada" | "saida" }));
    byDate.set(date, computeDay(dayEntries, settings));
  }

  return comps.map((c) => {
    const src = byDate.get(c.sourceDate);
    const tgt = byDate.get(c.targetDate);
    return {
      ...c,
      sourceDay: src && !src.empty
        ? { workedMinutes: src.workedMinutes, excessMinutes: src.excessMinutes }
        : null,
      targetDay: tgt && !tgt.empty
        ? { workedMinutes: tgt.workedMinutes, balanceMinutes: tgt.balanceMinutes }
        : null,
    };
  });
}
