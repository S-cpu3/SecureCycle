export const createAllTables = `
-- ===========================
-- Users
-- ===========================
CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_hash TEXT,
    first_name TEXT,
    last_name TEXT,
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
`