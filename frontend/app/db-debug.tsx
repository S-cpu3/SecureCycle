import React, { useCallback, useContext, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Divider, Text } from "react-native-paper";
import { DatabaseContext } from "@/contexts/DatabaseProvider";

type TableRow = { name: string };
type CountRow = { count: number };
type DatabaseFileRow = { file: string };

export default function DbDebugScreen() {
  const db = useContext(DatabaseContext);
  const [loading, setLoading] = useState<boolean>(false);
  const [tables, setTables] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dbFilePath, setDbFilePath] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Health check: queries sqlite_master for all tables and counts rows in Users, Cycles, and Entries.
  const runHealthCheck = useCallback(async () => {
    if (!db) {
      setError("Database context is not ready.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const dbFileRow = await db.getFirstAsync<DatabaseFileRow>(`
        SELECT file FROM pragma_database_list WHERE name = 'main';
      `);

      const tableRows = await db.getAllAsync<TableRow>(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
      `);

      const tableNames = tableRows.map((row) => row.name);
      const nextCounts: Record<string, number> = {};

      for (const tableName of ["Users", "Cycles", "Entries"]) {
        const row = await db.getFirstAsync<CountRow>(`SELECT COUNT(*) as count FROM ${tableName};`);
        nextCounts[tableName] = row?.count ?? 0;
      }

      setTables(tableNames);
      setCounts(nextCounts);
      setDbFilePath(dbFileRow?.file ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown DB health-check error");
    } finally {
      setLoading(false);
    }
  }, [db]);

  // Runs the health check automatically on mount.
  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>DB Debug</Text>

      {/* Status card: connection info, DB file path, error message, and manual re-run button */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Status</Text>
          <Divider style={styles.divider} />
          <Text>{db ? "Database connected" : "Database not ready"}</Text>
          <Text>DB File: {dbFilePath || "Not available yet"}</Text>
          {error ? <Text style={styles.error}>Error: {error}</Text> : null}
          <Button mode="contained" style={styles.button} onPress={runHealthCheck} loading={loading}>
            Run Health Check
          </Button>
        </Card.Content>
      </Card>

      {/* Tables card: lists every non-system SQLite table found in the database */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Discovered Tables</Text>
          <Divider style={styles.divider} />
          {tables.length === 0 ? (
            <Text>No tables found.</Text>
          ) : (
            tables.map((tableName) => (
              <View key={tableName} style={styles.row}>
                <Text>{tableName}</Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* Row counts card: Users, Cycles, and Entries totals */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Core Row Counts</Text>
          <Divider style={styles.divider} />
          {(["Users", "Cycles", "Entries"] as const).map((name) => (
            <View key={name} style={styles.row}>
              <Text>{name}</Text>
              <Text>{counts[name] ?? 0}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f6f6f6",
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  divider: {
    marginBottom: 12,
  },
  button: {
    marginTop: 12,
    borderRadius: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  error: {
    color: "#b00020",
    marginTop: 8,
  },
});
