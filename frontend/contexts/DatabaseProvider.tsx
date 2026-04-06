import React, { createContext, useEffect, useState } from "react"
import { createAllTables } from "./schema";
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
      
      // Try-Catch to open the database and create tables if they don't exist
      try {
        const database = await SQLite.openDatabaseAsync('safecycle.db');
        await database.execAsync(createAllTables);
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
