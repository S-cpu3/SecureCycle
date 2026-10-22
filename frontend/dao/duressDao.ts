import * as SQLite from "expo-sqlite";
import {
  createPinSalt,
  hashPin,
  hashLegacyPin,
  isLegacyBrokenHash,
  isPbkdf2Salt,
} from "@/utils/hash";

export type DuressAction = "decoy" | "wipe";

export type DuressConfig = {
  isSet: boolean;
  action: DuressAction | null;
};

type DuressRow = {
  duress_pin_hash: string | null;
  duress_pin_salt: string | null;
  duress_action: string | null;
};

const DURESS_COLUMNS: [string, string][] = [
  ["duress_pin_hash", "TEXT"],
  ["duress_pin_salt", "TEXT"],
  ["duress_action", "TEXT"],
  ["wipe_after_attempts", "INTEGER"],
  // Inactivity auto-erase (see dao/autoEraseDao.ts)
  ["auto_erase_days", "REAL"],
  ["last_unlocked_at", "TEXT"],
  ["auto_erased_at", "TEXT"],
];

// Adds the duress columns to SecuritySettings if they are missing.
export async function ensureDuressColumns(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(SecuritySettings);`
  );

  for (const [name, definition] of DURESS_COLUMNS) {
    if (!columns.some((column) => column.name === name)) {
      await db.execAsync(
        `ALTER TABLE SecuritySettings ADD COLUMN ${name} ${definition};`
      );
    }
  }
}

async function getRow(db: SQLite.SQLiteDatabase, userId: number) {
  return db.getFirstAsync<DuressRow>(
    `SELECT duress_pin_hash, duress_pin_salt, duress_action
     FROM SecuritySettings
     WHERE user_id = ?`,
    [userId]
  );
}

function asAction(value: string | null | undefined): DuressAction | null {
  return value === "decoy" || value === "wipe" ? value : null;
}

export async function getDuressConfig(
  db: SQLite.SQLiteDatabase,
  userId: number
): Promise<DuressConfig> {
  const row = await getRow(db, userId);
  const action = asAction(row?.duress_action);

  return {
    isSet: Boolean(row?.duress_pin_hash && action),
    action,
  };
}

export async function setDuressPin(
  db: SQLite.SQLiteDatabase,
  userId: number,
  pin: string,
  action: DuressAction
) {
  const salt = createPinSalt();
  const pinHash = await hashPin(pin, salt);

  await db.runAsync(
    `UPDATE SecuritySettings
     SET duress_pin_hash = ?, duress_pin_salt = ?, duress_action = ?
     WHERE user_id = ?`,
    [pinHash, salt, action, userId]
  );
}

export async function clearDuressPin(
  db: SQLite.SQLiteDatabase,
  userId: number
) {
  await db.runAsync(
    `UPDATE SecuritySettings
     SET duress_pin_hash = NULL, duress_pin_salt = NULL, duress_action = NULL
     WHERE user_id = ?`,
    [userId]
  );
}

export async function checkDuressPin(
  db: SQLite.SQLiteDatabase,
  userId: number,
  pin: string
): Promise<DuressAction | null> {
  const row = await getRow(db, userId);

  if (!row?.duress_pin_hash || !row.duress_pin_salt) {
    return null;
  }

  const action = asAction(row.duress_action);

  if (!action || isLegacyBrokenHash(row.duress_pin_hash)) {
    return null;
  }

  // Verify a PIN stored using the new PBKDF2 format.
  if (isPbkdf2Salt(row.duress_pin_salt)) {
    const candidateHash = await hashPin(pin, row.duress_pin_salt);

    return candidateHash === row.duress_pin_hash ? action : null;
  }

  // Check a PIN stored using the previous legacy hashing implementation.
  const legacyHash = hashLegacyPin(pin, row.duress_pin_salt);

  if (legacyHash !== row.duress_pin_hash) {
    return null;
  }

  // Upgrade the legacy PIN only after successful verification.
  const newSalt = createPinSalt();
  const newHash = await hashPin(pin, newSalt);

  await db.runAsync(
    `UPDATE SecuritySettings
     SET duress_pin_hash = ?, duress_pin_salt = ?
     WHERE user_id = ?`,
    [newHash, newSalt, userId]
  );

  return action;
}

/**
 * Irreversibly removes the user's cycle/wellness data and profile details.
 * The real PIN, duress PIN, and settings are kept so the app still looks
 * locked and normal.
 */
export async function wipeUserData(db: SQLite.SQLiteDatabase) {
  await db.execAsync("PRAGMA secure_delete = ON;");
  await db.execAsync(
    "DELETE FROM Entries; DELETE FROM Cycles; DELETE FROM WellnessCheckIns;"
  );
  await db.execAsync(
    `UPDATE Users SET first_name = '', last_name = '', birth_date = '';`
  );
  await db.execAsync(
    `UPDATE SecuritySettings
     SET qr_share_token = NULL, qr_last_generated_at = NULL;`
  );

  try {
    await db.execAsync("VACUUM;");
  } catch (error) {
    console.error(
      "VACUUM after wipe failed; rows were deleted but pages were not compacted",
      error
    );
  }

  // In WAL mode, old rows may remain in the -wal file.
  try {
    await db.execAsync("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch (error) {
    console.error("WAL checkpoint after wipe failed", error);
  }
}

export const WIPE_THRESHOLD_CHOICES = [10, 15, 20] as const;

export async function getWipeThreshold(
  db: SQLite.SQLiteDatabase,
  userId: number
): Promise<number | null> {
  const row = await db.getFirstAsync<{
    wipe_after_attempts: number | null;
  }>(
    `SELECT wipe_after_attempts
     FROM SecuritySettings
     WHERE user_id = ?`,
    [userId]
  );

  const value = row?.wipe_after_attempts;

  return typeof value === "number" && value > 0 ? value : null;
}

export async function setWipeThreshold(
  db: SQLite.SQLiteDatabase,
  userId: number,
  threshold: number | null
) {
  await db.runAsync(
    `UPDATE SecuritySettings
     SET wipe_after_attempts = ?
     WHERE user_id = ?`,
    [threshold, userId]
  );
}

/** Wrong attempts left before erase triggers, or null when the feature is off. */
export function attemptsUntilWipe(
  failedAttempts: number,
  threshold: number | null
): number | null {
  return threshold === null ? null : Math.max(0, threshold - failedAttempts);
}

/** True if there is anything left to erase. */
export async function hasUserData(
  db: SQLite.SQLiteDatabase
): Promise<boolean> {
  const counts = await db.getFirstAsync<{
    entries: number;
    cycles: number;
    wellness: number;
    profile: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM Entries) AS entries,
       (SELECT COUNT(*) FROM Cycles) AS cycles,
       (SELECT COUNT(*) FROM WellnessCheckIns) AS wellness,
       (SELECT COUNT(*) FROM Users
          WHERE COALESCE(first_name, '') <> ''
             OR COALESCE(last_name, '') <> ''
             OR COALESCE(birth_date, '') <> '') AS profile`
  );

  return Boolean(
    counts &&
      (counts.entries > 0 ||
        counts.cycles > 0 ||
        counts.wellness > 0 ||
        counts.profile > 0)
  );
}
