// ─────────────────────────────────────────────────────
// Persistência 100% no navegador via Local Storage
// ─────────────────────────────────────────────────────

const PREFIX = "meu_horario_";

export type EntryType = "entrada" | "saida";

export interface TimeEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: EntryType;
  note: string | null;
  createdAt: string; // ISO
}

export interface Compensation {
  id: string;
  sourceDate: string;
  targetDate: string;
  minutes: number;
  status: "pendente" | "concluida" | "cancelada";
  note: string | null;
  createdAt: string;
}

export interface UserSettings {
  name: string;
  email: string;
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  maxDailyMinutes: number;
  autoDeductLunch: boolean;
}

/* ── Helpers genéricos ──────────────────────────── */

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    console.warn("localStorage cheio");
  }
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Utilidades de data ─────────────────────────── */

export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysToDate(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function isWeekend(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() % 6 === 0;
}

/* ── Configurações do usuário ───────────────────── */

const DEFAULT_SETTINGS: UserSettings = {
  name: "Alex Santos",
  email: "",
  workStart: "08:00",
  workEnd: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  maxDailyMinutes: 600,
  autoDeductLunch: true,
};

export function getSettings(): UserSettings {
  return get<UserSettings>("settings", DEFAULT_SETTINGS);
}

export function saveSettings(patch: Partial<UserSettings>): UserSettings {
  const current = getSettings();
  const next = { ...current, ...patch };
  set("settings", next);
  return next;
}

/* ── Registros de ponto ─────────────────────────── */

export function getEntries(): TimeEntry[] {
  return get<TimeEntry[]>("entries", []);
}

export function saveEntries(entries: TimeEntry[]): void {
  set("entries", entries);
}

export function addEntry(entry: Omit<TimeEntry, "id" | "createdAt">): TimeEntry {
  const entries = getEntries();
  const now: TimeEntry = { ...entry, id: uid(), createdAt: new Date().toISOString() };
  entries.push(now);
  saveEntries(entries);
  return now;
}

export function updateEntry(id: string, patch: Partial<Omit<TimeEntry, "id" | "createdAt">>): TimeEntry | null {
  const entries = getEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...patch };
  saveEntries(entries);
  return entries[idx];
}

export function deleteEntry(id: string): boolean {
  const entries = getEntries();
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) return false;
  saveEntries(filtered);
  return true;
}

export function getEntriesByMonth(month: string): TimeEntry[] {
  return getEntries().filter((e) => e.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export function getEntriesByDateRange(from: string, to: string): TimeEntry[] {
  return getEntries().filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export function getEntriesByDate(date: string): TimeEntry[] {
  return getEntries().filter((e) => e.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

/* ── Compensações ───────────────────────────────── */

export function getCompensations(): Compensation[] {
  return get<Compensation[]>("compensations", []);
}

export function saveCompensations(comps: Compensation[]): void {
  set("compensations", comps);
}

export function addCompensation(comp: Omit<Compensation, "id" | "createdAt" | "status">): Compensation {
  const comps = getCompensations();
  const now: Compensation = { ...comp, id: uid(), status: "pendente", createdAt: new Date().toISOString() };
  comps.push(now);
  saveCompensations(comps);
  return now;
}

export function updateCompensation(id: string, patch: Partial<Compensation>): Compensation | null {
  const comps = getCompensations();
  const idx = comps.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  comps[idx] = { ...comps[idx], ...patch };
  saveCompensations(comps);
  return comps[idx];
}

export function deleteCompensation(id: string): boolean {
  const comps = getCompensations();
  const filtered = comps.filter((c) => c.id !== id);
  if (filtered.length === comps.length) return false;
  saveCompensations(filtered);
  return true;
}

export function getPendingCompensations(): Compensation[] {
  return getCompensations().filter((c) => c.status === "pendente").sort((a, b) => a.targetDate.localeCompare(b.targetDate));
}

/* ── Demo data (primeira execução) ──────────────── */

interface DayPattern {
  offset: number; // dias atrás (será ajustado para pular fins de semana)
  entries: Array<[time: string, type: EntryType, note: string | null]>;
}

const PATTERNS: DayPattern[] = [
  { offset: 1, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["19:45", "saida", "Fechamento de projeto"]] },
  { offset: 2, entries: [["08:02", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
  { offset: 3, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["20:30", "saida", "Dia longo"]] },
  { offset: 4, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["15:30", "saida", null]] },
  { offset: 5, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
  { offset: 6, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
  { offset: 7, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:30", "saida", null]] },
  { offset: 8, entries: [["07:45", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["16:45", "saida", null]] },
  { offset: 9, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["19:15", "saida", "Home office"]] },
  { offset: 10, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["16:45", "saida", null]] },
  { offset: 11, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
  { offset: 12, entries: [["08:10", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:20", "saida", null]] },
  { offset: 13, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
  { offset: 14, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["16:30", "saida", null]] },
  { offset: 15, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
  { offset: 16, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["18:45", "saida", null]] },
  { offset: 17, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
  { offset: 18, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
  { offset: 19, entries: [["08:00", "entrada", null], ["12:00", "saida", null], ["13:00", "entrada", null], ["17:00", "saida", null]] },
];

function weekdayOffset(n: number): string {
  let i = 0;
  let offset = 0;
  const today = todayString();
  while (i < n) {
    offset += 1;
    const d = addDaysToDate(today, -offset);
    if (!isWeekend(d)) i += 1;
  }
  return addDaysToDate(today, -offset);
}

let seeded = false;

export function seedDemoData(): void {
  if (seeded) return;
  try {
    if (localStorage.getItem(PREFIX + "seeded")) {
      seeded = true;
      return;
    }
  } catch {
    return;
  }

  const entries: TimeEntry[] = [];
  const dates: string[] = [];

  for (const p of PATTERNS) {
    const date = weekdayOffset(p.offset);
    dates.push(date);
    for (const [time, type, note] of p.entries) {
      entries.push({
        id: uid(),
        date,
        time,
        type,
        note,
        createdAt: new Date().toISOString(),
      });
    }
  }

  saveEntries(entries);

  // Compensações demo
  if (dates.length >= 4) {
    saveCompensations([
      {
        id: uid(),
        sourceDate: dates[2], // 11h30 excedente
        targetDate: dates[3], // compensado
        minutes: 90,
        status: "concluida",
        note: "Compensação do dia com 11h30 de trabalho.",
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        sourceDate: dates[8], // 10h15
        targetDate: dates[9], // 15min antes
        minutes: 15,
        status: "concluida",
        note: "Saída 15min antes do horário.",
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        sourceDate: dates[0], // 10h45
        targetDate: todayString(), // pendente para hoje
        minutes: 45,
        status: "pendente",
        note: "Planejo sair mais cedo hoje para compensar.",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  try {
    localStorage.setItem(PREFIX + "seeded", "1");
    seeded = true;
  } catch {
    // ignora
  }
}
