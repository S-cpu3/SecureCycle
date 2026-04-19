import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";

import CycleTracker from "@/components/CycleTracker";
import { usePrediction } from "@/hooks/use-prediction";
import { useDatabase } from "@/hooks/use-database";
import { CycleDao } from "@/services/dao/CycleDao";
import { fromISO, type ISODateString } from "@/types/models";
import { theme } from "@/theme/theme";

type CycleStatsState = {
  cyclesLogged: number;
  avgCycleLength: number | null;
  stdDev: number | null;
  lastPeriodStart: ISODateString | null;
};

export default function HomeScreen() {
  const db = useDatabase();
  const { prediction, loading, error } = usePrediction();
  const [stats, setStats] = useState<CycleStatsState | null>(null);

  useEffect(() => {
    let isMounted = true;

    CycleDao.computeStats(db)
      .then((nextStats) => {
        if (isMounted) {
          setStats(nextStats);
        }
      })
      .catch((loadError) => {
        console.error("Failed to load cycle statistics", loadError);
      });

    return () => {
      isMounted = false;
    };
  }, [db]);

  const lastPeriodStart = useMemo(() => {
    if (!stats?.lastPeriodStart) {
      return null;
    }

    return fromISO(stats.lastPeriodStart);
  }, [stats]);

  const nextPeriodLabel = useMemo(() => {
    if (!prediction) {
      return "Add a few period logs to unlock a forecast.";
    }

    if (prediction.showRangeOnly) {
      return `${prediction.earliest.toLocaleDateString()} - ${prediction.latest.toLocaleDateString()}`;
    }

    return prediction.predicted.toLocaleDateString();
  }, [prediction]);

  const fertilityLabel = useMemo(() => {
    if (!prediction) {
      return "Unavailable";
    }

    if (!prediction.fertileStart || !prediction.fertileEnd) {
      return "Suppressed for current profile";
    }

    return `${prediction.fertileStart.toLocaleDateString()} - ${prediction.fertileEnd.toLocaleDateString()}`;
  }, [prediction]);

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.secondary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Your cycle</Text>
      <Text style={styles.subtitle}>
        {error ? "Prediction is temporarily unavailable, but your saved data is still intact." : "A quick view of today and what comes next."}
      </Text>

      <View style={styles.trackerWrap}>
        <CycleTracker prediction={prediction} lastPeriodStart={lastPeriodStart} />
      </View>

      <View style={styles.cardRow}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardLabel}>Next period</Text>
            <Text style={styles.cardValue}>{nextPeriodLabel}</Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardLabel}>Fertile window</Text>
            <Text style={styles.cardValue}>{fertilityLabel}</Text>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.detailCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Prediction details</Text>
          <Text style={styles.detailText}>
            {prediction
              ? `Confidence: ${Math.round(prediction.confidenceScore)}%. Estimated cycle length: ${Math.round(prediction.cycleLength)} days.`
              : "No forecast yet. Once the app has enough cycle history, this section will populate automatically."}
          </Text>
          <Text style={styles.detailText}>
            {stats?.cyclesLogged
              ? `Logged cycles: ${stats.cyclesLogged}${stats.avgCycleLength ? ` • Average length: ${Math.round(stats.avgCycleLength)} days` : ""}`
              : "No completed cycles saved yet."}
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.medium,
    paddingTop: theme.spacing.large,
    paddingBottom: theme.spacing.large,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: theme.spacing.large,
  },
  trackerWrap: {
    alignItems: "center",
    marginBottom: theme.spacing.large,
  },
  cardRow: {
    gap: 12,
  },
  card: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  cardLabel: {
    color: "rgba(244, 243, 238, 0.68)",
    fontSize: 13,
    marginBottom: 8,
  },
  cardValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  detailCard: {
    marginTop: theme.spacing.medium,
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  detailText: {
    color: "rgba(244, 243, 238, 0.78)",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
});
