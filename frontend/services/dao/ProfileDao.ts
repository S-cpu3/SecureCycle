import * as SQLite from "expo-sqlite";
import type {
  HealthConditionRecord,
  HealthCondition,
  UserBirthControl,
  BirthControlMethod,
  UserIntent,
  UserIntentType,
  ISODateString,
} from "@/types/models";

export const ProfileDao = {
  // ─── Health Conditions ──────────────────────────────────────────────────────

  getHealthConditions: async (db: SQLite.SQLiteDatabase): Promise<HealthConditionRecord[]> => {
    return db.getAllAsync<HealthConditionRecord>(
      "SELECT * FROM HealthConditions WHERE user_id = 1 ORDER BY created_at ASC;"
    );
  },

  // Replaces the full set of conditions for the user atomically
  replaceHealthConditions: async (
    db: SQLite.SQLiteDatabase,
    conditions: Array<{ condition: HealthCondition; diagnosed: boolean }>
  ): Promise<void> => {
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM HealthConditions WHERE user_id = 1;");
      for (const c of conditions) {
        await db.runAsync(
          "INSERT INTO HealthConditions (user_id, condition, diagnosed) VALUES (1, ?, ?);",
          [c.condition, c.diagnosed ? 1 : 0]
        );
      }
    });
  },

  // ─── Birth Control ───────────────────────────────────────────────────────────

  // Returns the current active method (end_date IS NULL), or null if none set
  getActiveBirthControl: async (db: SQLite.SQLiteDatabase): Promise<UserBirthControl | null> => {
    return db.getFirstAsync<UserBirthControl>(
      "SELECT * FROM UserBirthControl WHERE user_id = 1 AND end_date IS NULL ORDER BY created_at DESC LIMIT 1;"
    );
  },

  // Closes any active record and opens a new one
  setActiveBirthControl: async (
    db: SQLite.SQLiteDatabase,
    method: BirthControlMethod,
    startDate?: ISODateString
  ): Promise<void> => {
    const now = new Date().toISOString().split('T')[0];
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        "UPDATE UserBirthControl SET end_date = ? WHERE user_id = 1 AND end_date IS NULL;",
        [now]
      );
      await db.runAsync(
        "INSERT INTO UserBirthControl (user_id, method, start_date) VALUES (1, ?, ?);",
        [method, startDate ?? now]
      );
    });
  },

  // ─── Intent ──────────────────────────────────────────────────────────────────

  getLatestIntent: async (db: SQLite.SQLiteDatabase): Promise<UserIntent | null> => {
    return db.getFirstAsync<UserIntent>(
      "SELECT * FROM UserIntent WHERE user_id = 1 ORDER BY set_at DESC LIMIT 1;"
    );
  },

  setIntent: async (db: SQLite.SQLiteDatabase, intention: UserIntentType): Promise<void> => {
    await db.runAsync(
      "INSERT INTO UserIntent (user_id, intention) VALUES (1, ?);",
      [intention]
    );
  },
};
