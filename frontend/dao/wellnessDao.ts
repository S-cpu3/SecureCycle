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

export type DoctorAppointment = {
  appointment_id: number;
  user_id: number;
  clinician: string;
  appointment_date: string;
  appointment_time: string;
  location: string | null;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled";
  created_at: string;
};

export type SaveDoctorAppointmentInput = {
  clinician: string;
  appointmentDate: string;
  appointmentTime: string;
  location: string | null;
  notes: string | null;
};

export type HeartRateReading = {
  reading_id: number;
  user_id: number;
  bpm: number;
  recorded_at: string;
  note: string | null;
};

/**
 * Feature tables live here so these additions do not require changing the
 * app-wide schema or its initialization flow.
 */
export async function ensureWellnessFeatureTables(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS DoctorAppointments (
      appointment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      clinician TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      location TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES Users(user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_doctor_appointments_user_date
      ON DoctorAppointments(user_id, status, appointment_date, appointment_time);

    CREATE TABLE IF NOT EXISTS HeartRateReadings (
      reading_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bpm INTEGER NOT NULL CHECK (bpm BETWEEN 30 AND 250),
      recorded_at TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (user_id) REFERENCES Users(user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_heart_rate_user_recorded
      ON HeartRateReadings(user_id, recorded_at DESC);
  `);
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a real local calendar date/time, rejecting rollover and DST gaps. */
export function appointmentDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return null;
  }
  const value = new Date(`${date}T${time}:00`);
  if (
    Number.isNaN(value.getTime()) ||
    localDateKey(value) !== date ||
    value.getHours() !== Number(time.slice(0, 2)) ||
    value.getMinutes() !== Number(time.slice(3, 5))
  ) {
    return null;
  }
  return value;
}

export async function getDoctorAppointments(
  db: SQLiteDatabase,
  userId: number,
  limit = 10
) {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));

  return db.getAllAsync<DoctorAppointment>(
    `SELECT appointment_id, user_id, clinician, appointment_date,
            appointment_time, location, notes, status, created_at
     FROM DoctorAppointments
     WHERE user_id = ? AND status = 'scheduled'
     ORDER BY appointment_date ASC, appointment_time ASC
     LIMIT ?`,
    [userId, safeLimit]
  );
}

export async function saveDoctorAppointment(
  db: SQLiteDatabase,
  userId: number,
  input: SaveDoctorAppointmentInput
) {
  const scheduledAt = appointmentDateTime(input.appointmentDate, input.appointmentTime);
  if (!input.clinician.trim() || input.clinician.trim().length > 100) {
    throw new Error("Enter a doctor or clinic name (up to 100 characters).");
  }
  if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
    throw new Error("Enter a valid future date and time.");
  }
  if ((input.location?.length ?? 0) > 200 || (input.notes?.length ?? 0) > 500) {
    throw new Error("Keep location under 200 characters and notes under 500.");
  }

  const result = await db.runAsync(
    `INSERT INTO DoctorAppointments (
       user_id, clinician, appointment_date, appointment_time,
       location, notes, status, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
    [
      userId,
      input.clinician.trim(),
      input.appointmentDate,
      input.appointmentTime,
      input.location?.trim() || null,
      input.notes?.trim() || null,
      new Date().toISOString(),
    ]
  );

  const savedAppointment = await db.getFirstAsync<DoctorAppointment>(
    `SELECT appointment_id, user_id, clinician, appointment_date,
            appointment_time, location, notes, status, created_at
     FROM DoctorAppointments
     WHERE appointment_id = ? AND user_id = ?`,
    [result.lastInsertRowId, userId]
  );

  if (!savedAppointment) {
    throw new Error("The doctor appointment could not be read after saving.");
  }
  return savedAppointment;
}

export async function updateDoctorAppointmentStatus(
  db: SQLiteDatabase,
  userId: number,
  appointmentId: number,
  status: "completed" | "cancelled"
) {
  await db.runAsync(
    `UPDATE DoctorAppointments
     SET status = ?
     WHERE appointment_id = ? AND user_id = ? AND status = 'scheduled'`,
    [status, appointmentId, userId]
  );
}

export async function getRecentHeartRateReadings(
  db: SQLiteDatabase,
  userId: number,
  limit = 5
) {
  const safeLimit = Math.min(30, Math.max(1, Math.floor(limit)));

  return db.getAllAsync<HeartRateReading>(
    `SELECT reading_id, user_id, bpm, recorded_at, note
     FROM HeartRateReadings
     WHERE user_id = ?
     ORDER BY recorded_at DESC, reading_id DESC
     LIMIT ?`,
    [userId, safeLimit]
  );
}

export async function saveHeartRateReading(
  db: SQLiteDatabase,
  userId: number,
  bpm: number,
  note: string | null
) {
  if (!Number.isInteger(bpm) || bpm < 30 || bpm > 250) {
    throw new Error("Heart rate must be a whole number from 30 to 250 bpm.");
  }
  if ((note?.length ?? 0) > 200) {
    throw new Error("Keep the reading note under 200 characters.");
  }

  const recordedAt = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO HeartRateReadings (user_id, bpm, recorded_at, note)
     VALUES (?, ?, ?, ?)`,
    [userId, bpm, recordedAt, note?.trim() || null]
  );

  const savedReading = await db.getFirstAsync<HeartRateReading>(
    `SELECT reading_id, user_id, bpm, recorded_at, note
     FROM HeartRateReadings
     WHERE reading_id = ? AND user_id = ?`,
    [result.lastInsertRowId, userId]
  );

  if (!savedReading) {
    throw new Error("The heart rate reading could not be read after saving.");
  }
  return savedReading;
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
