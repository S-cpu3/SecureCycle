// Imports
import * as SQLite from "expo-sqlite";

// TypeScript model: Represents Authentication/Session State
export interface AuthState {
    session_id: string;      // UUID
    user_id: string;         // foreign key
    is_duress: number;       // 0 = real session, 1 = duress mode
    logged_in_at: string;    // ISO timestamp
    logged_out_at?: string;  // nullable
}

// NewAuthState type
export type NewAuthState = Omit<AuthState, "logged_out_at"> & { logged_out_at?: null };

// Init: Database connection
const db = await SQLite.openDatabaseAsync("stealthdetect.db");

// DAO Methods for AuthState table
export const AuthDao = {

    // Start a new session (login)
    save: async (session: AuthState | NewAuthState): Promise<void> => {
        const { session_id, user_id, is_duress, logged_in_at, logged_out_at } = session;

        await db.runAsync(
            `INSERT OR REPLACE INTO AuthState 
        (session_id, user_id, is_duress, logged_in_at, logged_out_at)
        VALUES (?, ?, ?, ?, ?);`,
            [
                session_id, user_id, is_duress,
                logged_in_at, logged_out_at ?? null
            ]);
    },

    // Get active session for user
    getActiveSession: async (user_id: string): Promise<AuthState | null> => {
        const result = await db.getFirstAsync<AuthState>(
            `SELECT * FROM AuthState 
             WHERE user_id = ? AND logged_out_at IS NULL
             ORDER BY logged_in_at DESC LIMIT 1;`,
            [user_id]
        );
        return result ?? null;
    },

    // Close session (logout)
    closeSession: async (session_id: string): Promise<void> => {
        const now = new Date().toISOString();

        await db.runAsync(
            `UPDATE AuthState 
         SET logged_out_at = ?
         WHERE session_id = ?;`,
            [now, session_id]
        );
    },

    // Get session history for a user
    getHistory: async (user_id: string): Promise<AuthState[]> => {
        const results = await db.getAllAsync<AuthState>(
            `SELECT * FROM AuthState 
             WHERE user_id = ?
             ORDER BY logged_in_at DESC;`,
            [user_id]
        );
        return results ?? [];
    },

    // Delete a session
    deleteById: async (session_id: string): Promise<void> => {
        await db.runAsync(
            `DELETE FROM AuthState WHERE session_id = ?;`,
            [session_id]
        );
    }
};