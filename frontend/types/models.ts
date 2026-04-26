// ISO 8601 date string stored in SQLite TEXT columns (e.g. "2024-03-15" or "2024-03-15T10:30:00")
export type ISODateString = string;

// ─── Enum-like union types (mirror CHECK constraints in schema.js) ───────────

export type HealthCondition =
  | 'PCOS'
  | 'endometriosis'
  | 'perimenopause'
  | 'fibroids'
  | 'thyroid_disorder'
  | 'other';

export type BirthControlMethod =
  | 'none'
  | 'pill'
  | 'iud_hormonal'
  | 'iud_copper'
  | 'implant'
  | 'patch'
  | 'ring'
  | 'condom'
  | 'other';

export type UserIntentType =
  | 'conceive'
  | 'avoid_pregnancy'
  | 'track_only'
  | 'health_monitoring';

export type AuthType = 'local' | 'google' | 'apple' | 'other';

// ─── Table interfaces ─────────────────────────────────────────────────────────

export interface User {
  user_id: number;
  pin_hash: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: ISODateString | null;
  password_hash: string | null;
  auth_type: AuthType;
  created_at: ISODateString;
}

export interface Cycle {
  cycle_id: number;
  user_id: number;
  start_date: ISODateString;
  end_date: ISODateString | null;
  created_at: ISODateString;
}

export interface Period {
  period_id: number;
  cycle_id: number;
  user_id: number;
  start_date: ISODateString;
  end_date: ISODateString;
  total_days: number;
}

export interface Entry {
  entry_id: number;
  user_id: number;
  cycle_id: number;
  period_id: number | null;
  date: ISODateString;
  entry_type: string;
  intensity: string | null;
  notes: string | null;
  symptom_type: string | null;
}

export interface HealthConditionRecord {
  id: number;
  user_id: number;
  condition: HealthCondition;
  diagnosed: number;   // SQLite stores booleans as 0/1
  created_at: ISODateString;
}

export interface UserBirthControl {
  id: number;
  user_id: number;
  method: BirthControlMethod;
  start_date: ISODateString | null;
  end_date: ISODateString | null;
  created_at: ISODateString;
}

export interface UserIntent {
  id: number;
  user_id: number;
  intention: UserIntentType;
  set_at: ISODateString;
}

export interface Prediction {
  id: number;
  cycle_id: number;
  predicted_period_start: ISODateString;
  predicted_period_end: ISODateString;
  predicted_next_cycle_start: ISODateString;
  earliest: ISODateString;
  latest: ISODateString;
  ovulation_date: ISODateString | null;   // null = suppressed (PCOS / perimenopause)
  fertile_start: ISODateString | null;
  fertile_end: ISODateString | null;
  pms_start: ISODateString;
  confidence_score: number;
  created_at: ISODateString;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Convert a JS Date to an ISO date string for SQLite storage
export function toISO(date: Date): ISODateString {
  return date.toISOString().split('T')[0];
}

// Parse an ISO date string from SQLite into a JS Date
export function fromISO(value: ISODateString): Date {
  return new Date(value + 'T00:00:00');
}
