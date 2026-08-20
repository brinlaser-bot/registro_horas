"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { getEntries, getCompensations, getSettings, getEntriesByDate, todayString as todayStr } from "@/lib/storage";
import { useSyncStorage } from "@/lib/use-storage-state";
import { computeDay, formatMinutes, monthKey, weekdayShort } from "@/lib/time";
import { DayCard } from "@/components/day-card";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";

export default function RegistrosPage() {
  const sync = useSyncStorage();
  const [month, setMonth] = useState(monthKey(todayStr()));
  const [refresh, setRefresh] = useState(0);

  const settings = useMemo(() => getSettings(), [refresh]);
  const entries = useMemo(() => getEntries().filter((e) => e.date.startsWith(month)), [month, refresh]);

  const days = useMemo(() => {
    const byDate = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return [...byDate.entries()]
      .map(([_, ents]) => computeDay(ents, settings))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, settings]);

  const summary = useMemo(() => {
    return days.reduce(
      (acc, d) => ({ tracked: acc.tracked + 1, worked: acc.worked + d.workedMinutes, balance: acc.balance + d.balanceMinutes, excess: acc.excess + d.excessMinutes }),
      { tracked: 0, worked: 0, balance: 0, excess: 0 },
    );
  }, [days]);

  const changeMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></Button>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500" />
          <Button variant="secondary" size="sm" onClick={() => changeMonth(1)}><ChevronRight size={16} /></Button>
          {month !== monthKey(todayStr()) && <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey(todayStr()))}>Hoje</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label="Dias" value={String(summary.tracked)} />
          <Chip label="Trabalhado" value={formatMinutes(summary.worked)} />
          <Chip label="Saldo" value={`${summary.balance >= 0 ? "+" : ""}${formatMinutes(summary.balance)}`} tone={summary.balance >= 0 ? "emerald" : summary.balance < 0 ? "rose" : "slate"} />
        </div>
      </div>

      {!settings ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : days.length === 0 ? (
        <EmptyState
          icon={<Clock3 size={26} />}
          title="Nenhum registro neste mês"
          description="Registre entradas e saídas no painel inicial."
          action={<Button onClick={() => setMonth(monthKey(todayStr()))}>Ir para o mês atual</Button>}
        />
      ) : (
        <div className="space-y-4">
          {days.map((d) => (
            <DayCard key={d.date} result={d} settings={settings} onDone={() => setRefresh((r) => r + 1)} />
          ))}
        </div>
      )}

      <Card padded={false} className="bg-slate-900 !border-slate-800">
        <div className="grid gap-4 px-5 py-4 text-xs text-slate-300 sm:grid-cols-3">
          <p><span className="font-bold text-emerald-400">Base diária:</span> {formatMinutes(settings?.maxDailyMinutes ?? 480)} (jornada com 1h de almoço descontada).</p>
          <p><span className="font-bold text-rose-400">Limite da empresa:</span> {formatMinutes(settings?.maxDailyMinutes ?? 600)} por dia. Excedente = compensar.</p>
          <p><span className="font-bold text-indigo-400">No ponto:</span> total que pode ser lançado no sistema da empresa, limitado ao máximo diário.</p>
        </div>
      </Card>
    </div>
  );
}

function Chip({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "rose" }) {
  const tones = { slate: "text-slate-700 bg-white border-slate-200", emerald: "text-emerald-700 bg-emerald-50 border-emerald-200", rose: "text-rose-700 bg-rose-50 border-rose-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${tones[tone]}`}>
      <span className="font-medium opacity-60">{label}</span> {value}
    </span>
  );
}
