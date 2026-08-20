import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    email: varchar("email", { length: 160 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    // Jornada de trabalho padrão
    workStart: varchar("work_start", { length: 5 }).notNull().default("08:00"),
    workEnd: varchar("work_end", { length: 5 }).notNull().default("17:00"),
    lunchStart: varchar("lunch_start", { length: 5 }).notNull().default("12:00"),
    lunchEnd: varchar("lunch_end", { length: 5 }).notNull().default("13:00"),
    // Limite diário da empresa (minutos) — 10h por norma
    maxDailyMinutes: integer("max_daily_minutes").notNull().default(600),
    // Desconta o almoço automaticamente se não houver batida no intervalo
    autoDeductLunch: boolean("auto_deduct_lunch").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(), // YYYY-MM-DD
    time: varchar("time", { length: 5 }).notNull(), // HH:MM
    type: varchar("type", { length: 10 }).notNull(), // entrada | saida
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entries_user_date_idx").on(t.userId, t.date)],
);

export const compensations = pgTable(
  "compensations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Dia em que houve excedente (trabalhou além do limite)
    sourceDate: date("source_date", { mode: "string" }).notNull(),
    // Dia em que as horas serão compensadas
    targetDate: date("target_date", { mode: "string" }).notNull(),
    minutes: integer("minutes").notNull(),
    // pendente | concluida | cancelada
    status: varchar("status", { length: 12 }).notNull().default("pendente"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("comps_user_source_idx").on(t.userId, t.sourceDate),
    index("comps_user_target_idx").on(t.userId, t.targetDate),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type Compensation = typeof compensations.$inferSelect;
export type NewCompensation = typeof compensations.$inferInsert;
