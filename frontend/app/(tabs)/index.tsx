import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";
import CycleTracker, { CycleDay } from "@/components/CycleTracker";
import HealthOverview, { HealthMetric } from "@/components/healthOverview";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { cardShadow, ColorScheme, Palette, radius, size, space, type } from "@/theme/tokens";
import { useDatabase } from "@/hooks/use-database";
import { getHomeCycleData, HomeCycleData, HomeCycleState } from "@/dao/cycleDao";
import { ensurePrimaryUser } from "@/dao/userDao";
import {
  getWellnessCheckIn,
  localDateKey,
  WELLNESS_MOOD_LABELS,
  WellnessCheckIn,
} from "@/dao/wellnessDao";

export const metadata = {
  title: "Home",
};

// Maps HomeCycleData from the DAO into the flat CycleDay array that CycleTracker expects.
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

function buildWellnessMetrics(checkIn: WellnessCheckIn | null): HealthMetric[] {
  if (!checkIn) {
    return [];
  }

  const metrics: HealthMetric[] = [
    {
      id: "mood",
      label: "Mood",
      value: WELLNESS_MOOD_LABELS[checkIn.mood],
      icon: "emoticon-outline",
    },
    {
      id: "other",
      label: "Energy",
      value: `${checkIn.energy} / 5`,
      icon: "lightning-bolt-outline",
    },
  ];

  if (checkIn.sleep_hours !== null) {
    metrics.push({
      id: "sleep",
      label: "Sleep",
      value: `${checkIn.sleep_hours} hrs`,
      icon: "sleep",
    });
  }

  if (checkIn.water_glasses !== null) {
    metrics.push({
      id: "hydration",
      label: "Water",
      value: `${checkIn.water_glasses} glasses`,
      icon: "cup-water",
    });
  }

  return metrics;
}

function WellnessSummary({ checkIn }: { checkIn: WellnessCheckIn | null }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={styles.wellnessSummary}>
      <HealthOverview
        dateLabel={dateLabel}
        metrics={buildWellnessMetrics(checkIn)}
      />
      <Button
        mode="outlined"
        textColor={colors.ink}
        onPress={() => router.push("/(tabs)/wellness")}
        style={styles.wellnessButton}
      >
        {checkIn ? "Update today’s check-in" : "Start today’s check-in"}
      </Button>
    </View>
  );
}

export default function Index() {
  const db = useDatabase();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [data, setData] = useState<HomeCycleState>(null);
  const [todayWellness, setTodayWellness] = useState<WellnessCheckIn | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data loading: re-runs on every tab focus so the ring stays current.
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);

      async function load() {
        const user = await ensurePrimaryUser(db);
        const cycleData = await getHomeCycleData(db, user.user_id);
        const wellnessCheckIn = await getWellnessCheckIn(
          db,
          user.user_id,
          localDateKey()
        );
        setData(cycleData);
        setTodayWellness(wellnessCheckIn);
        setIsLoading(false);
      }

      load().catch((error) => {
        console.error("Failed to load cycle data", error);
        setIsLoading(false);
      });
    }, [db])
  );

  // Loading spinner while data is being fetched; empty state if no cycle is logged yet.
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyHeader}>
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
        <WellnessSummary checkIn={todayWellness} />
      </ScrollView>
    );
  }

  const days = buildDays(data);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Header: current phase title and detail description */}
      <View style={styles.header}>
        <Text style={styles.title}>Your cycle</Text>
        <Text style={styles.subtitle}>{data.phaseDetail}</Text>
      </View>

      {/* Cycle ring: visual day-by-day breakdown of the current cycle */}
      <View style={styles.trackerWrap}>
        <CycleTracker
          monthLabel={new Date().toLocaleString(undefined, { month: "long" })}
          dayLabel={`${data.currentCycleDay}`}
          statusLabel={data.phaseLabel}
          subtitle={data.currentDateLabel}
          days={days}
        />
      </View>

      {/* Summary stat cards: period length, fertile window, and ovulation day */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <MaterialCommunityIcons name="water" size={size.iconSm} color={colors.accent} />
          <Text style={styles.summaryValue}>{data.periodDays.length} days</Text>
          <Text style={styles.summaryLabel}>Period</Text>
        </View>
        <View style={styles.summaryCard}>
          <MaterialCommunityIcons name={"star-four-points" as any} size={size.iconSm} color={colors.accent} />
          <Text style={styles.summaryValue}>{data.fertileDays.length} days</Text>
          <Text style={styles.summaryLabel}>Fertile</Text>
        </View>
        <View style={styles.summaryCard}>
          <MaterialCommunityIcons name="calendar-heart" size={size.iconSm} color={colors.accent} />
          <Text style={styles.summaryValue}>Day {data.ovulationDay}</Text>
          <Text style={styles.summaryLabel}>Ovulation</Text>
        </View>
      </View>

      {/* Recent log timeline: last few period/symptom entries from the database */}
      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Recent logs</Text>
        {data.entries.map((entry) => (
          <View key={`${entry.date}-${entry.entry_type}-${entry.symptom_type ?? "base"}`} style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineHeading}>
                {entry.entry_type === "period" ? "Period" : "Symptom"} · {entry.date}
              </Text>
              <Text style={styles.timelineBody}>{entry.notes || entry.symptom_type || entry.intensity || "Logged"}</Text>
            </View>
          </View>
        ))}
      </View>

      <WellnessSummary checkIn={todayWellness} />
    </ScrollView>
  );
}

const makeStyles = (colors: Palette, scheme: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: space[4],
    paddingTop: space[6],
    paddingBottom: space[8],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  emptyHeader: {
    marginBottom: space[6],
  },
  emptyText: {
    ...type.body,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: space[2],
    marginBottom: space[6],
  },
  emptyButton: {
    borderRadius: radius.lg,
  },
  wellnessSummary: {
    marginTop: space[6],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(scheme),
  },
  wellnessButton: {
    marginTop: space[4],
    borderRadius: radius.lg,
    borderColor: colors.borderStrong,
  },
  header: {
    marginBottom: space[6],
  },
  title: {
    ...type.screenTitle,
    color: colors.ink,
    marginBottom: space[2],
  },
  subtitle: {
    ...type.body,
    color: colors.inkMuted,
  },
  trackerWrap: {
    alignItems: "center",
    marginBottom: space[6],
  },
  summaryRow: {
    flexDirection: "row",
    gap: space[3],
    marginBottom: space[6],
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space[4],
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(scheme),
  },
  summaryValue: {
    ...type.bodyStrong,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.ink,
    marginTop: space[3],
    marginBottom: space[1],
  },
  summaryLabel: {
    ...type.caption,
    color: colors.inkMuted,
  },
  timelineCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space[4],
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(scheme),
  },
  timelineTitle: {
    ...type.cardTitle,
    color: colors.ink,
    marginBottom: space[4],
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: space[4],
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    marginTop: 6,
    marginRight: space[2],
  },
  timelineText: {
    flex: 1,
  },
  timelineHeading: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 2,
  },
  timelineBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
  },
});
