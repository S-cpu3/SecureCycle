import React, { createContext, useEffect, useState } from "react"
import { createAllTables } from "./schema";
import * as SQLite from "expo-sqlite";

interface LayoutProps {
  children: React.ReactNode;
}

export const DatabaseContext = createContext<SQLite.SQLiteDatabase | null>(null);

const TARGET_VERSION = 1;

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;

  if (current < 1) {
    await db.withTransactionAsync(async () => {
      // Drop old stub table — no real user data existed before v1
      await db.execAsync("DROP TABLE IF EXISTS cycles;");
      // Create all tables from schema
      await db.execAsync(createAllTables);
      // Seed the single device-user row
      await db.runAsync(
        "INSERT OR IGNORE INTO Users (user_id, auth_type, created_at) VALUES (1, 'local', ?)",
        [new Date().toISOString()]
      );
      await db.execAsync(`PRAGMA user_version = ${TARGET_VERSION};`);
    });
  }
  // Future migrations go here — always ALTER TABLE, never DROP TABLE:
  // if (current < 2) { await db.execAsync(`ALTER TABLE Entries ADD COLUMN custom_note TEXT; PRAGMA user_version = 2;`); }
}

export function DatabaseProvider({ children }: LayoutProps) {
  const [ready, setReady] = useState<boolean>(false);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const database = await SQLite.openDatabaseAsync('safecycle.db');
        await runMigrations(database);
        setDb(database);
      } catch (error) {
        console.error("Failed to initialize database", error);
      } finally {
        setReady(true);
      }
    }
    init();
  }, []);

  if (!ready) return null;

  return (
    <DatabaseContext.Provider value={db}>
      {children}
    </DatabaseContext.Provider>
  );
}
