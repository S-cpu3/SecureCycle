import * as SQLite from "expo-sqlite";

export type HomeCycleData = {
  currentDateLabel: string;
  currentCycleDay: number;
  cycleLength: number;
  phaseLabel: string;
  phaseDetail: string;
  periodDays: number[];
  fertileDays: number[];
  ovulationDay: number;
  entries: Array<{
    date: string;
    entry_type: string;
    intensity: string | null;
    symptom_type: string | null;
    notes: string | null;
  }>;
};

export type SavedPeriod = {
  startDate: string;
  endDate: string;
  length: number;
};

export type CycleForDate = {
  cycleId: number;
  startDate: string;
  endDate: string | null;
  periodId: number | null;
  dayNumber: number;
  isPeriodDay: boolean;
};

export type CalendarDayState = {
  kind: "period" | "fertile" | "ovulation";
};

export type HomeCycleState = HomeCycleData | null;

export type DailyLogEntry = {
  entry_id: number;
  user_id: number;
  cycle_id: number;
  period_id: number | null;
  date: string;
  entry_type: string;
  intensity: string | null;
  symptom_type: string | null;
  notes: string | null;
};

type EntryRow = {
  date: string;
  entry_type: string;
  intensity: string | null;
  symptom_type: string | null;
  notes: string | null;
};

type PeriodEntryRow = {
  date: string;
};

type CycleStartRow = {
  start_date: string;
};

type CycleForDateRow = {
  cycle_id: number;
  start_date: string;
  end_date: string | null;
  period_id: number | null;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function differenceInDays(first: Date, second: Date) {
  return Math.floor((startOfDay(first).getTime() - startOfDay(second).getTime()) / 86400000);
}

function normalizeCycleStarts(rows: CycleStartRow[]) {
  const accepted: string[] = [];

  for (const row of rows) {
    const candidate = new Date(`${row.start_date}T00:00:00`);
    const latestAccepted = accepted[accepted.length - 1];

    if (!latestAccepted) {
      accepted.push(row.start_date);
      continue;
    }

    const latestDate = new Date(`${latestAccepted}T00:00:00`);
    if (differenceInDays(latestDate, candidate) >= 21) {
      accepted.push(row.start_date);
    }
  }

  return accepted;
}

function buildPhase(day: number, cycleLength: number) {
  const ovulationDay = Math.max(14, Math.round(cycleLength / 2));

  if (day <= 5) {
    return {
      label: "Menstrual phase",
      detail: "Flow is active in this demo cycle.",
    };
  }

  if (day >= ovulationDay - 2 && day <= ovulationDay + 2) {
    return {
      label: "Fertile window",
      detail: day === ovulationDay ? "Ovulation is predicted today." : "Ovulation is approaching.",
    };
  }

  if (day < ovulationDay - 2) {
    return {
      label: "Follicular phase",
      detail: "Energy and fertility trend upward here.",
    };
  }

  return {
    label: "Luteal phase",
    detail: "The next period is approaching.",
  };
}

export async function getHomeCycleData(db: SQLite.SQLiteDatabase, userId: number): Promise<HomeCycleState> {
  const cycleRows = await db.getAllAsync<CycleStartRow>(
    `SELECT start_date
     FROM Cycles
     WHERE user_id = ?
     ORDER BY start_date DESC
    `,
    [userId]
  );

  const normalizedStarts = normalizeCycleStarts(cycleRows);
  const latestStart = normalizedStarts[0];

  if (!latestStart) {
    return null;
  }

  const cycleStart = new Date(`${latestStart}T00:00:00`);
  const today = startOfToday();
  const elapsed = Math.floor((today.getTime() - cycleStart.getTime()) / 86400000);
  const currentCycleDay = Math.min(28, Math.max(1, elapsed + 1));
  const cycleLength = 28;
  const periodDays = [1, 2, 3, 4, 5];
  const ovulationDay = 14;
  const fertileDays = [11, 12, 13, 14, 15, 16];
  const phase = buildPhase(currentCycleDay, cycleLength);
  const entries = await db.getAllAsync<EntryRow>(
    `SELECT date, entry_type, intensity, symptom_type, notes
     FROM Entries
     WHERE user_id = ?
     ORDER BY date DESC
     LIMIT 8`,
    [userId]
  );

  return {
    currentDateLabel: today.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    }),
    currentCycleDay,
    cycleLength,
    phaseLabel: phase.label,
    phaseDetail: phase.detail,
    periodDays,
    fertileDays,
    ovulationDay,
    entries,
  };
}

export async function logPeriod(
  db: SQLite.SQLiteDatabase,
  userId: number,
  startDate: Date,
  length: number
) {
  const normalizedStart = startOfDay(startDate);
  const normalizedLength = Math.max(1, length);
  const normalizedEnd = addDays(normalizedStart, normalizedLength - 1);
  const cycleEnd = addDays(normalizedStart, 27);
  const startValue = isoDate(normalizedStart);
  const endValue = isoDate(normalizedEnd);
  const cycleRows = await db.getAllAsync<CycleStartRow>(
    `SELECT start_date
     FROM Cycles
     WHERE user_id = ?
     ORDER BY start_date DESC`,
    [userId]
  );

  for (const row of cycleRows) {
    const gap = Math.abs(differenceInDays(new Date(`${row.start_date}T00:00:00`), normalizedStart));
    if (row.start_date !== startValue && gap < 21) {
      throw new Error("Period starts should be at least 21 days apart.");
    }
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    const existingCycles = await tx.getAllAsync<{ cycle_id: number }>(
      `SELECT cycle_id
       FROM Cycles
       WHERE user_id = ?
       AND start_date = ?`,
      [userId, startValue]
    );

    for (const existingCycle of existingCycles) {
      await tx.runAsync(`DELETE FROM Entries WHERE cycle_id = ?`, [existingCycle.cycle_id]);
      await tx.runAsync(`DELETE FROM Periods WHERE cycle_id = ?`, [existingCycle.cycle_id]);
      await tx.runAsync(`DELETE FROM Cycles WHERE cycle_id = ?`, [existingCycle.cycle_id]);
    }

    await tx.runAsync(
      `DELETE FROM Entries
       WHERE user_id = ?
       AND entry_type = 'period'
       AND date >= ?
       AND date <= ?`,
      [userId, startValue, endValue]
    );

    const cycleInsert = await tx.runAsync(
      `INSERT INTO Cycles (start_date, end_date, created_at, user_id)
       VALUES (?, ?, ?, ?)`,
      [startValue, isoDate(cycleEnd), new Date().toISOString(), userId]
    );

    const cycleId = cycleInsert.lastInsertRowId;
    const periodInsert = await tx.runAsync(
      `INSERT INTO Periods (cycle_id, user_id, start_date, end_date, total_days)
       VALUES (?, ?, ?, ?, ?)`,
      [cycleId, userId, startValue, endValue, normalizedLength]
    );

    const periodId = periodInsert.lastInsertRowId;

    for (let offset = 0; offset < normalizedLength; offset += 1) {
      const entryDate = isoDate(addDays(normalizedStart, offset));
      await tx.runAsync(
        `INSERT INTO Entries (user_id, cycle_id, period_id, date, entry_type, intensity, notes, symptom_type)
         VALUES (?, ?, ?, ?, 'period', ?, ?, NULL)`,
        [
          userId,
          cycleId,
          periodId,
          entryDate,
          offset < 2 ? "heavy" : offset < 4 ? "medium" : "light",
          null,
        ]
      );
    }
  });
}

export async function getSavedPeriods(db: SQLite.SQLiteDatabase, userId: number): Promise<SavedPeriod[]> {
  const entries = await db.getAllAsync<PeriodEntryRow>(
    `SELECT date
     FROM Entries
     WHERE user_id = ?
     AND entry_type = 'period'
     ORDER BY date DESC`,
    [userId]
  );
  const groupedPeriods: SavedPeriod[] = [];

  for (const entry of entries) {
    const entryDate = new Date(`${entry.date}T00:00:00`);
    const latest = groupedPeriods[groupedPeriods.length - 1];

    if (!latest) {
      groupedPeriods.push({
        startDate: entry.date,
        endDate: entry.date,
        length: 1,
      });
      continue;
    }

    const latestStart = new Date(`${latest.startDate}T00:00:00`);
    if (differenceInDays(latestStart, entryDate) === 1) {
      latest.startDate = entry.date;
      latest.length += 1;
      continue;
    }

    groupedPeriods.push({
      startDate: entry.date,
      endDate: entry.date,
      length: 1,
    });
  }

  return groupedPeriods.slice(0, 6);
}

export async function getCycleForDate(
  db: SQLite.SQLiteDatabase,
  userId: number,
  date: Date
): Promise<CycleForDate | null> {
  const dateValue = isoDate(startOfDay(date));
  const row = await db.getFirstAsync<CycleForDateRow>(
    `SELECT c.cycle_id, c.start_date, c.end_date, p.period_id
     FROM Cycles c
     LEFT JOIN Periods p
       ON p.cycle_id = c.cycle_id
       AND p.start_date <= ?
       AND p.end_date >= ?
     WHERE c.user_id = ?
       AND c.start_date <= ?
       AND (c.end_date IS NULL OR c.end_date >= ?)
     ORDER BY c.start_date DESC
     LIMIT 1`,
    [dateValue, dateValue, userId, dateValue, dateValue]
  );

  if (!row) {
    return null;
  }

  return {
    cycleId: row.cycle_id,
    startDate: row.start_date,
    endDate: row.end_date,
    periodId: row.period_id,
    dayNumber: differenceInDays(new Date(`${dateValue}T00:00:00`), new Date(`${row.start_date}T00:00:00`)) + 1,
    isPeriodDay: row.period_id !== null,
  };
}

export async function getEntriesForDate(
  db: SQLite.SQLiteDatabase,
  userId: number,
  date: Date
): Promise<DailyLogEntry[]> {
  return db.getAllAsync<DailyLogEntry>(
    `SELECT entry_id, user_id, cycle_id, period_id, date, entry_type, intensity, symptom_type, notes
     FROM Entries
     WHERE user_id = ?
       AND date = ?
     ORDER BY entry_id ASC`,
    [userId, isoDate(startOfDay(date))]
  );
}

export async function saveSymptomForDate(
  db: SQLite.SQLiteDatabase,
  userId: number,
  date: Date,
  symptomType: string,
  intensity: string,
  notes: string
) {
  const cycle = await getCycleForDate(db, userId, date);

  if (!cycle) {
    throw new Error("Choose a date inside a logged cycle before saving a symptom.");
  }

  const dateValue = isoDate(startOfDay(date));
  const trimmedSymptomType = symptomType.trim();
  const trimmedNotes = notes.trim();

  if (!trimmedSymptomType) {
    throw new Error("Choose a symptom before saving.");
  }

  const existing = await db.getFirstAsync<{ entry_id: number }>(
    `SELECT entry_id
     FROM Entries
     WHERE user_id = ?
       AND cycle_id = ?
       AND date = ?
       AND entry_type = 'symptom'
     ORDER BY entry_id DESC
     LIMIT 1`,
    [userId, cycle.cycleId, dateValue]
  );

  if (existing) {
    await db.runAsync(
      `UPDATE Entries
       SET period_id = ?, intensity = ?, notes = ?, symptom_type = ?
       WHERE entry_id = ?`,
      [
        cycle.periodId,
        intensity.trim() || null,
        trimmedNotes || null,
        trimmedSymptomType,
        existing.entry_id,
      ]
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO Entries (user_id, cycle_id, period_id, date, entry_type, intensity, notes, symptom_type)
     VALUES (?, ?, ?, ?, 'symptom', ?, ?, ?)`,
    [
      userId,
      cycle.cycleId,
      cycle.periodId,
      dateValue,
      intensity.trim() || null,
      trimmedNotes || null,
      trimmedSymptomType,
    ]
  );
}

export async function getCalendarMonthData(
  db: SQLite.SQLiteDatabase,
  userId: number,
  month: Date
): Promise<Record<string, CalendarDayState>> {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const state: Record<string, CalendarDayState> = {};
  const periodEntries = await db.getAllAsync<PeriodEntryRow>(
    `SELECT date
     FROM Entries
     WHERE user_id = ?
     AND entry_type = 'period'
     AND date >= ?
     AND date <= ?`,
    [userId, isoDate(monthStart), isoDate(monthEnd)]
  );
  const cycles = await db.getAllAsync<CycleStartRow>(
    `SELECT start_date
     FROM Cycles
     WHERE user_id = ?
     ORDER BY start_date DESC`,
    [userId]
  );
  const normalizedStarts = normalizeCycleStarts(cycles);

  for (const entry of periodEntries) {
    state[entry.date] = { kind: "period" };
  }

  for (const startDate of normalizedStarts) {
    const cycleStart = new Date(`${startDate}T00:00:00`);

    for (const fertileOffset of [10, 11, 12, 14, 15]) {
      const fertileDay = addDays(cycleStart, fertileOffset);
      if (fertileDay >= monthStart && fertileDay <= monthEnd && !state[isoDate(fertileDay)]) {
        state[isoDate(fertileDay)] = { kind: "fertile" };
      }
    }

    const ovulationDay = addDays(cycleStart, 13);
    if (ovulationDay >= monthStart && ovulationDay <= monthEnd) {
      state[isoDate(ovulationDay)] = { kind: "ovulation" };
    }
  }

  return state;
}

export async function getExportData(db: SQLite.SQLiteDatabase, userId: number) {
  const user = await db.getFirstAsync<{
    first_name: string | null;
    last_name: string | null;
    birth_date: string | null;
  }>(
    `SELECT first_name, last_name, birth_date
     FROM Users
     WHERE user_id = ?`,
    [userId]
  );

  const cycles = await db.getAllAsync<{
    start_date: string;
    end_date: string | null;
  }>(
    `SELECT start_date, end_date
     FROM Cycles
     WHERE user_id = ?
     ORDER BY start_date DESC
     LIMIT 6`,
    [userId]
  );

  const entries = await db.getAllAsync<EntryRow>(
    `SELECT date, entry_type, intensity, symptom_type, notes
     FROM Entries
     WHERE user_id = ?
     ORDER BY date DESC
     LIMIT 20`,
    [userId]
  );

  return {
    patient: {
      firstName: user?.first_name ?? "",
      lastName: user?.last_name ?? "",
      birthDate: user?.birth_date ?? "",
    },
    exportedAt: new Date().toISOString(),
    cycles,
    entries,
  };
}
