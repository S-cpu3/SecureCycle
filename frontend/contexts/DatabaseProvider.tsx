import React, { createContext, useEffect, useState } from "react"
import { Platform, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { theme } from "@/theme/theme";
import { createAllTables } from "./schema";
import * as SQLite from "expo-sqlite";
import { ensurePrimaryUser } from "@/dao/userDao";
import { ensureSecuritySettings } from "@/dao/securityDao";
import { ensureDuressColumns } from "@/dao/duressDao";

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

// Share initialization across concurrent mounts (including development effect
// remounts). Never substitute an empty database when persistent storage fails.
let initialization: Promise<SQLite.SQLiteDatabase> | null = null;

function initializeDatabase() {
  if (!initialization) {
    initialization = (async () => {
      let database: SQLite.SQLiteDatabase | null = null;
      try {
        database = await SQLite.openDatabaseAsync("safecycle.db");
        await database.execAsync(createAllTables);
        await ensureColumn(database, "Users", "pin_salt", "TEXT");
        await ensureColumn(database, "Users", "birth_date", "TEXT");
        await ensureDuressColumns(database);
        const user = await ensurePrimaryUser(database);
        await ensureSecuritySettings(database, user.user_id);
        return database;
      } catch (error) {
        if (database) {
          await database.closeAsync().catch(() => undefined);
        }
        throw error;
      }
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

export function DatabaseProvider({ children }: LayoutProps) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    initializeDatabase().then((database) => {
      if (active) setDb(database);
    }).catch((failure: unknown) => {
      console.error("Failed to initialize database", failure);
      if (!active) return;
      const message = failure instanceof Error ? failure.message : String(failure);
      const browserConflict = Platform.OS === "web" &&
        /NoModificationAllowedError|createSyncAccessHandle|Access Handle/i.test(message);
      setError(browserConflict
        ? "Another SecureCycle browser tab may be using local storage. Close other SecureCycle tabs, then try again. The browser preview supports one open tab at a time."
        : "SecureCycle could not open local storage. Check that your device has available storage, then try again.");
    });
    return () => { active = false; };
  }, [attempt]);

  if (!db) {
    return (
      <View style={styles.status}>
        {error ? (
          <>
            <Text variant="headlineSmall">Unable to open local storage</Text>
            <Text style={styles.message}>{error}</Text>
            <Button mode="contained" onPress={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}>Try again</Button>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" />
            <Text style={styles.message}>Opening your on-device data…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={db}>
      {children}
    </DatabaseContext.Provider>
  );
}

const styles = StyleSheet.create({
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 16,
    backgroundColor: theme.colors.background,
  },
  message: { textAlign: "center", maxWidth: 440 },
});
