import * as SQLite from "expo-sqlite";
import type { Prediction, ISODateString } from "@/types/models";
import type { PredictionResult } from "@/engine/predictionEngine";
import { toISO } from "@/types/models";

export const PredictionDao = {
  // Save a full prediction result for a cycle.
  // Assumes period length of 5 days for predicted_period_end (refineable later).
  save: async (
    db: SQLite.SQLiteDatabase,
    cycleId: number,
    result: PredictionResult,
    predictedPeriodLengthDays = 5
  ): Promise<void> => {
    const periodEnd = new Date(result.predicted);
    periodEnd.setDate(periodEnd.getDate() + predictedPeriodLengthDays - 1);

    await db.runAsync(
      `INSERT INTO Predictions (
        cycle_id,
        predicted_period_start, predicted_period_end, predicted_next_cycle_start,
        earliest, latest,
        ovulation_date, fertile_start, fertile_end,
        pms_start, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        cycleId,
        toISO(result.predicted),
        toISO(periodEnd),
        toISO(result.predicted),   // next cycle starts when next period starts
        toISO(result.earliest),
        toISO(result.latest),
        result.ovulationDate ? toISO(result.ovulationDate) : null,
        result.fertileStart  ? toISO(result.fertileStart)  : null,
        result.fertileEnd    ? toISO(result.fertileEnd)    : null,
        toISO(result.pmsStart),
        result.confidenceScore,
      ]
    );
  },

  // Get the most recently computed prediction for a cycle
  getLatestForCycle: async (db: SQLite.SQLiteDatabase, cycleId: number): Promise<Prediction | null> => {
    return db.getFirstAsync<Prediction>(
      "SELECT * FROM Predictions WHERE cycle_id = ? ORDER BY created_at DESC LIMIT 1;",
      [cycleId]
    );
  },

  // Get the most recently computed prediction across all cycles
  getLatest: async (db: SQLite.SQLiteDatabase): Promise<Prediction | null> => {
    return db.getFirstAsync<Prediction>(
      `SELECT p.* FROM Predictions p
       JOIN Cycles c ON c.cycle_id = p.cycle_id
       WHERE c.user_id = 1
       ORDER BY p.created_at DESC
       LIMIT 1;`
    );
  },
};
