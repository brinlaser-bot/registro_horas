import { NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { compensations, timeEntries } from "@/db/schema";
import { apiError, authedUser, json, validMonth } from "@/lib/api";
import { enrichCompensations } from "@/lib/compensations";
import type { DaySummary } from "@/lib/types";
import {
  addDays,
  computeDay,
  monthBounds,
  monthKey,
  nowMinutesLocal,
  todayString,
  type DayResult,
  type WorkSettings,
} from "@/lib/time";

export const dynamic = "force-dynamic";

function summarize(d: DayResult): DaySummary {
  return {
    date: d.date,
    workedMinutes: d.workedMinutes,
    expectedMinutes: d.expectedMinutes,
    balanceMinutes: d.balanceMinutes,
    excessMinutes: d.excessMinutes,
    registrableMinutes: d.registrableMinutes,
    status: d.status,
    open: d.open,
    entryCount: d.entries.length,
  };
}

function settingsOf(user: {
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  maxDailyMinutes: number;
  autoDeductLunch: boolean;
}): WorkSettings {
  return {
    workStart: user.workStart,
    workEnd: user.workEnd,
    lunchStart: user.lunchStart,
    lunchEnd: user.lunchEnd,
    maxDailyMinutes: user.maxDailyMinutes,
    autoDeductLunch: user.autoDeductLunch,
  };
}

export async function GET(req: NextRequest) {
  const { user } = await authedUser();
  const settings = settingsOf(user);

  const { searchParams } = req.nextUrl;
  const month = searchParams.get("month") ?? monthKey(todayString());
  if (!validMonth(month)) return apiError("Mês inválido.");

  const bounds = monthBounds(month);
  const today = todayString();
  const recentFrom = addDays(today, -13);

  const [monthRows, recentRows, pendingRows] = await Promise.all([
    db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, user.id),
          gte(timeEntries.date, bounds.from),
          lte(timeEntries.date, bounds.to),
        ),
      )
      .orderBy(asc(timeEntries.date), asc(timeEntries.time)),
    db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, user.id),
          gte(timeEntries.date, recentFrom),
          lte(timeEntries.date, today),
        ),
      )
      .orderBy(asc(timeEntries.date), asc(timeEntries.time)),
    db
      .select()
      .from(compensations)
      .where(
        and(eq(compensations.userId, user.id), eq(compensations.status, "pendente")),
      )
      .orderBy(asc(compensations.targetDate)),
  ]);

  const cast = (r: (typeof monthRows)[number]) => ({ ...r, type: r.type as "entrada" | "saida" });

  const monthDays: DaySummary[] = [];
  const monthMap = new Map<string, DayResult>();
  const byDate = new Map<string, ReturnType<typeof cast>[]>();
  for (const r of monthRows) {
    const list = byDate.get(r.date) ?? [];
    list.push(cast(r));
    byDate.set(r.date, list);
  }
  for (const [date, entries] of byDate) {
    const res = computeDay(entries, settings);
    monthMap.set(date, res);
    monthDays.push(summarize(res));
  }
  monthDays.sort((a, b) => a.date.localeCompare(b.date));

  const todayResult = computeDay(byDate.get(today) ?? [], settings, nowMinutesLocal());

  const recentByDate = new Map<string, ReturnType<typeof cast>[]>();
  for (const r of recentRows) {
    const list = recentByDate.get(r.date) ?? [];
    list.push(cast(r));
    recentByDate.set(r.date, list);
  }
  const recent: DaySummary[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    const res = computeDay(recentByDate.get(d) ?? [], settings);
    recent.push(summarize(res));
  }

  const totals = monthDays.reduce(
    (acc, d) => {
      acc.trackedDays += 1;
      acc.workedTotal += d.workedMinutes;
      acc.registrableTotal += d.registrableMinutes;
      acc.balanceTotal += d.balanceMinutes;
      acc.excessTotal += d.excessMinutes;
      return acc;
    },
    { trackedDays: 0, workedTotal: 0, registrableTotal: 0, balanceTotal: 0, excessTotal: 0 },
  );

  const pending = await enrichCompensations(pendingRows, settings);

  return json({
    month,
    today: todayResult,
    todayStr: today,
    monthDays,
    monthTotals: totals,
    recent,
    pending,
    settings,
  });
}
