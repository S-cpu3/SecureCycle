export const createAllTables = `
-- ===========================
-- Users
-- ===========================
CREATE TABLE IF NOT EXISTS Users (
    user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_hash      TEXT,
    first_name    TEXT,
    last_name     TEXT,
    date_of_birth TEXT,
    password_hash TEXT,
    auth_type     TEXT NOT NULL CHECK (auth_type IN ('local', 'google', 'apple', 'other')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===========================
-- Cycles
-- ===========================
CREATE TABLE IF NOT EXISTS Cycles (
    cycle_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- ===========================
-- Periods
-- ===========================
CREATE TABLE IF NOT EXISTS Periods (
    period_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id   INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL,
    total_days INTEGER NOT NULL,

    FOREIGN KEY (cycle_id) REFERENCES Cycles(cycle_id),
    FOREIGN KEY (user_id)  REFERENCES Users(user_id)
);

-- ===========================
-- Entries (daily logs)
-- ===========================
CREATE TABLE IF NOT EXISTS Entries (
    entry_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    cycle_id     INTEGER NOT NULL,
    period_id    INTEGER,
    date         TEXT NOT NULL,
    entry_type   TEXT NOT NULL,
    intensity    TEXT,
    notes        TEXT,
    symptom_type TEXT,

    FOREIGN KEY (user_id)   REFERENCES Users(user_id),
    FOREIGN KEY (cycle_id)  REFERENCES Cycles(cycle_id),
    FOREIGN KEY (period_id) REFERENCES Periods(period_id)
);

-- ===========================
-- Health Conditions
-- ===========================
CREATE TABLE IF NOT EXISTS HealthConditions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    condition  TEXT NOT NULL CHECK (condition IN ('PCOS', 'endometriosis', 'perimenopause', 'fibroids', 'thyroid_disorder', 'other')),
    diagnosed  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- ===========================
-- Birth Control
-- ===========================
CREATE TABLE IF NOT EXISTS UserBirthControl (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    method     TEXT NOT NULL CHECK (method IN ('none', 'pill', 'iud_hormonal', 'iud_copper', 'implant', 'patch', 'ring', 'condom', 'other')),
    start_date TEXT,
    end_date   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- ===========================
-- User Intent
-- ===========================
CREATE TABLE IF NOT EXISTS UserIntent (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    intention TEXT NOT NULL CHECK (intention IN ('conceive', 'avoid_pregnancy', 'track_only', 'health_monitoring')),
    set_at    TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- ===========================
-- Predictions
-- Stores all computed prediction outputs for a cycle in one row.
-- Ovulation and fertile window are included here since they are
-- derived from the same calculation — no separate OvulationWindows table needed.
-- ===========================
CREATE TABLE IF NOT EXISTS Predictions (
    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id                   INTEGER NOT NULL,
    predicted_period_start     TEXT NOT NULL,
    predicted_period_end       TEXT NOT NULL,
    predicted_next_cycle_start TEXT NOT NULL,
    earliest                   TEXT NOT NULL,
    latest                     TEXT NOT NULL,
    ovulation_date             TEXT,
    fertile_start              TEXT,
    fertile_end                TEXT,
    pms_start                  TEXT NOT NULL,
    confidence_score           REAL NOT NULL,
    created_at                 TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (cycle_id) REFERENCES Cycles(cycle_id)
);
`;
