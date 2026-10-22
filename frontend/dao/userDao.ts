import * as SQLite from "expo-sqlite";
import {
  createPinSalt,
  hashPin,
  hashLegacyPin,
  isLegacyBrokenHash,
  isPbkdf2Salt,
} from "@/utils/hash";

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
    `SELECT
       user_id,
       pin_hash,
       pin_salt,
       first_name,
       last_name,
       birth_date,
       auth_type,
       created_at
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
    `INSERT INTO Users (
       pin_hash,
       pin_salt,
       first_name,
       last_name,
       birth_date,
       auth_type,
       created_at
     )
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
    [
      input.firstName.trim(),
      input.lastName.trim(),
      input.birthDate.trim(),
      userId,
    ]
  );

  return getPrimaryUser(db);
}

/**
 * Creates and stores a new PBKDF2 PIN verifier.
 */
export async function updateUserPin(
  db: SQLite.SQLiteDatabase,
  userId: number,
  pin: string
) {
  // IMPORTANT: await the asynchronous salt generator.
  const pinSalt = await createPinSalt();
  const pinHash = await hashPin(pin, pinSalt);

  await db.runAsync(
    `UPDATE Users
     SET pin_hash = ?, pin_salt = ?
     WHERE user_id = ?`,
    [pinHash, pinSalt, userId]
  );
}

/**
 * Verifies the user's PIN.
 *
 * Existing valid legacy PINs are upgraded to PBKDF2 after
 * successful verification. Invalid PINs are never migrated.
 */
export async function verifyUserPin(
  db: SQLite.SQLiteDatabase,
  pin: string
): Promise<boolean> {
  const user = await ensurePrimaryUser(db);

  if (!user.pin_hash || !user.pin_salt) {
    return false;
  }

  // Reject records with a known-broken legacy hash.
  if (isLegacyBrokenHash(user.pin_hash)) {
    return false;
  }

  // Verify a PIN already stored using PBKDF2.
  if (isPbkdf2Salt(user.pin_salt)) {
    const candidateHash = await hashPin(pin, user.pin_salt);
    return candidateHash === user.pin_hash;
  }

  // Verify a PIN stored in the previous legacy format.
  const legacyHash = hashLegacyPin(pin, user.pin_salt);

  if (legacyHash !== user.pin_hash) {
    return false;
  }

  // Upgrade the hash only after the legacy PIN is verified.
  const newSalt = await createPinSalt();
  const newHash = await hashPin(pin, newSalt);

  await db.runAsync(
    `UPDATE Users
     SET pin_hash = ?, pin_salt = ?
     WHERE user_id = ?`,
    [newHash, newSalt, user.user_id]
  );

  return true;
}

/**
 * Used by the lock screen and profile screen to check whether
 * a PIN hash is present and not known to be broken.
 */
export function hasUsablePin(
  user: Pick<UserProfile, "pin_hash">
): boolean {
  return Boolean(user.pin_hash) && !isLegacyBrokenHash(user.pin_hash);
}
