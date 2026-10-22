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
  ["auto_erase_days", "REAL"],
  ["last_unlocked_at", "TEXT"],
  ["auto_erased_at", "TEXT"],
];

/**
 * Adds missing duress-related columns to older databases.
 */
export async function ensureDuressColumns(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(SecuritySettings);"
  );

  for (const [name, definition] of DURESS_COLUMNS) {
    if (!columns.some((column) => column.name === name)) {
      await db.execAsync(
        `ALTER TABLE SecuritySettings ADD COLUMN ${name} ${definition};`
      );
    }
  }
}

async function getRow(
  db: SQLite.SQLiteDatabase,
  userId: number
) {
  return db.getFirstAsync<DuressRow>(
    `SELECT duress_pin_hash, duress_pin_salt, duress_action
     FROM SecuritySettings
     WHERE user_id = ?`,
    [userId]
  );
}

function asAction(
  value: string | null | undefined
): DuressAction | null {
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

/**
 * Creates and stores a new duress PIN verifier.
 */
export async function setDuressPin(
  db: SQLite.SQLiteDatabase,
  userId: number,
  pin: string,
  action: DuressAction
): Promise<void> {
  // IMPORTANT: await the salt generator before hashing or saving it.
  const salt = await createPinSalt();
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
): Promise<void> {
  await db.runAsync(
    `UPDATE SecuritySettings
     SET duress_pin_hash = NULL,
         duress_pin_salt = NULL,
         duress_action = NULL
     WHERE user_id = ?`,
    [userId]
  );
}

/**
 * Returns the configured action when the duress PIN is valid.
 * Valid legacy PINs are upgraded to PBKDF2.
 */
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

  // Verify a PIN stored in the PBKDF2 format.
  if (isPbkdf2Salt(row.duress_pin_salt)) {
    const candidateHash = await hashPin(pin, row.duress_pin_salt);

    return candidateHash === row.duress_pin_hash ? action : null;
  }

  // Verify a PIN stored using the legacy format.
  const legacyHash = hashLegacyPin(pin, row.duress_pin_salt);

  if (legacyHash !== row.duress_pin_hash) {
    return null;
  }

  // Migrate only after the legacy PIN has been verified.
  const newSalt = await createPinSalt();
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
 * Deletes cycle and wellness records and clears profile details.
 *
 * This attempts to reduce residual database data; it cannot guarantee
 * forensic destruction of all copies on a storage device.
 */
export async function wipeUserData(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  await db.execAsync("PRAGMA secure_delete = ON;");

  await db.execAsync(
    "DELETE FROM Entries; DELETE FROM Cycles; DELETE FROM WellnessCheckIns;"
  );

  await db.execAsync(
    `UPDATE Users
     SET first_name = '', last_name = '', birth_date = '';`
  );

  await db.execAsync(
    `UPDATE SecuritySettings
     SET qr_share_token = NULL, qr_last_generated_at = NULL;`
  );

  try {
    await db.execAsync("VACUUM;");
  } catch (error) {
    console.error(
      "VACUUM after wipe failed; database pages may not have been compacted.",
      error
    );
  }

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
): Promise<void> {
  await db.runAsync(
    `UPDATE SecuritySettings
     SET wipe_after_attempts = ?
     WHERE user_id = ?`,
    [threshold, userId]
  );
}

export function attemptsUntilWipe(
  failedAttempts: number,
  threshold: number | null
): number | null {
  return threshold === null
    ? null
    : Math.max(0, threshold - failedAttempts);
}

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
```
