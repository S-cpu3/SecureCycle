export const createAllTables = `
-- ===========================
-- Users
-- ===========================
CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_hash TEXT,
    pin_salt TEXT,
    first_name TEXT,
    last_name TEXT,
    date_of_birth TEXT,
    password_hash TEXT,
    auth_type TEXT NOT NULL CHECK (auth_type IN ('local', 'google', 'apple', 'other')),
    created_at TEXT NOT NULL
);

-- ===========================
-- Cycles
-- ===========================
CREATE TABLE IF NOT EXISTS Cycles (
    cycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL,
    user_id INTEGER NOT NULL,

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- ===========================
-- Entries
-- ===========================
CREATE TABLE IF NOT EXISTS Entries (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    intensity TEXT,
    notes TEXT,
    symptom_type TEXT,

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE IF NOT EXISTS SecuritySettings (
    setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    biometric_enabled INTEGER NOT NULL DEFAULT 0,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TEXT,
    qr_share_token TEXT,
    qr_last_generated_at TEXT,

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
`
