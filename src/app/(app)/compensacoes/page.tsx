"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  ArrowLeftRight,
  CheckCircle2,
  Pencil,
  PlusCircle,
  Trash2,
  XCircle,
} from "lucide-react";
import { fetcher, apiPost, apiPatch, apiDelete } from "@/lib/fetcher";
import { formatDateBR, formatDateShortBR, formatMinutes } from "@/lib/time";
import type { CompensationsResponse, CompWithDays } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { CompensationForm } from "@/components/compensation-form";
import { useToast } from "@/components/toast";

export default function CompensacoesPage() {
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<CompensationsResponse>("/api/compensations", fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompWithDays | null>(null);

  const save = async (payload: { sourceDate: string; targetDate: string; minutes: number; note: string; status?: string }) => {
    if (editing) {
      await apiPatch(`/api/compensations/${editing.id}`, payload);
      toast.show("Compensação atualizada.");
    } else {
      await apiPost("/api/compensations", payload);
      toast.show("Compensação criada!");
    }
    await mutate();
    setModalOpen(false);
    setEditing(null);
  };

  const setStatus = async (c: CompWithDays, status: string) => {
    const optimistic = data
      ? { compensations: data.compensations.map((x) => (x.id === c.id ? { ...x, status } : x)) }
      : undefined;
    await mutate(
      async (cur) => {
        if (!cur) return cur;
        const res = await apiPatch<{ compensation: CompWithDays }>(`/api/compensations/${c.id}`, { status });
        return { compensations: cur.compensations.map((x) => (x.id === c.id ? res.compensation : x)) };
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
    );
    toast.show(status === "concluida" ? "Compensação concluída!" : "Compensação cancelada.");
  };

  const remove = async (c: CompWithDays) => {
    if (!window.confirm("Excluir esta compensação?")) return;
    const optimistic = data
      ? { compensations: data.compensations.filter((x) => x.id !== c.id) }
      : undefined;
    await mutate(
      async (cur) => {
        if (!cur) return cur;
        await apiDelete(`/api/compensations/${c.id}`);
        return { compensations: cur.compensations.filter((x) => x.id !== c.id) };
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
    );
    toast.show("Compensação excluída.");
  };

  const pendentes = data?.compensations.filter((c) => c.status === "pendente") ?? [];
  const concluidas = data?.compensations.filter((c) => c.status === "concluida") ?? [];
  const pendingMinutes = pendentes.reduce((s, c) => s + c.minutes, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Compensações de horas</h2>
          <p className="text-sm text-slate-500">
            Excedentes acima do limite diário devem ser compensados em outros dias.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <PlusCircle size={15} /> Nova compensação
        </Button>
      </div>

      {pendentes.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
          <span className="inline-flex items-center gap-1.5">
            <ArrowLeftRight size={15} /> {pendentes.length} pendente(s)
          </span>
          <span>·</span>
          <span>{formatMinutes(pendingMinutes)} a compensar</span>
          <span>·</span>
          <span className="text-indigo-500">{concluidas.length} já concluída(s)</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : error ? (
        <EmptyState
          icon={<ArrowLeftRight size={26} />}
          title="Não foi possível carregar as compensações"
          description={error instanceof Error ? error.message : "Tente novamente."}
          action={<Button onClick={() => mutate()}>Tentar novamente</Button>}
        />
      ) : !data || data.compensations.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={26} />}
          title="Nenhuma compensação registrada"
          description="Quando um dia passar do limite de 10h, crie uma compensação para registrar as horas em outro dia."
          action={
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <PlusCircle size={15} /> Criar primeira compensação
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.compensations.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-600/10">
                  <ArrowLeftRight size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-900">
                    {formatMinutes(c.minutes)}{" "}
                    <span className="font-medium text-slate-400">
                      — {formatDateBR(c.sourceDate)} → {formatDateBR(c.targetDate)}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {c.sourceDay && (
                      <span>
                        origem: <b>{formatMinutes(c.sourceDay.workedMinutes)}</b> trabalhados
                        {c.sourceDay.excessMinutes > 0 && (
                          <span className="text-rose-500"> ({formatMinutes(c.sourceDay.excessMinutes)} excedente)</span>
                        )}
                      </span>
                    )}
                    {c.targetDay && (
                      <span>
                        destino: <b>{formatMinutes(c.targetDay.workedMinutes)}</b> trabalhados
                        {c.targetDay.balanceMinutes < 0 && (
                          <span className="text-amber-600"> ({formatMinutes(c.targetDay.balanceMinutes)} de saldo)</span>
                        )}
                      </span>
                    )}
                    {c.note && <span className="italic">“{c.note}”</span>}
                  </div>
                </div>
                {c.status === "pendente" && <Badge tone="indigo">Pendente</Badge>}
                {c.status === "concluida" && <Badge tone="emerald"><CheckCircle2 size={12} /> Concluída</Badge>}
                {c.status === "cancelada" && <Badge tone="slate">Cancelada</Badge>}
                <div className="flex items-center gap-1">
                  {c.status === "pendente" && (
                    <>
                      <Button size="sm" variant="subtle" onClick={() => setStatus(c, "concluida")}>
                        <CheckCircle2 size={13} /> Concluir
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(c, "cancelada")}>
                        <XCircle size={13} /> Cancelar
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setModalOpen(true); }} aria-label="Editar">
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)} aria-label="Excluir" className="!text-rose-500 hover:!bg-rose-50">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CompensationForm
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editingId={editing?.id ?? null}
        initial={
          editing
            ? {
                sourceDate: editing.sourceDate,
                targetDate: editing.targetDate,
                minutes: editing.minutes,
                note: editing.note ?? "",
                status: editing.status,
              }
            : undefined
        }
        onSave={save}
      />
    </div>
  );
}
