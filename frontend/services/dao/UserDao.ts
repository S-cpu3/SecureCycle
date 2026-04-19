import * as SQLite from "expo-sqlite";
import type { User, AuthType, ISODateString } from "@/types/models";

type UserFields = Partial<Pick<User, 'first_name' | 'last_name' | 'date_of_birth' | 'pin_hash' | 'auth_type'>>;

export const UserDao = {
  // Get the single device user (user_id = 1)
  get: async (db: SQLite.SQLiteDatabase): Promise<User | null> => {
    return db.getFirstAsync<User>(
      "SELECT * FROM Users WHERE user_id = 1 LIMIT 1;"
    );
  },

  // Update profile fields — uses INSERT OR IGNORE to guarantee the row exists,
  // then UPDATE to apply only the provided fields.
  upsert: async (db: SQLite.SQLiteDatabase, fields: UserFields): Promise<void> => {
    await db.runAsync(
      "INSERT OR IGNORE INTO Users (user_id, auth_type, created_at) VALUES (1, 'local', ?);",
      [new Date().toISOString()]
    );

    const sets: string[] = [];
    const values: (string | null)[] = [];

    if (fields.first_name    !== undefined) { sets.push("first_name = ?");    values.push(fields.first_name); }
    if (fields.last_name     !== undefined) { sets.push("last_name = ?");     values.push(fields.last_name); }
    if (fields.date_of_birth !== undefined) { sets.push("date_of_birth = ?"); values.push(fields.date_of_birth); }
    if (fields.pin_hash      !== undefined) { sets.push("pin_hash = ?");      values.push(fields.pin_hash); }
    if (fields.auth_type     !== undefined) { sets.push("auth_type = ?");     values.push(fields.auth_type); }

    if (sets.length === 0) return;

    values.push(String(1)); // WHERE user_id = 1
    await db.runAsync(
      `UPDATE Users SET ${sets.join(", ")} WHERE user_id = ?;`,
      values
    );
  },
};
