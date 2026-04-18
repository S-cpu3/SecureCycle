import * as SQLite from "expo-sqlite";

export type SecuritySettings = {
  setting_id: number;
  user_id: number;
  biometric_enabled: number;
  failed_attempts: number;
  lockout_until: string | null;
  qr_share_token: string | null;
  qr_last_generated_at: string | null;
};

export async function ensureSecuritySettings(db: SQLite.SQLiteDatabase, userId: number) {
  const existingSettings = await db.getFirstAsync<SecuritySettings>(
    `SELECT setting_id, user_id, biometric_enabled, failed_attempts, lockout_until, qr_share_token, qr_last_generated_at
     FROM SecuritySettings
     WHERE user_id = ?`,
    [userId]
  );

  if (existingSettings) {
    return existingSettings;
  }

  await db.runAsync(
    `INSERT INTO SecuritySettings (user_id, biometric_enabled, failed_attempts)
     VALUES (?, ?, ?)`,
    [userId, 0, 0]
  );

  const createdSettings = await db.getFirstAsync<SecuritySettings>(
    `SELECT setting_id, user_id, biometric_enabled, failed_attempts, lockout_until, qr_share_token, qr_last_generated_at
     FROM SecuritySettings
     WHERE user_id = ?`,
    [userId]
  );

  if (!createdSettings) {
    throw new Error("Unable to create security settings");
  }

  return createdSettings;
}

export async function setBiometricEnabled(
  db: SQLite.SQLiteDatabase,
  userId: number,
  enabled: boolean
) {
  await ensureSecuritySettings(db, userId);
  await db.runAsync(
    `UPDATE SecuritySettings
     SET biometric_enabled = ?
     WHERE user_id = ?`,
    [enabled ? 1 : 0, userId]
  );
}

export async function registerFailedPinAttempt(db: SQLite.SQLiteDatabase, userId: number) {
  const current = await ensureSecuritySettings(db, userId);
  const nextAttempts = current.failed_attempts + 1;
  const backoffMs = Math.min(300000, 1000 * 2 ** (nextAttempts - 1));
  const lockoutUntil = new Date(Date.now() + backoffMs).toISOString();

  await db.runAsync(
    `UPDATE SecuritySettings
     SET failed_attempts = ?, lockout_until = ?
     WHERE user_id = ?`,
    [nextAttempts, lockoutUntil, userId]
  );

  return {
    failedAttempts: nextAttempts,
    lockoutUntil,
    backoffMs,
  };
}

export async function clearFailedPinAttempts(db: SQLite.SQLiteDatabase, userId: number) {
  await ensureSecuritySettings(db, userId);
  await db.runAsync(
    `UPDATE SecuritySettings
     SET failed_attempts = 0, lockout_until = NULL
     WHERE user_id = ?`,
    [userId]
  );
}

export async function getSecuritySettings(db: SQLite.SQLiteDatabase, userId: number) {
  return ensureSecuritySettings(db, userId);
}

export async function saveShareToken(
  db: SQLite.SQLiteDatabase,
  userId: number,
  token: string
) {
  const generatedAt = new Date().toISOString();

  await ensureSecuritySettings(db, userId);
  await db.runAsync(
    `UPDATE SecuritySettings
     SET qr_share_token = ?, qr_last_generated_at = ?
     WHERE user_id = ?`,
    [token, generatedAt, userId]
  );
}
