"use client";

import { useEffect, useState } from "react";
import { Clock3, Info, Save, UserRound } from "lucide-react";
import { getSettings, saveSettings } from "@/lib/storage";
import { formatMinutes } from "@/lib/time";
import { Button, Card, Input, Select, Skeleton, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";

export default function ConfiguracoesPage() {
  const toast = useToast();
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
    const s = getSettings();
    setProfile({ name: s.name, email: s.email });
    setSchedule({
      workStart: s.workStart,
      workEnd: s.workEnd,
      lunchStart: s.lunchStart,
      lunchEnd: s.lunchEnd,
      maxDailyMinutes: s.maxDailyMinutes,
      autoDeductLunch: s.autoDeductLunch,
    });
  }, []);

  const saveProfile = () => {
    setBusyProfile(true);
    try {
      saveSettings({ name: profile.name, email: profile.email });
      toast.show("Perfil atualizado!");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Erro ao salvar.", "error");
    } finally {
      setBusyProfile(false);
    }
  };

  const saveSchedule = () => {
    setBusySchedule(true);
    try {
      saveSettings(schedule);
      toast.show("Jornada atualizada!");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Erro ao salvar.", "error");
    } finally {
      setBusySchedule(false);
    }
  };

  const expected =
    (parseInt(schedule.workEnd.split(":")[0]) * 60 + parseInt(schedule.workEnd.split(":")[1])) -
    (parseInt(schedule.workStart.split(":")[0]) * 60 + parseInt(schedule.workStart.split(":")[1])) -
    ((parseInt(schedule.lunchEnd.split(":")[0]) * 60 + parseInt(schedule.lunchEnd.split(":")[1])) -
      (parseInt(schedule.lunchStart.split(":")[0]) * 60 + parseInt(schedule.lunchStart.split(":")[1])));

  return (
    <div className="space-y-6">
      <Card
        title="Perfil"
        subtitle="Seus dados (app de uso pessoal — sem login)"
        actions={<Button size="sm" onClick={saveProfile} loading={busyProfile}><Save size={14} /> Salvar perfil</Button>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome completo" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <Input label="E-mail" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
        </div>
      </Card>

      <Card
        title="Jornada de trabalho"
        subtitle="Regras usadas no cálculo de horas e compensações"
        actions={<Button size="sm" onClick={saveSchedule} loading={busySchedule}><Save size={14} /> Salvar jornada</Button>}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Início da jornada" type="time" value={schedule.workStart} onChange={(e) => setSchedule({ ...schedule, workStart: e.target.value })} />
          <Input label="Fim da jornada" type="time" value={schedule.workEnd} onChange={(e) => setSchedule({ ...schedule, workEnd: e.target.value })} />
          <Input label="Início do almoço" type="time" value={schedule.lunchStart} onChange={(e) => setSchedule({ ...schedule, lunchStart: e.target.value })} />
          <Input label="Fim do almoço" type="time" value={schedule.lunchEnd} onChange={(e) => setSchedule({ ...schedule, lunchEnd: e.target.value })} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select label="Limite diário da empresa" value={schedule.maxDailyMinutes} onChange={(e) => setSchedule({ ...schedule, maxDailyMinutes: Number(e.target.value) })}>
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
          <Toggle checked={schedule.autoDeductLunch} onChange={(v) => setSchedule({ ...schedule, autoDeductLunch: v })} label="Descontar almoço automaticamente" description="Se não houver batida no horário do almoço, o intervalo é descontado." />
        </div>
      </Card>

      <Card title="Como o cálculo funciona" subtitle="Resumo das regras da empresa aplicadas no app">
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50/70 p-3">
            <Clock3 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <p><b className="text-emerald-700">Base diária de 8h.</b> Horas acima da base geram <b>saldo positivo</b>; abaixo, <b>saldo negativo</b>.</p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-rose-50/70 p-3">
            <Info size={16} className="mt-0.5 shrink-0 text-rose-600" />
            <p><b className="text-rose-700">Limite de 10h/dia.</b> O excedente não pode ser registrado no ponto e vira <b>compensação</b>.</p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-indigo-50/70 p-3">
            <UserRound size={16} className="mt-0.5 shrink-0 text-indigo-600" />
            <p><b className="text-indigo-700">Compensação.</b> Registre o excedente e marque como concluído quando sair mais cedo.</p>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-amber-50/70 p-3">
            <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <p><b className="text-amber-700">Almoço.</b> Bata o ponto ao sair e voltar. Se esquecer, o app desconta 1h automaticamente.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
