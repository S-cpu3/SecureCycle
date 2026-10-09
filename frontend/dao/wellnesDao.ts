import type { SQLiteDatabase } from "expo-sqlite";

export type WellnessMood = "very_low" | "low" | "okay" | "good" | "great";

export const WELLNESS_MOOD_LABELS: Record<WellnessMood, string> = {
  very_low: "Very low",
  low: "Low",
  okay: "Okay",
  good: "Good",
  great: "Great",
};

export type WellnessCheckIn = {
  checkin_id: number;
  user_id: number;
  date: string;
  mood: WellnessMood;
  energy: number;
  sleep_hours: number | null;
  water_glasses: number | null;
  symptoms: string | null;
  updated_at: string;
};

export type SaveWellnessCheckInInput = {
  date: string;
  mood: WellnessMood;
  energy: number;
  sleepHours: number | null;
  waterGlasses: number | null;
  symptoms: string | null;
};

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getWellnessCheckIn(
  db: SQLiteDatabase,
  userId: number,
  date = localDateKey()
) {
  return db.getFirstAsync<WellnessCheckIn>(
    `SELECT checkin_id, user_id, date, mood, energy, sleep_hours, water_glasses, symptoms, updated_at
     FROM WellnessCheckIns
     WHERE user_id = ? AND date = ?`,
    [userId, date]
  );
}

export async function getRecentWellnessCheckIns(
  db: SQLiteDatabase,
  userId: number,
  days = 7
) {
  const safeDays = Math.min(30, Math.max(1, Math.floor(days)));
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (safeDays - 1));

  return db.getAllAsync<WellnessCheckIn>(
    `SELECT checkin_id, user_id, date, mood, energy, sleep_hours, water_glasses, symptoms, updated_at
     FROM WellnessCheckIns
     WHERE user_id = ? AND date >= ?
     ORDER BY date DESC
     LIMIT ?`,
    [userId, localDateKey(cutoff), safeDays]
  );
}

export async function saveWellnessCheckIn(
  db: SQLiteDatabase,
  userId: number,
  input: SaveWellnessCheckInInput
) {
  await db.runAsync(
    `INSERT INTO WellnessCheckIns (
       user_id, date, mood, energy, sleep_hours, water_glasses, symptoms, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, date) DO UPDATE SET
       mood = excluded.mood,
       energy = excluded.energy,
       sleep_hours = excluded.sleep_hours,
       water_glasses = excluded.water_glasses,
       symptoms = excluded.symptoms,
       updated_at = excluded.updated_at`,
    [
      userId,
      input.date,
      input.mood,
      input.energy,
      input.sleepHours,
      input.waterGlasses,
      input.symptoms?.trim() || null,
      new Date().toISOString(),
    ]
  );

  const savedCheckIn = await getWellnessCheckIn(db, userId, input.date);

  if (!savedCheckIn) {
    throw new Error("The wellness check-in could not be read after saving.");
  }

  return savedCheckIn;
}
