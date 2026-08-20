"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Clock3, PlusCircle, Timer, TriangleAlert, Wallet, ArrowLeftRight } from "lucide-react";
import { getEntries, getEntriesByDate, todayString as todayStr, getPendingCompensations, getSettings } from "@/lib/storage";
import { useSyncStorage } from "@/lib/use-storage-state";
import { computeDay, formatMinutes, monthKey, nowMinutesLocal, weekdayShort } from "@/lib/time";
import { QuickPunch } from "@/components/quick-punch";
import { BarsChart, type BarDatum } from "@/components/charts";
import { CompensationForm } from "@/components/compensation-form";
import { Badge, Button, Card, EmptyState, StatCard } from "@/components/ui";
import { useToast } from "@/components/toast";
import { addCompensation } from "@/lib/storage";

export default function DashboardPage() {
  const toast = useToast();
  const sync = useSyncStorage();
  const [compOpen, setCompOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  // Recarrega dados quando o storage muda (outra aba ou ação interna)
  const refreshAll = useCallback(() => setRefresh((r) => r + 1), []);

  const today = useMemo(() => {
    const settings = getSettings();
    return computeDay(getEntriesByDate(todayStr()), settings, nowMinutesLocal());
  }, [refresh]);

  const settings = useMemo(() => getSettings(), [refresh]);
  const month = monthKey(todayStr());
  const pending = useMemo(() => getPendingCompensations(), [refresh]);

  // Últimos 14 dias para gráfico
  const chartData: BarDatum[] = useMemo(() => {
    const allEntries = getEntries();
    const data: BarDatum[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ents = allEntries.filter((e) => e.date === ds);
      const res = computeDay(ents, settings);
      data.push({
        label: d.getDate().toString(),
        value: res.workedMinutes,
        baseline: res.expectedMinutes,
        cap: settings.maxDailyMinutes,
        status: res.status,
      });
    }
    return data;
  }, [refresh, settings]);

  // Totais do mês
  const totals = useMemo(() => {
    const entries = getEntries().filter((e) => e.date.startsWith(month));
    const byDate = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return [...byDate.entries()].reduce(
      (acc, [_, ents]) => {
        const d = computeDay(ents, settings);
        return {
          trackedDays: acc.trackedDays + 1,
          workedTotal: acc.workedTotal + d.workedMinutes,
          registrableTotal: acc.registrableTotal + d.registrableMinutes,
          balanceTotal: acc.balanceTotal + d.balanceMinutes,
          excessTotal: acc.excessTotal + d.excessMinutes,
        };
      },
      { trackedDays: 0, workedTotal: 0, registrableTotal: 0, balanceTotal: 0, excessTotal: 0 },
    );
  }, [month, refresh, settings]);

  // Dias recentes com entradas
  const recentDays = useMemo(() => {
    const allEntries = getEntries();
    const days: ReturnType<typeof computeDay>[] = [];
    for (let i = 0; i <= 13; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ents = allEntries.filter((e) => e.date === ds);
      if (ents.length > 0) days.push(computeDay(ents, settings));
    }
    return days.reverse();
  }, [refresh, settings]);

  const completeComp = (id: string) => {
    const { updateCompensation } = require("@/lib/storage");
    updateCompensation(id, { status: "concluida" });
    toast.show("Compensação concluída. Bom descanso!");
    refreshAll();
  };

  const createComp = (data: { sourceDate: string; targetDate: string; minutes: number; note: string }) => {
    addCompensation(data);
    toast.show("Compensação criada!");
    setCompOpen(false);
    refreshAll();
  };

  const todayStatusTone = today.status === "excess" ? "rose" : today.status === "deficit" ? "amber" : today.status === "in-progress" ? "indigo" : "slate";
  const balanceTone = totals.balanceTotal > 0 ? "emerald" : totals.balanceTotal < 0 ? "rose" : "slate";
  const excessTone = totals.excessTotal > 0 ? "amber" : "slate";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            Olá! Aqui está seu resumo 👋
          </h2>
          <p className="text-sm text-slate-500">
            {today.entries.length === 0
              ? "Você ainda não bateu o ponto hoje. Registre sua entrada abaixo."
              : today.open
                ? "Seu ponto de hoje está em andamento."
                : "Seu ponto de hoje está fechado."}
          </p>
        </div>
        <Link href="/registros">
          <Button variant="secondary">
            <CalendarClock size={15} /> Ver registros
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Hoje"
          value={formatMinutes(today.workedMinutes)}
          sub={
            <>
              base {formatMinutes(today.expectedMinutes)} ·{" "}
              <span className={today.balanceMinutes >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {today.balanceMinutes >= 0 ? "+" : ""}{formatMinutes(today.balanceMinutes)}
              </span>
            </>
          }
          tone={todayStatusTone}
          icon={<Timer size={16} />}
        />
        <StatCard
          label="Saldo do mês"
          value={`${totals.balanceTotal >= 0 ? "+" : ""}${formatMinutes(totals.balanceTotal)}`}
          sub={totals.balanceTotal >= 0 ? "horas a seu favor (crédito)" : "horas em débito — atenção"}
          tone={balanceTone}
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Excedente do mês"
          value={formatMinutes(totals.excessTotal)}
          sub={`acima de ${formatMinutes(settings.maxDailyMinutes)}/dia · ${totals.trackedDays} dia(s)`}
          tone={excessTone}
          icon={<TriangleAlert size={16} />}
        />
        <StatCard
          label="Compensações pendentes"
          value={pending.length}
          sub={pending.length > 0 ? `${formatMinutes(pending.reduce((s, c) => s + c.minutes, 0))} a compensar` : "tudo em dia 🎉"}
          tone={pending.length > 0 ? "indigo" : "slate"}
          icon={<ArrowLeftRight size={16} />}
        />
      </div>

      <QuickPunch today={today} todayStr={todayStr()} settings={settings} onDone={refreshAll} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Compensações pendentes"
          subtitle="Horas excedentes que precisam ser compensadas"
          actions={
            <Button size="sm" variant="subtle" onClick={() => setCompOpen(true)}>
              <PlusCircle size={13} /> Nova
            </Button>
          }
        >
          {pending.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight size={24} />}
              title="Nenhuma compensação pendente"
              description="Quando um dia passar de 10h, crie uma compensação para o dia seguinte."
            />
          ) : (
            <ul className="space-y-3">
              {pending.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">
                      Compensar {formatMinutes(c.minutes)}{" "}
                      <span className="font-medium text-slate-400">
                        (excedente de {c.sourceDate.slice(8)}/{c.sourceDate.slice(5, 7)})
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {c.targetDate === todayStr() ? <span className="font-bold text-indigo-600">Hoje · </span> : null}
                      até {c.targetDate.slice(8)}/{c.targetDate.slice(5, 7)}
                      {c.note ? ` · ${c.note}` : ""}
                    </p>
                  </div>
                  <Badge tone="indigo">pendente</Badge>
                  <Button size="sm" variant="secondary" onClick={() => completeComp(c.id)}>
                    Concluir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Últimos 14 dias" subtitle="Horas trabalhadas por dia vs. base diária">
          <BarsChart data={chartData} height={150} />
        </Card>
      </div>

      <Card title="Dias recentes" subtitle="Seus últimos dias com registro">
        {recentDays.length === 0 ? (
          <EmptyState
            icon={<Clock3 size={24} />}
            title="Nenhum registro ainda"
            description="Use o registro rápido acima ou a página de Registros para começar."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {recentDays.map((d) => (
              <Link key={d.date} href="/registros" className="flex items-center gap-3 py-3 transition-colors hover:bg-slate-50/70">
                <span className="w-24 shrink-0 text-sm font-bold text-slate-800">
                  {weekdayShort(d.date).replace(".", "")}
                  <span className="ml-1.5 font-medium text-slate-400">{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
                </span>
                <span className="hidden text-xs text-slate-400 sm:block">{d.entries.length} batida(s)</span>
                <span className="ml-auto text-sm font-extrabold tabular-nums text-slate-900">{formatMinutes(d.workedMinutes)}</span>
                <span className={`w-20 text-right text-xs font-bold tabular-nums ${d.balanceMinutes > 0 ? "text-emerald-600" : d.balanceMinutes < 0 ? "text-rose-600" : "text-slate-400"}`}>
                  {d.balanceMinutes >= 0 ? "+" : ""}{formatMinutes(d.balanceMinutes)}
                </span>
                {d.excessMinutes > 0 ? <Badge tone="rose">+10h</Badge> : <Badge tone="slate">ok</Badge>}
              </Link>
            ))}
          </div>
        )}
      </Card>

      <CompensationForm open={compOpen} onClose={() => setCompOpen(false)} onSave={(data) => { addCompensation(data); toast.show("Compensação criada!"); setCompOpen(false); refreshAll(); }} />
    </div>
  );
}
