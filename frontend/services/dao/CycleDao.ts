import * as SQLite from "expo-sqlite";
import type { Cycle, ISODateString } from "@/types/models";

interface CycleStats {
  cyclesLogged: number;
  avgCycleLength: number | null;
  stdDev: number | null;
  lastPeriodStart: ISODateString | null;
}

interface LengthRow {
  length_days: number;
}

interface PeriodStartRow {
  start_date: ISODateString;
}

export const CycleDao = {
  // Get the most recently started cycle
  getLatest: async (db: SQLite.SQLiteDatabase): Promise<Cycle | null> => {
    return db.getFirstAsync<Cycle>(
      "SELECT * FROM Cycles WHERE user_id = 1 ORDER BY start_date DESC LIMIT 1;"
    );
  },

  // Get all cycles for the user, newest first
  getAll: async (db: SQLite.SQLiteDatabase): Promise<Cycle[]> => {
    return db.getAllAsync<Cycle>(
      "SELECT * FROM Cycles WHERE user_id = 1 ORDER BY start_date DESC;"
    );
  },

  // Start a new cycle and return its cycle_id
  start: async (db: SQLite.SQLiteDatabase, startDate: ISODateString): Promise<number> => {
    const result = await db.runAsync(
      "INSERT INTO Cycles (user_id, start_date, created_at) VALUES (1, ?, ?);",
      [startDate, new Date().toISOString()]
    );
    return result.lastInsertRowId;
  },

  // Close a cycle by setting its end_date
  end: async (db: SQLite.SQLiteDatabase, cycleId: number, endDate: ISODateString): Promise<void> => {
    await db.runAsync(
      "UPDATE Cycles SET end_date = ? WHERE cycle_id = ?;",
      [endDate, cycleId]
    );
  },

  // Compute personal stats needed by the prediction engine.
  // SQLite has no STDDEV, so cycle lengths are fetched and computed in JS.
  // Caps at the last 12 cycles for recency weighting.
  computeStats: async (db: SQLite.SQLiteDatabase): Promise<CycleStats> => {
    const lengths = await db.getAllAsync<LengthRow>(`
      SELECT CAST(julianday(end_date) - julianday(start_date) AS INTEGER) AS length_days
      FROM Cycles
      WHERE user_id = 1 AND end_date IS NOT NULL
      ORDER BY start_date DESC
      LIMIT 12;
    `);

    const lastPeriodRow = await db.getFirstAsync<PeriodStartRow>(`
      SELECT start_date FROM Periods
      WHERE user_id = 1
      ORDER BY start_date DESC
      LIMIT 1;
    `);

    const cyclesLogged = lengths.length;
    if (cyclesLogged === 0) {
      return { cyclesLogged: 0, avgCycleLength: null, stdDev: null, lastPeriodStart: lastPeriodRow?.start_date ?? null };
    }

    const days = lengths.map(r => r.length_days);
    const avg = days.reduce((sum, d) => sum + d, 0) / days.length;

    let stdDev: number | null = null;
    if (days.length > 1) {
      const variance = days.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / (days.length - 1);
      stdDev = Math.sqrt(variance);
    }

    return {
      cyclesLogged,
      avgCycleLength: avg,
      stdDev,
      lastPeriodStart: lastPeriodRow?.start_date ?? null,
    };
  },
};
