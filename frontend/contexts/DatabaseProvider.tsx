import React, { createContext, useEffect, useState } from "react"
import { createAllTables } from "./schema";
import * as SQLite from "expo-sqlite";
import { ensurePrimaryUser } from "@/dao/userDao";
import { ensureSecuritySettings } from "@/dao/securityDao";

interface LayoutProps {
  children: React.ReactNode;
}

export const DatabaseContext = createContext<SQLite.SQLiteDatabase | null>(null);

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string
) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);

  if (!columns.some((column) => column.name === columnName)) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

export function DatabaseProvider({ children }: LayoutProps) {
  const [ready, setReady] = useState<boolean>(false);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  
  useEffect(() => {
    async function init() {
      
      // Try-Catch to open the database and create tables if they don't exist
      try {
        const database = await SQLite.openDatabaseAsync('safecycle.db');
        await database.execAsync(createAllTables);
        await ensureColumn(database, "Users", "pin_salt", "TEXT");
        await ensureColumn(database, "Users", "birth_date", "TEXT");
        const user = await ensurePrimaryUser(database);
        await ensureSecuritySettings(database, user.user_id);
        setDb(database);
      } catch (error) {
        console.error("Failed to initialize database", error);

      // Finally block to ensure we set the provider as ready even if there was an error
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
