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

export type CalendarDayState = {
  kind: "period" | "fertile" | "ovulation";
};

export type HomeCycleState = HomeCycleData | null;

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
  const normalizedEnd = addDays(normalizedStart, Math.max(1, length) - 1);
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

  await db.runAsync(`DELETE FROM Cycles WHERE user_id = ? AND start_date = ?`, [userId, startValue]);
  await db.runAsync(
    `DELETE FROM Entries
     WHERE user_id = ?
     AND entry_type = 'period'
     AND date >= ?
     AND date <= ?`,
    [userId, startValue, endValue]
  );

  await db.runAsync(
    `INSERT INTO Cycles (start_date, end_date, created_at, user_id)
     VALUES (?, ?, ?, ?)`,
    [startValue, isoDate(cycleEnd), new Date().toISOString(), userId]
  );

  for (let offset = 0; offset < length; offset += 1) {
    const entryDate = isoDate(addDays(normalizedStart, offset));
    await db.runAsync(
      `INSERT INTO Entries (user_id, date, entry_type, intensity, notes, symptom_type)
       VALUES (?, ?, 'period', ?, ?, NULL)`,
      [userId, entryDate, offset < 2 ? "heavy" : offset < 4 ? "medium" : "light", null]
    );
  }
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
