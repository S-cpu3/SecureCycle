import * as SQLite from "expo-sqlite";

// TypeScript Model
export interface Report {
    report_id: string;      // UUID
    scan_id: string;        // FK to ScanSession
    summary: string;        // JSON text
    created_at: string;     // ISO timestamp
    severity: string;       // "safe" | "suspicious" | "danger"
}

export type NewReport = Omit<Report, "created_at"> & { created_at?: string };

// DB Connection
const db = await SQLite.openDatabaseAsync("stealthdetect.db");

export const ReportDao = {
    save: async (report: Report | NewReport): Promise<void> => {
        const { report_id, scan_id, summary, created_at, severity } = report;

        await db.runAsync(
            `INSERT OR REPLACE INTO Report (report_id, scan_id, summary, created_at, severity)
             VALUES (?, ?, ?, ?, ?);`,
            [report_id, scan_id, summary, created_at ?? new Date().toISOString(), severity]
        );
    },

    getByScanId: async (scan_id: string): Promise<Report[]> => {
        const results = await db.getAllAsync<Report>(
            `SELECT * FROM Report WHERE scan_id = ? ORDER BY created_at DESC;`,
            [scan_id]
        );
        return results ?? [];
    },

    getById: async (report_id: string): Promise<Report | null> => {
        const result = await db.getFirstAsync<Report>(
            `SELECT * FROM Report WHERE report_id = ?;`,
            [report_id]
        );
        return result ?? null;
    },

    deleteById: async (report_id: string): Promise<void> => {
        await db.runAsync(`DELETE FROM Report WHERE report_id = ?;`, [report_id]);
    }
};