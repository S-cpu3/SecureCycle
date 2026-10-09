import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { theme } from "@/theme/theme";

export type HealthMetric = {
  id: "sleep" | "hydration" | "movement" | "mood" | "other";
  label: string;
  value: string;
  detail?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Optional 0–100 progress, such as progress toward the user's own goal. */
  progress?: number;
};

type HealthOverviewProps = {
  dateLabel: string;
  metrics: HealthMetric[];
  onMetricPress?: (metric: HealthMetric) => void;
};

export default function HealthOverview({
  dateLabel,
  metrics,
  onMetricPress,
}: HealthOverviewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Daily health</Text>
          <Text style={styles.date}>{dateLabel}</Text>
        </View>
        <MaterialCommunityIcons
          name="heart-pulse"
          size={26}
          color={theme.colors.secondary}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>

      {metrics.length > 0 ? (
        <View style={styles.grid}>
          {metrics.map((metric) => (
            <MetricCard
              key={metric.id}
              metric={metric}
              onPress={
                onMetricPress
                  ? () => onMetricPress(metric)
                  : undefined
              }
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No check-in yet</Text>
          <Text style={styles.detail}>
            Add a daily health check-in to see your overview here.
          </Text>
        </View>
      )}

      <Text style={styles.disclaimer}>
        A personal wellness check-in, not a diagnosis.
      </Text>
    </View>
  );
}

function MetricCard({
  metric,
  onPress,
}: {
  metric: HealthMetric;
  onPress?: () => void;
}) {
  const progress =
    typeof metric.progress === "number"
      ? Math.max(0, Math.min(100, Math.round(metric.progress)))
      : undefined;

  const content = (
    <>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons
          name={metric.icon}
          size={21}
          color={theme.colors.secondary}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={styles.label}>{metric.label}</Text>
      </View>

      <Text style={styles.value} numberOfLines={1}>
        {metric.value}
      </Text>

      {metric.detail ? (
        <Text style={styles.detail} numberOfLines={2}>
          {metric.detail}
        </Text>
      ) : null}

      {progress !== undefined ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${metric.label} progress`}
          accessibilityValue={{ min: 0, max: 100, now: progress }}
          style={styles.progressTrack}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%` },
            ]}
          />
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.metricCard}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${metric.label}: ${metric.value}${
        metric.detail ? `, ${metric.detail}` : ""
      }`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCard,
        pressed && styles.pressedCard,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.medium,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  date: {
    color: "rgba(244, 243, 238, 0.68)",
    fontSize: 13,
    marginTop: 3,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricCard: {
    width: "48%",
    minHeight: 132,
    padding: theme.spacing.medium,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.14)",
    backgroundColor: "rgba(188, 184, 177, 0.10)",
  },
  pressedCard: {
    opacity: 0.78,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    color: "rgba(244, 243, 238, 0.78)",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 8,
  },
  value: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  detail: {
    color: "rgba(244, 243, 238, 0.64)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(244, 243, 238, 0.16)",
    marginTop: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: theme.colors.secondary,
  },
  emptyCard: {
    padding: theme.spacing.medium,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.14)",
    backgroundColor: "rgba(188, 184, 177, 0.10)",
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
  },
  disclaimer: {
    color: "rgba(244, 243, 238, 0.52)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
});
