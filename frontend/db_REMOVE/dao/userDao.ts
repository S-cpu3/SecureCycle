// Imports
import * as SQLite from "expo-sqlite";

// TypeScript Model: Represents the User profile stored locally
export interface User {
    user_id: string;        // UUID
    username: string;       // unique username
    duress_pin: string;     // hashed duress PIN
    real_pin: string;       // hashed real PIN
    created_at: string;     // ISO timestamp
    updated_at?: string;    // nullable
}

// NewUser type excludes updated_at since it’s optional
export type NewUser = Omit<User, "updated_at"> & { updated_at?: null };

// Init: Database connection
const db = await SQLite.openDatabaseAsync("stealthdetect.db");

// DAO Functions for User table
export const UserDao = {
    // Create / Save user
    save: async (user: NewUser | User): Promise<void> => {
        const { user_id, username, duress_pin, real_pin, created_at, updated_at } = user;

        await db.runAsync(
            `INSERT OR REPLACE INTO User 
        (user_id, username, duress_pin, real_pin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?);`,
            [
                user_id, username, duress_pin,
                real_pin, created_at, updated_at ?? null
            ]);
    },

    // Get user by ID
    getById: async (user_id: string): Promise<User | null> => {
        const result = await db.getFirstAsync<User>(
            `SELECT * FROM User WHERE user_id = ? LIMIT 1;`,
            [user_id]
        );
        return result ?? null;
    },

    // Get user by username
    getByUsername: async (username: string): Promise<User | null> => {
        const result = await db.getFirstAsync<User>(
            `SELECT * FROM User WHERE username = ? LIMIT 1;`,
            [username]
        );
        return result ?? null;
    },

    // Update PIN(s)
    updatePins: async (user_id: string, real_pin: string, duress_pin: string): Promise<void> => {
        const updated_at = new Date().toISOString();

        await db.runAsync(
            `UPDATE User SET real_pin = ?, duress_pin = ?, updated_at = ?
         WHERE user_id = ?;`,
            [real_pin, duress_pin, updated_at, user_id]
        );
    },

    // Delete user
    deleteById: async (user_id: string): Promise<void> => {
        await db.runAsync(
            `DELETE FROM User WHERE user_id = ?;`,
            [user_id]
        );
    }
};
