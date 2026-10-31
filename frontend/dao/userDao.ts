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
  recovery_hash: string | null;
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

export async function getPrimaryUser(
  db: SQLite.SQLiteDatabase
) {
  return db.getFirstAsync<UserProfile>(
    `SELECT
       user_id,
       pin_hash,
       pin_salt,
       recovery_hash,
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

export async function ensurePrimaryUser(
  db: SQLite.SQLiteDatabase
) {
  const existingUser = await getPrimaryUser(db);

  if (existingUser) {
    return existingUser;
  }

  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO Users (
       pin_hash,
       pin_salt,
       recovery_hash,
       first_name,
       last_name,
       birth_date,
       auth_type,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [null, null, null, "", "", "", "local", createdAt]
  );

  const user = await getPrimaryUser(db);

  if (!user) {
    throw new Error("Unable to create demo user.");
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
 * Creates a new PBKDF2 PIN verifier and saves it.
 */
export async function updateUserPin(
  db: SQLite.SQLiteDatabase,
  userId: number,
  pin: string
): Promise<void> {
  // IMPORTANT: await the salt generator before hashing or saving it.
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
 * Valid legacy PINs are migrated to PBKDF2 after successful verification.
 */
export async function verifyUserPin(
  db: SQLite.SQLiteDatabase,
  pin: string
): Promise<boolean> {
  const user = await ensurePrimaryUser(db);

  if (!user.pin_hash || !user.pin_salt) {
    return false;
  }

  if (isLegacyBrokenHash(user.pin_hash)) {
    return false;
  }

  // New PBKDF2 PIN record.
  if (isPbkdf2Salt(user.pin_salt)) {
    const candidateHash = await hashPin(pin, user.pin_salt);
    return candidateHash === user.pin_hash;
  }

  // Legacy PIN record: verify using the previous format.
  const legacyHash = hashLegacyPin(pin, user.pin_salt);

  if (legacyHash !== user.pin_hash) {
    return false;
  }

  // Migrate only after the legacy PIN has been verified.
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
 * Indicates whether a PIN hash is present and not known to be broken.
 */
export function hasUsablePin(
  user: Pick<UserProfile, "pin_hash">
): boolean {
  return Boolean(user.pin_hash) && !isLegacyBrokenHash(user.pin_hash);
}

/**
 * Stores the hashed version of the recovery phrase for a user.
 */
export async function updateRecoveryHash(
  db: SQLite.SQLiteDatabase,
  userId: number,
  hash: string
) {
  await db.runAsync(
    'UPDATE Users SET recovery_hash = ? WHERE user_id = ?',
    [hash, userId]
  );
}

/**
 * Verifies a provided phrase against the stored hash.
 */
export async function verifyRecoveryPhrase(
  db: SQLite.SQLiteDatabase,
  userId: number,
  providedPhrase: string,
  hashFn: (s: string) => Promise<string>
) {
  const user = await ensurePrimaryUser(db);
  if (user.user_id !== userId) return false;
  if (!user.recovery_hash) return false;

  const normalized = providedPhrase.toLowerCase().trim().replace(/\\s+/g, ' ');
  const providedHash = await hashFn(normalized);

  return user.recovery_hash === providedHash;
}
