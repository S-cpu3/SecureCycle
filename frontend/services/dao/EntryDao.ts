import * as SQLite from "expo-sqlite";
import type { Entry, ISODateString } from "@/types/models";

type NewEntry = Omit<Entry, 'entry_id'>;

export const EntryDao = {
  // Get all entries for a cycle
  getForCycle: async (db: SQLite.SQLiteDatabase, cycleId: number): Promise<Entry[]> => {
    return db.getAllAsync<Entry>(
      "SELECT * FROM Entries WHERE cycle_id = ? ORDER BY date ASC;",
      [cycleId]
    );
  },

  // Upsert a daily entry — replaces any existing entry for the same user + date + type
  upsert: async (db: SQLite.SQLiteDatabase, entry: NewEntry): Promise<void> => {
    await db.runAsync(
      `INSERT INTO Entries (user_id, cycle_id, period_id, date, entry_type, intensity, notes, symptom_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, date, entry_type) DO UPDATE SET
         intensity    = excluded.intensity,
         notes        = excluded.notes,
         symptom_type = excluded.symptom_type,
         cycle_id     = excluded.cycle_id,
         period_id    = excluded.period_id;`,
      [
        entry.user_id,
        entry.cycle_id,
        entry.period_id ?? null,
        entry.date,
        entry.entry_type,
        entry.intensity ?? null,
        entry.notes ?? null,
        entry.symptom_type ?? null,
      ]
    );
  },
};
