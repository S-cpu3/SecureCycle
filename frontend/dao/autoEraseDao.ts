import * as SQLite from "expo-sqlite";
import { hasUserData, wipeUserData } from "@/dao/duressDao";

/**
 * Inactivity auto-erase: if the app is not unlocked with the real PIN (or
 * biometrics) for the chosen number of days, all cycle data and profile details
 * are erased the next time the app is opened, before the PIN screen accepts
 * anything.
 *
 * It can only run while the app is running. A phone that is never opened keeps
 * its data until someone opens the app.
 */

export type AutoEraseChoice = { label: string; days: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export const AUTO_ERASE_CHOICES: AutoEraseChoice[] = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
];

// Testing aid: lets you check the feature in a minute instead of a week.
// Only offered in development builds.
export const AUTO_ERASE_TEST_CHOICE: AutoEraseChoice = { label: "1 minute (test)", days: 1 / 1440 };

export type AutoEraseSettings = {
  days: number | null;
  lastUnlockedAt: string | null;
  autoErasedAt: string | null;
};

export async function getAutoEraseSettings(
  db: SQLite.SQLiteDatabase,
  userId: number
): Promise<AutoEraseSettings> {
  const row = await db.getFirstAsync<{
    auto_erase_days: number | null;
    last_unlocked_at: string | null;
    auto_erased_at: string | null;
  }>(
    `SELECT auto_erase_days, last_unlocked_at, auto_erased_at
     FROM SecuritySettings
     WHERE user_id = ?`,
    [userId]
  );

  const days = row?.auto_erase_days;
  return {
    days: typeof days === "number" && days > 0 ? days : null,
    lastUnlockedAt: row?.last_unlocked_at ?? null,
    autoErasedAt: row?.auto_erased_at ?? null,
  };
}

/** Turns the feature on (days) or off (null). Turning it on starts the countdown now. */
export async function setAutoEraseDays(
  db: SQLite.SQLiteDatabase,
  userId: number,
  days: number | null,
  nowMs: number = Date.now()
) {
  await db.runAsync(
    `UPDATE SecuritySettings
     SET auto_erase_days = ?, last_unlocked_at = ?
     WHERE user_id = ?`,
    [days, new Date(nowMs).toISOString(), userId]
  );
}

/** Call after every successful real unlock (PIN or biometric). Restarts the countdown. */
export async function touchLastUnlock(db: SQLite.SQLiteDatabase, userId: number, nowMs: number = Date.now()) {
  await db.runAsync(`UPDATE SecuritySettings SET last_unlocked_at = ? WHERE user_id = ?`, [
    new Date(nowMs).toISOString(),
    userId,
  ]);
}

/** When the erase will happen if the app is not unlocked again, or null if it can't be worked out. */
export function autoEraseDeadline(lastUnlockedAt: string | null, days: number | null): Date | null {
  if (!lastUnlockedAt || !days) return null;
  const last = new Date(lastUnlockedAt).getTime();
  if (Number.isNaN(last)) return null;
  return new Date(last + days * DAY_MS);
}

/** True when more than `days` have passed since the last unlock. */
export function isAutoEraseDue(lastUnlockedAt: string | null, days: number | null, nowMs: number): boolean {
  const deadline = autoEraseDeadline(lastUnlockedAt, days);
  return deadline !== null && nowMs > deadline.getTime();
}

/**
 * Erases the data if the inactivity period has run out. Returns true if it erased.
 * Safe to call as often as you like (every lock-screen load and every return to
 * the foreground). The wipe is silent: nothing is shown to whoever opened the app.
 */
export async function runAutoEraseIfDue(
  db: SQLite.SQLiteDatabase,
  userId: number,
  nowMs: number = Date.now()
): Promise<boolean> {
  const settings = await getAutoEraseSettings(db, userId);

  if (settings.days === null) {
    return false;
  }

  // Enabled but no starting point recorded: start the countdown now instead of
  // erasing on a guess.
  if (!settings.lastUnlockedAt || Number.isNaN(new Date(settings.lastUnlockedAt).getTime())) {
    await touchLastUnlock(db, userId, nowMs);
    return false;
  }

  if (!isAutoEraseDue(settings.lastUnlockedAt, settings.days, nowMs)) {
    return false;
  }

  const hadData = await hasUserData(db);
  if (hadData) {
    await wipeUserData(db);
  }

  const nowIso = new Date(nowMs).toISOString();
  await db.runAsync(
    `UPDATE SecuritySettings
     SET last_unlocked_at = ?, auto_erased_at = COALESCE(?, auto_erased_at)
     WHERE user_id = ?`,
    [nowIso, hadData ? nowIso : null, userId]
  );

  return hadData;
}
