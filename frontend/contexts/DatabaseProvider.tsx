import React, { createContext, useEffect, useState } from "react";
import * as SQLite from "expo-sqlite";

interface LayoutProps {
  children: React.ReactNode;
}

export const DatabaseContext = createContext<SQLite.SQLiteDatabase | null>(null);

export function DatabaseProvider({ children }: LayoutProps) {
  const [ready, setReady] = useState<boolean>(false);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  
  useEffect(() => {
    async function init() {
      const database = await SQLite.openDatabaseAsync("safecycle.db");

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS cycles (
          id INTEGER PRIMARY KEY AUTOINCREMENT
        );
      `);

      setDb(database);
      setReady(true);
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
