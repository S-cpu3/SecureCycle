// Imports
import * as SQLite from "expo-sqlite";

// TypeScript Model: Represents a single IOC match record
export interface IOCMatch {
    match_id: string; // UUID
    scan_id: string;  // UUID linking to ScanSession
    indicator_type: string;
    indicator_value: string;
    source: string;
    rule_version: string;
    confidence: number; // float
    severity: string;   // "low" | "medium" | "high" | etc.
}

// Allow optional fields when first creating a match record
export type NewIOCMatch = IOCMatch;

// Init: Database connection
const db = await SQLite.openDatabaseAsync("stealthdetect.db");

// DAO Functions: CRUD operations for IOCMatch table
export const IOCMatchDao = {
    // Create/Add IOCMatch
    save: async(match: NewIOCMatch): Promise<void> => {
        const {
            match_id, scan_id, indicator_type,
            indicator_value, source, rule_version,
            confidence, severity
        } = match;

        await db.runAsync(
            `INSERT OR REPLACE INTO IOCMatch 
        (match_id, scan_id, indicator_type, indicator_value, source, rule_version, confidence, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            [
                match_id, scan_id, indicator_type,
                indicator_value, source, rule_version,
                confidence, severity
            ]);
    },

    // Get all IOC matches for a scan
    getByScanId: async(scan_id: string): Promise<IOCMatch[]> => {
        const result = await db.getAllAsync<IOCMatch>(
            `SELECT * FROM IOCMatch WHERE scan_id = ? ORDER BY severity DESC;`,
            [scan_id]
        );
        return result ?? [];
    },

    // Get single IOC match
    getById: async(match_id: string): Promise<IOCMatch | null> => {
        const result = await db.getFirstAsync<IOCMatch>(
            `SELECT * FROM IOCMatch WHERE match_id = ?;`,
            [match_id]
        );
        return result ?? null;
    },

    // Delete match
    deleteById: async(match_id: string): Promise<void> => {
        await db.runAsync(
            `DELETE FROM IOCMatch WHERE match_id = ?;`,
            [match_id]
        );
    }
};
