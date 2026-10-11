import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { cardShadow, ColorScheme, Palette, radius, size, space, type } from "@/theme/tokens";

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

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
          color={colors.accent}
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const progress =
    typeof metric.progress === "number"
      ? Math.max(0, Math.min(100, Math.round(metric.progress)))
      : undefined;

  const content = (
    <>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons
          name={metric.icon}
          size={size.iconSm}
          color={colors.accent}
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
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.metricCard,
        pressed && styles.pressedCard,
      ]}
    >
      {content}
    </Pressable>
  );
}

const makeStyles = (colors: Palette, scheme: ColorScheme) => StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space[4],
  },
  title: {
    ...type.sectionTitle,
    color: colors.ink,
  },
  date: {
    ...type.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricCard: {
    width: "48%",
    minHeight: 132,
    padding: space[4],
    marginBottom: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...cardShadow(scheme),
  },
  pressedCard: {
    opacity: 0.78,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: space[3],
  },
  label: {
    ...type.label,
    color: colors.inkMuted,
    marginLeft: space[2],
  },
  value: {
    ...type.value,
    color: colors.ink,
  },
  detail: {
    ...type.caption,
    color: colors.inkMuted,
    marginTop: space[1],
  },
  progressTrack: {
    height: 5,
    borderRadius: radius.full,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    marginTop: space[3],
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  // Sits inside the Home wellness card, so it is a raised well rather than a nested card.
  emptyCard: {
    padding: space[4],
    marginBottom: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  emptyTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    marginBottom: space[1],
  },
  disclaimer: {
    ...type.finePrint,
    color: colors.inkSubtle,
    marginTop: space[1],
  },
});
