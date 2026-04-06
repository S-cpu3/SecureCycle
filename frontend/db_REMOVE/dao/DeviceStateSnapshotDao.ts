import * as SQLite from "expo-sqlite";

// Model
export interface DeviceStateSnapshot {
    snapshot_id: string;     // UUID
    scan_id: string;         // FK
    battery_level: number;   // 0-100
    network_type: string;    // wifi | cellular | unknown
    ip_address: string;
    created_at: string;
    raw_json?: string;       // optional raw dump
}

export type NewDeviceStateSnapshot = Omit<DeviceStateSnapshot, "created_at"> & { created_at?: string };

const db = await SQLite.openDatabaseAsync("stealthdetect.db");

export const DeviceStateSnapshotDao = {
    save: async (snap: DeviceStateSnapshot | NewDeviceStateSnapshot): Promise<void> => {
        const { snapshot_id, scan_id, battery_level, network_type, ip_address, created_at, raw_json } = snap;

        await db.runAsync(
            `INSERT OR REPLACE INTO DeviceStateSnapshot
            (snapshot_id, scan_id, battery_level, network_type, ip_address, created_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [
                snapshot_id,
                scan_id,
                battery_level,
                network_type,
                ip_address,
                created_at ?? new Date().toISOString(),
                raw_json ?? null
            ]
        );
    },

    getByScanId: async (scan_id: string): Promise<DeviceStateSnapshot[]> => {
        const results = await db.getAllAsync<DeviceStateSnapshot>(
            `SELECT * FROM DeviceStateSnapshot WHERE scan_id = ? ORDER BY created_at DESC;`,
            [scan_id]
        );
        return results ?? [];
    },

    deleteByScanId: async (scan_id: string): Promise<void> => {
        await db.runAsync(`DELETE FROM DeviceStateSnapshot WHERE scan_id = ?;`, [scan_id]);
    }
};