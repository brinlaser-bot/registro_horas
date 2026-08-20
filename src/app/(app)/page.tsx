"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import {
  ArrowLeftRight,
  CalendarClock,
  Clock3,
  PlusCircle,
  Timer,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { fetcher, apiPost, apiDelete, apiPatch } from "@/lib/fetcher";
import {
  computeDay,
  formatDateShortBR,
  formatMinutes,
  monthKey,
  nowMinutesLocal,
  todayString,
  weekdayShort,
  type EntryType,
  type TimeEntryLike,
} from "@/lib/time";
import type {
  CompensationsResponse,
  DashboardData,
  DaySummary,
  TimeEntry,
} from "@/lib/types";
import { Badge, Button, Card, EmptyState, Skeleton, StatCard } from "@/components/ui";
import { QuickPunch } from "@/components/quick-punch";
import { BarsChart, type BarDatum } from "@/components/charts";
import { CompensationForm } from "@/components/compensation-form";
import { useToast } from "@/components/toast";

const fetcherDash = (url: string) => fetcher<DashboardData>(url);

function withDay(cur: DashboardData, today: ReturnType<typeof computeDay>): DashboardData {
  const summary: DaySummary = {
    date: today.date,
    workedMinutes: today.workedMinutes,
    expectedMinutes: today.expectedMinutes,
    balanceMinutes: today.balanceMinutes,
    excessMinutes: today.excessMinutes,
    registrableMinutes: today.registrableMinutes,
    status: today.status,
    open: today.open,
    entryCount: today.entries.length,
  };
  const exists = cur.monthDays.some((d) => d.date === today.date);
  const monthDays = exists
    ? cur.monthDays.map((d) => (d.date === today.date ? summary : d))
    : [...cur.monthDays, summary].sort((a, b) => a.date.localeCompare(b.date));
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
  return { ...cur, today, monthDays, monthTotals: totals };
}

export default function DashboardPage() {
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const month = monthKey(todayString());
  const dashKey = `/api/dashboard?month=${month}`;
  const entriesKey = `/api/entries?month=${month}`;
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(dashKey, fetcherDash);
  const [compOpen, setCompOpen] = useState(false);

  const addEntry = async (p: { date: string; time: string; type: EntryType; note: string | null }) => {
    const optimistic = data
      ? {
          ...data,
          today: computeDay(
            [...data.today.entries, { ...p, id: -Date.now() }],
            data.settings,
            nowMinutesLocal(),
          ),
        }
      : undefined;
    await mutate(
      async (cur) => {
        if (!cur) return cur;
        const res = await apiPost<{ entry: TimeEntry }>("/api/entries", p);
        const fresh = { ...res.entry, type: res.entry.type as EntryType } as TimeEntryLike;
        const today = computeDay([...cur.today.entries, fresh], cur.settings, nowMinutesLocal());
        return withDay(cur, today);
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
    );
    globalMutate(entriesKey);
  };

  const deleteEntry = async (id: number) => {
    const optimistic = data
      ? {
          ...data,
          today: computeDay(
            data.today.entries.filter((e) => e.id !== id),
            data.settings,
            nowMinutesLocal(),
          ),
        }
      : undefined;
    await mutate(
      async (cur) => {
        if (!cur) return cur;
        await apiDelete(`/api/entries/${id}`);
        const today = computeDay(cur.today.entries.filter((e) => e.id !== id), cur.settings, nowMinutesLocal());
        return withDay(cur, today);
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
    );
    globalMutate(entriesKey);
  };

  const completeComp = async (id: number) => {
    const optimistic = data ? { ...data, pending: data.pending.filter((c) => c.id !== id) } : undefined;
    await mutate(
      async (cur) => {
        if (!cur) return cur;
        await apiPatch(`/api/compensations/${id}`, { status: "concluida" });
        return { ...cur, pending: cur.pending.filter((c) => c.id !== id) };
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
    );
    globalMutate("/api/compensations");
    toast.show("Compensação concluída. Bom descanso!");
  };

  const createComp = async (payload: { sourceDate: string; targetDate: string; minutes: number; note: string }) => {
    await apiPost("/api/compensations", payload);
    globalMutate("/api/compensations");
    await mutate();
    setCompOpen(false);
    toast.show("Compensação criada!");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-56" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<TriangleAlert size={26} />}
        title="Não foi possível carregar os dados"
        description={error instanceof Error ? error.message : "Tente novamente em instantes."}
        action={<Button onClick={() => mutate()}>Tentar novamente</Button>}
      />
    );
  }

  const t = data.today;
  const totals = data.monthTotals;
  const balanceTone = totals.balanceTotal > 0 ? "emerald" : totals.balanceTotal < 0 ? "rose" : "slate";
  const excessTone = totals.excessTotal > 0 ? "amber" : "slate";
  const todayStatusTone = t.status === "excess" ? "rose" : t.status === "deficit" ? "amber" : t.status === "in-progress" ? "indigo" : "slate";

  const chartData: BarDatum[] = data.recent.map((d) => ({
    label: weekdayShort(d.date).replace(".", ""),
    value: d.workedMinutes,
    baseline: d.expectedMinutes,
    cap: data.settings.maxDailyMinutes,
    status: d.status,
  }));

  const recentDays = [...data.recent].filter((d) => d.entryCount > 0).slice(-7).reverse();

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            Olá! Aqui está seu resumo 👋
          </h2>
          <p className="text-sm text-slate-500">
            {t.empty
              ? "Você ainda não bateu o ponto hoje. Registre sua entrada abaixo."
              : t.open
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

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Hoje"
          value={formatMinutes(t.workedMinutes)}
          sub={
            <>
              base {formatMinutes(t.expectedMinutes)} ·{" "}
              <span className={t.balanceMinutes >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {t.balanceMinutes >= 0 ? "+" : ""}
                {formatMinutes(t.balanceMinutes)}
              </span>
            </>
          }
          tone={todayStatusTone}
          icon={<Timer size={16} />}
        />
        <StatCard
          label="Saldo do mês"
          value={`${totals.balanceTotal >= 0 ? "+" : ""}${formatMinutes(totals.balanceTotal)}`}
          sub={
            totals.balanceTotal >= 0
              ? "horas a seu favor (crédito)"
              : "horas em débito — atenção"
          }
          tone={balanceTone}
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Excedente do mês"
          value={formatMinutes(totals.excessTotal)}
          sub={`acima de ${formatMinutes(data.settings.maxDailyMinutes)}/dia · ${totals.trackedDays} dia(s) registrados`}
          tone={excessTone}
          icon={<TriangleAlert size={16} />}
        />
        <StatCard
          label="Compensações pendentes"
          value={data.pending.length}
          sub={
            data.pending.length > 0
              ? `${formatMinutes(data.pending.reduce((s, c) => s + c.minutes, 0))} a compensar`
              : "tudo em dia 🎉"
          }
          tone={data.pending.length > 0 ? "indigo" : "slate"}
          icon={<ArrowLeftRight size={16} />}
        />
      </div>

      {/* Registro rápido */}
      <QuickPunch
        today={t}
        todayStr={data.todayStr}
        settings={data.settings}
        onAddEntry={addEntry}
        onDeleteEntry={deleteEntry}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Compensações pendentes */}
        <Card
          title="Compensações pendentes"
          subtitle="Horas excedentes que precisam ser compensadas"
          actions={
            <Button size="sm" variant="subtle" onClick={() => setCompOpen(true)}>
              <PlusCircle size={13} /> Nova
            </Button>
          }
        >
          {data.pending.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight size={24} />}
              title="Nenhuma compensação pendente"
              description="Quando um dia passar de 10h, crie uma compensação para o dia seguinte."
            />
          ) : (
            <ul className="space-y-3">
              {data.pending.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">
                      Compensar {formatMinutes(c.minutes)}{" "}
                      <span className="font-medium text-slate-400">
                        (excedente de {formatDateShortBR(c.sourceDate)})
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {c.targetDate === data.todayStr ? (
                        <span className="font-bold text-indigo-600">Hoje · </span>
                      ) : null}
                      até {formatDateShortBR(c.targetDate)}
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

        {/* Últimos 14 dias */}
        <Card
          title="Últimos 14 dias"
          subtitle="Horas trabalhadas por dia vs. base diária"
        >
          <BarsChart data={chartData} height={150} />
        </Card>
      </div>

      {/* Dias recentes */}
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
              <Link
                key={d.date}
                href="/registros"
                className="flex items-center gap-3 py-3 transition-colors hover:bg-slate-50/70"
              >
                <span className="w-24 shrink-0 text-sm font-bold text-slate-800">
                  {weekdayShort(d.date).replace(".", "")}
                  <span className="ml-1.5 font-medium text-slate-400">{formatDateShortBR(d.date)}</span>
                </span>
                <span className="hidden text-xs text-slate-400 sm:block">{d.entryCount} batida(s)</span>
                <span className="ml-auto text-sm font-extrabold tabular-nums text-slate-900">
                  {formatMinutes(d.workedMinutes)}
                </span>
                <span
                  className={`w-20 text-right text-xs font-bold tabular-nums ${
                    d.balanceMinutes > 0
                      ? "text-emerald-600"
                      : d.balanceMinutes < 0
                        ? "text-rose-600"
                        : "text-slate-400"
                  }`}
                >
                  {d.balanceMinutes >= 0 ? "+" : ""}
                  {formatMinutes(d.balanceMinutes)}
                </span>
                {d.excessMinutes > 0 ? <Badge tone="rose">+10h</Badge> : <Badge tone="slate">ok</Badge>}
              </Link>
            ))}
          </div>
        )}
      </Card>

      <CompensationForm
        open={compOpen}
        onClose={() => setCompOpen(false)}
        onSave={createComp}
      />
    </div>
  );
}
