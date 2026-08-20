"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Clock3, Info, Save, UserRound } from "lucide-react";
import { fetcher, apiPatch } from "@/lib/fetcher";
import { formatMinutes } from "@/lib/time";
import type { PublicUser } from "@/lib/types";
import { Button, Card, Input, Select, Skeleton, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";

export default function ConfiguracoesPage() {
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<{ user: PublicUser }>("/api/me", fetcher);

  const [profile, setProfile] = useState({ name: "", email: "" });
  const [schedule, setSchedule] = useState({
    workStart: "08:00",
    workEnd: "17:00",
    lunchStart: "12:00",
    lunchEnd: "13:00",
    maxDailyMinutes: 600,
    autoDeductLunch: true,
  });
  const [busyProfile, setBusyProfile] = useState(false);
  const [busySchedule, setBusySchedule] = useState(false);

  useEffect(() => {
    if (data?.user) {
      const u = data.user;
      setProfile({ name: u.name, email: u.email });
      setSchedule({
        workStart: u.workStart,
        workEnd: u.workEnd,
        lunchStart: u.lunchStart,
        lunchEnd: u.lunchEnd,
        maxDailyMinutes: u.maxDailyMinutes,
        autoDeductLunch: u.autoDeductLunch,
      });
    }
  }, [data]);

  const saveProfile = async () => {
    setBusyProfile(true);
    try {
      await apiPatch("/api/me", { name: profile.name, email: profile.email });
      await mutate();
      toast.show("Perfil atualizado!");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Erro ao salvar perfil.", "error");
    } finally {
      setBusyProfile(false);
    }
  };

  const saveSchedule = async () => {
    setBusySchedule(true);
    try {
      await apiPatch("/api/me", schedule);
      await mutate();
      toast.show("Jornada atualizada!");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Erro ao salvar jornada.", "error");
    } finally {
      setBusySchedule(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
        Não foi possível carregar as configurações.
      </div>
    );
  }

  const expected =
    (parseInt(schedule.workEnd.split(":")[0]) * 60 + parseInt(schedule.workEnd.split(":")[1])) -
    (parseInt(schedule.workStart.split(":")[0]) * 60 + parseInt(schedule.workStart.split(":")[1])) -
    ((parseInt(schedule.lunchEnd.split(":")[0]) * 60 + parseInt(schedule.lunchEnd.split(":")[1])) -
      (parseInt(schedule.lunchStart.split(":")[0]) * 60 + parseInt(schedule.lunchStart.split(":")[1])));

  return (
    <div className="space-y-6">
      {/* Perfil */}
      <Card
        title="Perfil"
        subtitle="Seus dados (app de uso pessoal — sem login)"
        actions={
          <Button size="sm" onClick={saveProfile} loading={busyProfile}>
            <Save size={14} /> Salvar perfil
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome completo" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <Input label="E-mail" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
        </div>
      </Card>

      {/* Jornada */}
      <Card
        title="Jornada de trabalho"
        subtitle="Regras usadas no cálculo de horas e compensações"
        actions={
          <Button size="sm" onClick={saveSchedule} loading={busySchedule}>
            <Save size={14} /> Salvar jornada
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Início da jornada" type="time" value={schedule.workStart} onChange={(e) => setSchedule({ ...schedule, workStart: e.target.value })} />
          <Input label="Fim da jornada" type="time" value={schedule.workEnd} onChange={(e) => setSchedule({ ...schedule, workEnd: e.target.value })} />
          <Input label="Início do almoço" type="time" value={schedule.lunchStart} onChange={(e) => setSchedule({ ...schedule, lunchStart: e.target.value })} />
          <Input label="Fim do almoço" type="time" value={schedule.lunchEnd} onChange={(e) => setSchedule({ ...schedule, lunchEnd: e.target.value })} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select
            label="Limite diário da empresa (máx. registrável no ponto)"
            value={schedule.maxDailyMinutes}
            onChange={(e) => setSchedule({ ...schedule, maxDailyMinutes: Number(e.target.value) })}
          >
            <option value={480}>8h</option>
            <option value={540}>9h</option>
            <option value={600}>10h (padrão)</option>
            <option value={660}>11h</option>
            <option value={720}>12h</option>
          </Select>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Base diária calculada</p>
            <p className="mt-0.5 text-lg font-extrabold text-slate-900">
              {formatMinutes(Math.max(0, expected))}
              <span className="ml-2 text-xs font-semibold text-slate-400">
                por dia ({schedule.workStart}–{schedule.workEnd} com almoço de{" "}
                {formatMinutes(
                  (parseInt(schedule.lunchEnd.split(":")[0]) * 60 + parseInt(schedule.lunchEnd.split(":")[1])) -
                    (parseInt(schedule.lunchStart.split(":")[0]) * 60 + parseInt(schedule.lunchStart.split(":")[1])),
                )})
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3">
          <Toggle
            checked={schedule.autoDeductLunch}
            onChange={(v) => setSchedule({ ...schedule, autoDeductLunch: v })}
            label="Descontar almoço automaticamente"
            description="Se não houver batida entre o início e o fim do almoço, o intervalo é descontado das horas do dia."
          />
        </div>
      </Card>

      {/* Regras */}
      <Card title="Como o cálculo funciona" subtitle="Resumo das regras da empresa aplicadas no app">
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50/70 p-3">
            <Clock3 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <p>
              <b className="text-emerald-700">Base diária de 8h.</b> Horas trabalhadas acima da base
              geram <b>saldo positivo</b> (crédito); abaixo, <b>saldo negativo</b> (débito).
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-rose-50/70 p-3">
            <Info size={16} className="mt-0.5 shrink-0 text-rose-600" />
            <p>
              <b className="text-rose-700">Limite de 10h/dia.</b> O que ultrapassar o limite não pode
              ser registrado no ponto e vira <b>excedente</b> para compensar em outro dia.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-indigo-50/70 p-3">
            <UserRound size={16} className="mt-0.5 shrink-0 text-indigo-600" />
            <p>
              <b className="text-indigo-700">Compensação.</b> Registre o excedente em um dia mais
              leve (saindo mais cedo ou entrando mais tarde) e marque a compensação como concluída.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-amber-50/70 p-3">
            <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <p>
              <b className="text-amber-700">Almoço.</b> Bata o ponto ao sair (12:00) e voltar (13:00).
              Se esquecer, o app desconta 1h automaticamente (se ativado).
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
