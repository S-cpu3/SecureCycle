import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import CycleTracker, { CycleDay } from "@/components/CycleTracker";
import { theme } from "@/theme/theme";
import { useDatabase } from "@/hooks/use-database";
import {
  getHomeCycleData,
  HomeCycleData,
  HomeCycleState,
} from "@/dao/cycleDao";
import { ensurePrimaryUser } from "@/dao/userDao";

export const metadata = {
  title: "Home",
};

function buildDays(data: HomeCycleData): CycleDay[] {
  return Array.from({ length: data.cycleLength }, (_, index) => {
    const day = index + 1;

    if (day === data.ovulationDay) {
      return { day, status: "ovulation" };
    }

    if (data.periodDays.includes(day)) {
      return { day, status: "period" };
    }

    if (data.fertileDays.includes(day)) {
      return { day, status: "fertile" };
    }

    return { day, status: "luteal" };
  });
}

export default function Index() {
  const db = useDatabase();
  const [data, setData] = useState<HomeCycleState>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);

      async function load() {
        const user = await ensurePrimaryUser(db);
        const cycleData = await getHomeCycleData(db, user.user_id);
        setData(cycleData);
        setIsLoading(false);
      }

      load().catch((error) => {
        console.error("Failed to load cycle data", error);
        setIsLoading(false);
      });
    }, [db]),
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.secondary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.title}>Your cycle</Text>
        <Text style={styles.emptyText}>
          Log a period in History to start tracking.
        </Text>
        <Button
          mode="contained"
          style={styles.emptyButton}
          onPress={() => router.push("/(tabs)/history")}
        >
          Open History
        </Button>
      </View>
    );
  }

  const days = buildDays(data);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your cycle</Text>
        <Text style={styles.subtitle}>{data.phaseDetail}</Text>
      </View>

      <View style={styles.trackerWrap}>
        <CycleTracker
          label="Cycle day"
          dayLabel={`${data.currentCycleDay}`}
          statusLabel={data.phaseLabel}
          subtitle={`${data.currentDateLabel} · Day ${data.currentCycleDay} of ${data.cycleLength}`}
          days={days}
          currentDay={data.currentCycleDay}
        />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <MaterialCommunityIcons
            name="water"
            size={20}
            color={theme.colors.secondary}
          />
          <Text style={styles.summaryValue}>{data.periodDays.length} days</Text>
          <Text style={styles.summaryLabel}>Period</Text>
        </View>
        <View style={styles.summaryCard}>
          <MaterialCommunityIcons
            name={"star-four-points" as any}
            size={20}
            color={theme.colors.secondary}
          />
          <Text style={styles.summaryValue}>
            {data.fertileDays.length} days
          </Text>
          <Text style={styles.summaryLabel}>Fertile</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardLast]}>
          <MaterialCommunityIcons
            name="calendar-heart"
            size={20}
            color={theme.colors.secondary}
          />
          <Text style={styles.summaryValue}>Day {data.ovulationDay}</Text>
          <Text style={styles.summaryLabel}>Ovulation</Text>
        </View>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Recent logs</Text>
        {data.entries.map((entry) => (
          <View
            key={`${entry.date}-${entry.entry_type}-${entry.symptom_type ?? "base"}`}
            style={styles.timelineRow}
          >
            <View style={styles.timelineDot} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineHeading}>
                {entry.entry_type === "period" ? "Period" : "Symptom"} ·{" "}
                {entry.date}
              </Text>
              <Text style={styles.timelineBody}>
                {entry.notes ||
                  entry.symptom_type ||
                  entry.intensity ||
                  "Logged"}
              </Text>
            </View>
          </View>
        ))}
      </View>
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.large,
    backgroundColor: theme.colors.background,
  },
  emptyText: {
    color: "rgba(244, 243, 238, 0.78)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: theme.spacing.small,
    marginBottom: theme.spacing.large,
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness * 3,
  },
  header: {
    marginBottom: theme.spacing.large,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(244, 243, 238, 0.78)",
    fontSize: 15,
    lineHeight: 22,
  },
  trackerWrap: {
    alignItems: "center",
    marginBottom: theme.spacing.large,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.large,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderRadius: theme.roundness * 2,
    padding: theme.spacing.medium,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
    marginRight: 10,
  },
  summaryCardLast: {
    marginRight: 0,
  },
  summaryValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  summaryLabel: {
    color: "rgba(244, 243, 238, 0.7)",
    fontSize: 12,
    lineHeight: 16,
  },
  timelineCard: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderRadius: theme.roundness * 3,
    padding: theme.spacing.medium,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  timelineTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: theme.spacing.medium,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: theme.spacing.medium,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.secondary,
    marginTop: 6,
    marginRight: theme.spacing.small,
  },
  timelineText: {
    flex: 1,
  },
  timelineHeading: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  timelineBody: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 13,
    lineHeight: 18,
  },
});
