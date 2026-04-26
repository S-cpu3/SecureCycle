# SafeCycle — Implementation Reference

_This document records key architectural decisions, what was built, and why. It is intended as a living reference — update it when decisions change._

---

## What Was Built

### Data Layer

| File | Role |
|------|------|
| `frontend/contexts/schema.js` | Single-source SQL DDL for all 9 tables, exported as `createAllTables` |
| `frontend/contexts/DatabaseProvider.tsx` | Opens `safecycle.db`, runs versioned migrations, provides `SQLiteDatabase` via React Context |
| `frontend/types/models.ts` | TypeScript interfaces for every table row + `toISO` / `fromISO` date helpers |

### Prediction Engine

| File | Role |
|------|------|
| `frontend/engine/predictionEngine.ts` | Pure functions — no Expo/React/SQLite dependencies. Accepts a `PredictionInput`, returns a `PredictionResult` |

### Data Access Objects (DAOs)

| File | Covers |
|------|--------|
| `frontend/services/dao/UserDao.ts` | Single device user (user_id = 1) — get, upsert |
| `frontend/services/dao/CycleDao.ts` | Cycle CRUD + `computeStats` (avg length, stdDev, last period start) |
| `frontend/services/dao/PeriodDao.ts` | Log, extend, and fetch bleeding periods |
| `frontend/services/dao/EntryDao.ts` | Daily symptom / flow / mood entries |
| `frontend/services/dao/ProfileDao.ts` | Health conditions, birth control, user intent |
| `frontend/services/dao/PredictionDao.ts` | Persist and fetch computed predictions |

### Hooks & UI

| File | Role |
|------|------|
| `frontend/hooks/use-prediction.ts` | Orchestration hook — pulls from all DAOs, calls the engine, exposes `{ prediction, loading, error, refresh }` |
| `frontend/app/(tabs)/profile.tsx` | DOB, health conditions checklist, intent radio group — all wired to DB |
| `frontend/app/(tabs)/history.tsx` | DB-backed period logging, live prediction overlay on calendar |
| `frontend/components/CycleTracker.tsx` | Phase-aware ring visualization driven by `PredictionResult` |
| `frontend/app/(tabs)/index.tsx` | Passes `prediction` + `lastPeriodStart` to `CycleTracker` |

---

## Key Decisions

### 1. TEXT for all date columns

SQLite has no native `DATE` or `DATETIME` type. All values are ultimately stored as TEXT, INTEGER, or REAL. Storing dates as ISO 8601 TEXT strings (`YYYY-MM-DD`) is the idiomatic SQLite pattern and is fully compatible with SQLite's built-in date functions (`datetime('now')`, `julianday()`, etc.) and expo-sqlite.

`DEFAULT (datetime('now'))` is applied only to `created_at` / `set_at` audit columns. `start_date` and `end_date` columns carry **no default** — the application always provides them explicitly, which prevents silent wrong-date bugs.

### 2. `PRAGMA user_version` for schema migrations

`DatabaseProvider.tsx` reads `PRAGMA user_version` on every launch and runs any pending migration blocks in sequence. Each block ends with `PRAGMA user_version = N` so a mid-migration crash replays the block on next launch. All `CREATE TABLE` statements use `IF NOT EXISTS`, making re-runs safe.

**Rule going forward:** version 1 is the only version that `DROP TABLE`s anything (the old stub `cycles` table, which had no user data). All future migrations must use `ALTER TABLE ADD COLUMN` or `CREATE TABLE IF NOT EXISTS` only — never `DROP TABLE` once real user data exists.

```ts
// Template for future migrations:
if (current < 2) {
  await db.execAsync(`
    ALTER TABLE Entries ADD COLUMN custom_note TEXT;
    PRAGMA user_version = 2;
  `);
}
```

### 3. Single-user architecture

The app is local-first and device-bound. Rather than multi-user auth, there is exactly one row in `Users` with `user_id = 1`, seeded during the v1 migration via `INSERT OR IGNORE`. All DAOs hard-code `WHERE user_id = 1`. The `user_id` column is kept on all tables to support a future multi-account or sync scenario without a schema migration.

### 4. Separate `Cycles` and `Periods` tables

A **Cycle** is the container from the start of one period to the start of the next — its length is what the prediction engine averages. A **Period** is the bleeding event within that cycle.

This separation is essential: `CycleDao.computeStats` derives average cycle length from `julianday(end_date) - julianday(start_date)` on the `Cycles` table. If periods and cycles were the same row, we would only know bleeding duration, not inter-period spacing.

### 5. `OvulationWindows` folded into `Predictions`

The original schema draft had a separate `OvulationWindows` table. Because ovulation date and fertile window are outputs of the same single prediction calculation, storing them separately adds a join with no benefit. The `Predictions` table includes `ovulation_date`, `fertile_start`, and `fertile_end` as nullable columns (NULL = suppressed due to a condition like PCOS or perimenopause).

### 6. Prediction engine is pure TypeScript

`predictionEngine.ts` has zero imports from Expo, SQLite, or React. It accepts plain values and returns plain values. This means:

- It can be unit-tested without a device or a running database
- It can be extracted to a shared package if a backend is added later
- The hook (`use-prediction.ts`) handles all side effects; the engine stays deterministic

### 7. Personal data blended with age-based population defaults

The engine blends the user's personal cycle history with population averages using a weight that saturates at 1.0 after 6 logged cycles:

```
weight   = min(cyclesLogged / 6, 1.0)
estimate = (personal × weight) + (population × (1 − weight))
```

Before 6 cycles are logged, population defaults (sourced from published research, keyed by age bracket) dominate. After 6, the estimate is entirely personal. `date_of_birth` is required on the `Users` table to select the correct age bracket.

### 8. Condition-based prediction adjustments

Three medical conditions materially affect prediction reliability and are handled explicitly:

| Condition | Adjustment |
|-----------|-----------|
| PCOS | `cycleLength ≥ 35`, `stdDev ≥ 10`, ovulation/fertile suppressed |
| Endometriosis | `cycleLength ≤ 27`, `stdDev ≥ 4` |
| Perimenopause | `stdDev ≥ 14`, ovulation/fertile suppressed |

### 9. Confidence score and display rule

```
confidenceScore = max(0, 100 − stdDev × 10)
showRangeOnly   = confidenceScore < 30
```

When `showRangeOnly` is true, the UI displays `earliest – latest` rather than a single predicted date. This prevents false precision being shown to users with irregular cycles (PCOS, perimenopause confidence typically lands at 0%).

### 10. SQLite has no STDDEV — computed in JavaScript

`CycleDao.computeStats` fetches raw cycle lengths from `julianday` arithmetic, then computes mean and sample standard deviation in JavaScript. The query caps at the last 12 cycles for recency weighting. This is a deliberate trade-off: the JS overhead is negligible on device and avoids the complexity of a custom SQLite aggregate function.

### 11. DAO pattern — `db` passed as first argument

The reference DAOs in `db_REMOVE/` held the database in module scope (`const db = await openDatabaseAsync(...)`). The production DAOs pass `db: SQLiteDatabase` as the first parameter to every method instead. This is required for compatibility with the Context pattern — the database is initialised asynchronously by `DatabaseProvider` and components access it via `useDatabase()`.

---

## Schema at a Glance

```
Users (1 row — device user)
 ├── HealthConditions     (set replaced atomically on save)
 ├── UserBirthControl     (active record = end_date IS NULL)
 ├── UserIntent           (append-only; latest row wins)
 └── Cycles
      ├── Periods          (bleeding events within a cycle)
      ├── Entries          (daily logs — symptoms, flow, mood)
      └── Predictions      (one row per computed prediction)
```

See [Schema.md](Schema.md) for the full ERD and SQL.

---

## Verification Checklist

1. **Migration:** Fresh install → `db-debug.tsx` shows all 9 tables, `Users` count = 1, `PRAGMA user_version` = 1
2. **Re-launch:** Existing DB → no crash, no duplicate rows, version still = 1
3. **Profile → prediction:** Set DOB + PCOS → history screen shows a wide date range, no ovulation window, ~0% confidence
4. **Period logging:** Tap a date → period highlighted in red; close and reopen app → period still shown (DB persistence confirmed)
5. **Prediction accuracy:** Log 6 complete cycles → `weight = 1.0`, fully personal data; log 0 → population defaults by age
6. **CycleTracker ring:** Home screen ring phase icons match the dates shown in the history calendar
