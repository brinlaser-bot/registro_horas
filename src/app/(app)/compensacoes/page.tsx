"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowLeftRight,
  CheckCircle2,
  Pencil,
  PlusCircle,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  getCompensations,
  updateCompensation as storageUpdateComp,
  deleteCompensation as storageDeleteComp,
  addCompensation as storageAddComp,
  getEntries,
  getSettings,
} from "@/lib/storage";
import { useSyncStorage } from "@/lib/use-storage-state";
import { computeDay, formatDateBR, formatDateShortBR, formatMinutes, todayString as todayStr } from "@/lib/time";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { CompensationForm, type CompFormData } from "@/components/compensation-form";
import { useToast } from "@/components/toast";

export default function CompensacoesPage() {
  const toast = useToast();
  const sync = useSyncStorage();
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const compensations = useMemo(() => getCompensations(), [refresh]);
  const settings = useMemo(() => getSettings(), [refresh]);
  const allEntries = useMemo(() => getEntries(), [refresh]);

  const getDayInfo = (date: string) => {
    const ents = allEntries.filter((e) => e.date === date);
    return computeDay(ents, settings);
  };

  const pendentes = compensations.filter((c) => c.status === "pendente");
  const concluidas = compensations.filter((c) => c.status === "concluida");
  const pendingMinutes = pendentes.reduce((s, c) => s + c.minutes, 0);

  const save = (data: CompFormData & { status?: string }) => {
    if (editingId) {
      storageUpdateComp(editingId, {
        sourceDate: data.sourceDate,
        targetDate: data.targetDate,
        minutes: data.minutes,
        note: data.note || null,
        status: data.status as "pendente" | "concluida" | "cancelada" | undefined,
      });
      toast.show("Compensação atualizada.");
    } else {
      storageAddComp({
        sourceDate: data.sourceDate,
        targetDate: data.targetDate,
        minutes: data.minutes,
        note: data.note || null,
      });
      toast.show("Compensação criada!");
    }
    setModalOpen(false);
    setEditingId(null);
    setRefresh((r) => r + 1);
  };

  const setStatus = (id: string, status: "concluida" | "cancelada") => {
    storageUpdateComp(id, { status });
    toast.show(status === "concluida" ? "Compensação concluída!" : "Compensação cancelada.");
    setRefresh((r) => r + 1);
  };

  const remove = (id: string) => {
    if (!window.confirm("Excluir esta compensação?")) return;
    storageDeleteComp(id);
    toast.show("Compensação excluída.");
    setRefresh((r) => r + 1);
  };

  const editing = compensations.find((c) => c.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Compensações de horas</h2>
          <p className="text-sm text-slate-500">
            Excedentes acima do limite diário devem ser compensados em outros dias.
          </p>
        </div>
        <Button onClick={() => { setEditingId(null); setModalOpen(true); }}>
          <PlusCircle size={15} /> Nova compensação
        </Button>
      </div>

      {pendentes.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
          <span className="inline-flex items-center gap-1.5"><ArrowLeftRight size={15} /> {pendentes.length} pendente(s)</span>
          <span>·</span>
          <span>{formatMinutes(pendingMinutes)} a compensar</span>
          <span>·</span>
          <span className="text-indigo-500">{concluidas.length} já concluída(s)</span>
        </div>
      )}

      {compensations.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={26} />}
          title="Nenhuma compensação registrada"
          description="Quando um dia passar do limite de 10h, crie uma compensação."
          action={<Button onClick={() => { setEditingId(null); setModalOpen(true); }}><PlusCircle size={15} /> Criar primeira compensação</Button>}
        />
      ) : (
        <div className="space-y-3">
          {compensations.map((c) => {
            const sourceInfo = getDayInfo(c.sourceDate);
            const targetInfo = getDayInfo(c.targetDate);
            return (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
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
                      {!sourceInfo.empty && (
                        <span>
                          origem: <b>{formatMinutes(sourceInfo.workedMinutes)}</b> trabalhados
                          {sourceInfo.excessMinutes > 0 && <span className="text-rose-500"> ({formatMinutes(sourceInfo.excessMinutes)} excedente)</span>}
                        </span>
                      )}
                      {!targetInfo.empty && (
                        <span>
                          destino: <b>{formatMinutes(targetInfo.workedMinutes)}</b> trabalhados
                          {targetInfo.balanceMinutes < 0 && <span className="text-amber-600"> ({formatMinutes(targetInfo.balanceMinutes)} saldo)</span>}
                        </span>
                      )}
                      {c.note && <span className="italic">"{c.note}"</span>}
                    </div>
                  </div>
                  {c.status === "pendente" && <Badge tone="indigo">Pendente</Badge>}
                  {c.status === "concluida" && <Badge tone="emerald"><CheckCircle2 size={12} /> Concluída</Badge>}
                  {c.status === "cancelada" && <Badge tone="slate">Cancelada</Badge>}
                  <div className="flex items-center gap-1">
                    {c.status === "pendente" && (
                      <>
                        <Button size="sm" variant="subtle" onClick={() => setStatus(c.id, "concluida")}><CheckCircle2 size={13} /> Concluir</Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "cancelada")}><XCircle size={13} /> Cancelar</Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(c.id); setModalOpen(true); }}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)} className="!text-rose-500 hover:!bg-rose-50"><Trash2 size={14} /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CompensationForm
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null); }}
        editingId={editingId}
        initial={editing ? { sourceDate: editing.sourceDate, targetDate: editing.targetDate, minutes: editing.minutes, note: editing.note ?? "", status: editing.status } : undefined}
        onSave={save}
      />
    </div>
  );
}
