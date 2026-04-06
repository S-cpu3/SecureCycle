// Imports
import * as SQLite from "expo-sqlite";

// TypeScript Model: Represents blueprint/shape of ScanSession Object
export interface ScanSession {
    scan_id: string; // UUID = String
    user_id: string; // UUID
    started_at: string; // ISO DateTime String
    ended_at?: string; // ^ Optional (Defaults to null)
    mode: string; // Scan types: "quick" | "full" | etc.
    status: string; // Scan status: "running" | "completed" | "failed"
    app_version: string;
}

// Export the ScanSession object, excluding optional fields to prevent errors if left undefined
export type NewScanSession = Omit<ScanSession, "ended_at"> & { ended_at?: null };

// Init: Databse connection
const db = await SQLite.openDatabaseAsync('stealthdetect.db');

// DAO Functions: CRUD Operations for ScanSession Table
export const ScanSessionDao = {
    // Create/Add new ScanSession record
    save: async(session: ScanSession | NewScanSession): Promise<void> => {
        // Define ScanSession fields and values for SQL query
        const { scan_id, user_id, started_at, ended_at, mode, status, app_version } = session;

        // Execute SQL Update Query within a transaction
        await db.runAsync(
    `INSERT OR REPLACE INTO ScanSession (scan_id, user_id, started_at, ended_at, mode, status, app_version)
            VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [scan_id, user_id, started_at, ended_at ?? null, mode, status, app_version]
        );
    },

    // Get/Fetch all ScanSession records
    getAll: async(): Promise<ScanSession[]> => {
        const result = await db.getAllAsync<ScanSession>(`SELECT * FROM ScanSession ORDER BY started_at DESC`);
        return result ?? [];
    },

    // Get/Fetch a single ScanSession by its scan_id
    getById: async(scan_id: string): Promise<ScanSession | null> => {
        const result = await db.getFirstAsync<ScanSession>(
            `SELECT * FROM ScanSession WHERE scan_id = ?;`,
            [scan_id]
        );
        return result ?? null;
    },

    // Update existing ScanSession record status
    updateStatus: async (scan_id: string, status: string, ended_at?: string): Promise<void> => {
        await db.runAsync(
    `UPDATE ScanSession SET status = ?, ended_at = ? WHERE scan_id = ?`,
            [status, ended_at ?? null, scan_id]
        );
    },

    // Delete a ScanSession record by its scan_id
    deleteById: async(scan_id: string): Promise<void> => {
        await db.runAsync(
    `DELETE FROM ScanSession WHERE scan_id = ?;`,
            [scan_id]
        );
    }
};