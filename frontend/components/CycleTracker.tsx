import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Text } from "react-native-paper";
import { theme } from "@/theme/theme";

const DIAMETER = 300;
const RADIUS = DIAMETER / 2;
const CENTER_SIZE = 194;
const DAY_SIZE = 26;

export type CycleDayStatus = "period" | "fertile" | "ovulation" | "luteal";

export type CycleDay = {
  day: number;
  status: CycleDayStatus;
};

type CycleTrackerProps = {
  monthLabel: string;
  dayLabel: string;
  statusLabel: string;
  subtitle: string;
  days: CycleDay[];
};

const STATUS_STYLES: Record<CycleDayStatus, { backgroundColor: string; color: string; icon: ReactNode }> = {
  period: {
    backgroundColor: "rgba(173, 38, 58, 0.95)",
    color: theme.colors.text,
    icon: <Entypo name="drop" size={16} color={theme.colors.text} />,
  },
  fertile: {
    backgroundColor: "rgba(219, 69, 123, 0.45)",
    color: theme.colors.text,
    icon: <MaterialCommunityIcons name={"star-four-points" as any} size={16} color={theme.colors.text} />,
  },
  ovulation: {
    backgroundColor: theme.colors.secondary,
    color: theme.colors.background,
    icon: <MaterialCommunityIcons name="radiology-box" size={16} color={theme.colors.background} />,
  },
  luteal: {
    backgroundColor: "rgba(244, 243, 238, 0.14)",
    color: theme.colors.text,
    icon: <MaterialCommunityIcons name="circle-small" size={16} color={theme.colors.text} />,
  },
};

export default function CycleTracker({
  monthLabel,
  dayLabel,
  statusLabel,
  subtitle,
  days,
}: CycleTrackerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.outerRing}>
        {days.map((day, index) => {
          const angle = (2 * Math.PI * index) / days.length - Math.PI / 2;
          const distance = RADIUS - 10;
          const x = distance * Math.cos(angle) + RADIUS - DAY_SIZE / 2;
          const y = distance * Math.sin(angle) + RADIUS - DAY_SIZE / 2;
          const status = STATUS_STYLES[day.status];

          return (
            <View
              key={day.day}
              style={[
                styles.dayNode,
                {
                  left: x,
                  top: y,
                  backgroundColor: status.backgroundColor,
                },
              ]}
            >
              {status.icon}
            </View>
          );
        })}

        <View style={styles.centerCard}>
          <Text style={styles.monthText}>{monthLabel}</Text>
          <Text style={styles.dayText}>{dayLabel}</Text>
          <Text style={styles.statusText}>{statusLabel}</Text>
          <Text style={styles.subtitleText}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  outerRing: {
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: DIAMETER / 2,
    backgroundColor: "rgba(188, 184, 177, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.16)",
  },
  dayNode: {
    position: "absolute",
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.14)",
  },
  centerCard: {
    position: "absolute",
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    left: RADIUS - CENTER_SIZE / 2,
    top: RADIUS - CENTER_SIZE / 2,
    backgroundColor: "rgba(38, 12, 26, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.16)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.medium,
  },
  monthText: {
    color: "rgba(244, 243, 238, 0.72)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 12,
    marginBottom: 6,
  },
  dayText: {
    color: theme.colors.text,
    fontSize: 50,
    fontWeight: "700",
    lineHeight: 54,
  },
  statusText: {
    color: theme.colors.secondary,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  subtitleText: {
    color: "rgba(244, 243, 238, 0.8)",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 6,
  },
});
