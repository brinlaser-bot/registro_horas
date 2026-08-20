// Tipos compartilhados entre servidor e cliente (apenas tipos — seguro p/ bundle)
import type { Compensation, TimeEntry, User } from "@/db/schema";
import type { DayResult, DayStatus, WorkSettings } from "@/lib/time";

export type { DayResult, DayStatus, WorkSettings };
export type { TimeEntry, User };

export type PublicUser = Omit<User, "passwordHash">;

export interface DaySummary {
  date: string;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  excessMinutes: number;
  registrableMinutes: number;
  status: DayStatus;
  open: boolean;
  entryCount: number;
}

export interface CompWithDays extends Compensation {
  sourceDay: { workedMinutes: number; excessMinutes: number } | null;
  targetDay: { workedMinutes: number; balanceMinutes: number } | null;
}

export interface DashboardData {
  month: string;
  today: DayResult;
  todayStr: string;
  monthDays: DaySummary[];
  monthTotals: {
    trackedDays: number;
    workedTotal: number;
    registrableTotal: number;
    balanceTotal: number;
    excessTotal: number;
  };
  recent: DaySummary[];
  pending: CompWithDays[];
  settings: WorkSettings;
}

export interface EntriesResponse {
  entries: TimeEntry[];
}

export interface CompensationsResponse {
  compensations: CompWithDays[];
}
