import * as SQLite from "expo-sqlite";
import { createPinSalt, hashPin } from "@/utils/hash";

export type UserProfile = {
  user_id: number;
  pin_hash: string | null;
  pin_salt: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  auth_type: string;
  created_at: string;
};

type ProfileInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
};

export async function getPrimaryUser(db: SQLite.SQLiteDatabase) {
  return db.getFirstAsync<UserProfile>(
    `SELECT user_id, pin_hash, pin_salt, first_name, last_name, birth_date, auth_type, created_at
     FROM Users
     ORDER BY user_id ASC
     LIMIT 1`
  );
}

export async function ensurePrimaryUser(db: SQLite.SQLiteDatabase) {
  const existingUser = await getPrimaryUser(db);

  if (existingUser) {
    return existingUser;
  }

  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO Users (pin_hash, pin_salt, first_name, last_name, birth_date, auth_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [null, null, "", "", "", "local", createdAt]
  );

  const user = await getPrimaryUser(db);

  if (!user) {
    throw new Error("Unable to create demo user");
  }

  return user;
}

export async function updateUserProfile(
  db: SQLite.SQLiteDatabase,
  userId: number,
  input: ProfileInput
) {
  await db.runAsync(
    `UPDATE Users
     SET first_name = ?, last_name = ?, birth_date = ?
     WHERE user_id = ?`,
    [input.firstName.trim(), input.lastName.trim(), input.birthDate.trim(), userId]
  );

  return getPrimaryUser(db);
}

export async function updateUserPin(db: SQLite.SQLiteDatabase, userId: number, pin: string) {
  const pinSalt = createPinSalt();
  const pinHash = hashPin(pin, pinSalt);

  await db.runAsync(
    `UPDATE Users
     SET pin_hash = ?, pin_salt = ?
     WHERE user_id = ?`,
    [pinHash, pinSalt, userId]
  );
}

export async function verifyUserPin(db: SQLite.SQLiteDatabase, pin: string) {
  const user = await ensurePrimaryUser(db);

  if (!user.pin_hash || !user.pin_salt) {
    return false;
  }

  return user.pin_hash === hashPin(pin, user.pin_salt);
}
