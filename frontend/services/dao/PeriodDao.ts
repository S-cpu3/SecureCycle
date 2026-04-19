import * as SQLite from "expo-sqlite";
import type { Period, ISODateString } from "@/types/models";

export const PeriodDao = {
  // Get all periods for a specific cycle
  getForCycle: async (db: SQLite.SQLiteDatabase, cycleId: number): Promise<Period[]> => {
    return db.getAllAsync<Period>(
      "SELECT * FROM Periods WHERE cycle_id = ? ORDER BY start_date ASC;",
      [cycleId]
    );
  },

  // Get all periods for the user, newest first
  getAll: async (db: SQLite.SQLiteDatabase): Promise<Period[]> => {
    return db.getAllAsync<Period>(
      "SELECT * FROM Periods WHERE user_id = 1 ORDER BY start_date DESC;"
    );
  },

  // Log a new period and return its period_id
  log: async (
    db: SQLite.SQLiteDatabase,
    cycleId: number,
    startDate: ISODateString,
    endDate: ISODateString
  ): Promise<number> => {
    const start = new Date(startDate + 'T00:00:00');
    const end   = new Date(endDate   + 'T00:00:00');
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

    const result = await db.runAsync(
      "INSERT INTO Periods (cycle_id, user_id, start_date, end_date, total_days) VALUES (?, 1, ?, ?, ?);",
      [cycleId, startDate, endDate, totalDays]
    );
    return result.lastInsertRowId;
  },

  // Extend or shorten a period's end date
  updateEnd: async (db: SQLite.SQLiteDatabase, periodId: number, endDate: ISODateString): Promise<void> => {
    // Recalculate total_days from the stored start_date
    const period = await db.getFirstAsync<{ start_date: ISODateString }>(
      "SELECT start_date FROM Periods WHERE period_id = ?;",
      [periodId]
    );
    if (!period) return;

    const start = new Date(period.start_date + 'T00:00:00');
    const end   = new Date(endDate           + 'T00:00:00');
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

    await db.runAsync(
      "UPDATE Periods SET end_date = ?, total_days = ? WHERE period_id = ?;",
      [endDate, totalDays, periodId]
    );
  },
};
