import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { PredictionResult } from "@/engine/predictionEngine";
import { theme } from "@/theme/theme";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DIAMETER = 300;
const RADIUS = DIAMETER / 2;
const DAY_SIZE = 30;
const DAYS_IN_RING = 30;
const DISTANCE_FROM_EDGE = 16;
const CENTER_SIZE = 220;
const DAYS = Array.from({ length: DAYS_IN_RING }, (_, index) => index + 1);

type DayType = "period" | "ovulation" | "fertile" | "pms" | "predicted" | "normal";

interface CycleTrackerProps {
  prediction: PredictionResult | null;
  lastPeriodStart?: Date | null;
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function isWithin(date: Date, start: Date | null, end: Date | null) {
  if (!start || !end) {
    return false;
  }

  const value = date.getTime();
  return value >= start.getTime() && value <= end.getTime();
}

function getDayType(dayOfMonth: number, today: Date, prediction: PredictionResult | null): DayType {
  if (!prediction) {
    return "normal";
  }

  const date = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);

  if (isWithin(date, prediction.fertileStart, prediction.fertileEnd)) {
    return "fertile";
  }

  if (prediction.ovulationDate && isSameDay(date, prediction.ovulationDate)) {
    return "ovulation";
  }

  if (date.getTime() >= prediction.pmsStart.getTime() && date.getTime() < prediction.predicted.getTime()) {
    return "pms";
  }

  if (isWithin(date, prediction.earliest, prediction.latest)) {
    return "predicted";
  }

  return "normal";
}

function getPhaseLabel(today: Date, prediction: PredictionResult | null) {
  if (!prediction) {
    return "Keep logging to unlock predictions";
  }

  if (isWithin(today, prediction.fertileStart, prediction.fertileEnd)) {
    return "Fertile window";
  }

  if (prediction.ovulationDate && isSameDay(today, prediction.ovulationDate)) {
    return "Ovulation day";
  }

  if (today.getTime() >= prediction.pmsStart.getTime() && today.getTime() < prediction.predicted.getTime()) {
    return "PMS likely";
  }

  if (isWithin(today, prediction.earliest, prediction.latest)) {
    return prediction.showRangeOnly ? "Period range expected" : "Period expected";
  }

  return "Cycle in progress";
}

function DayIcon({ type }: { type: DayType }) {
  switch (type) {
    case "period":
      return <Entypo name="drop" size={18} color="#AD263A" />;
    case "fertile":
      return <Entypo name="drop" size={18} color="#DB457B" />;
    case "ovulation":
      return <MaterialCommunityIcons name="circle" size={16} color="#DB457B" />;
    case "pms":
      return <MaterialCommunityIcons name="cloud" size={17} color="#C89AB2" />;
    case "predicted":
      return <MaterialCommunityIcons name="circle-outline" size={18} color="#F4B7C6" />;
    default:
      return <MaterialCommunityIcons name="circle-small" size={16} color="rgba(244,243,238,0.28)" />;
  }
}

export default function CycleTracker({ prediction, lastPeriodStart }: CycleTrackerProps) {
  const today = new Date();
  const dateOfMonth = today.getDate();
  const monthName = MONTHS[today.getMonth()];
  const cycleDay = lastPeriodStart
    ? Math.floor((today.getTime() - lastPeriodStart.getTime()) / 86_400_000) + 1
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.outerRing}>
        {DAYS.map((dayOfMonth, index) => {
          const angle = (2 * Math.PI * index) / DAYS.length - Math.PI / 2;
          const x = (RADIUS - DISTANCE_FROM_EDGE) * Math.cos(angle) + RADIUS - DAY_SIZE / 2;
          const y = (RADIUS - DISTANCE_FROM_EDGE) * Math.sin(angle) + RADIUS - DAY_SIZE / 2;
          const type = getDayType(dayOfMonth, today, prediction);

          return (
            <View key={dayOfMonth} style={[styles.dayNode, { left: x, top: y }]}>
              <DayIcon type={type} />
            </View>
          );
        })}

        <View style={styles.centerCard}>
          <Text style={styles.monthText}>{monthName}</Text>
          <Text style={styles.dateText}>{dateOfMonth}</Text>
          <Text style={styles.cycleDayText}>{cycleDay ? `Day ${cycleDay}` : "Log a period"}</Text>
          <Text style={styles.phaseText}>{getPhaseLabel(today, prediction)}</Text>
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
    backgroundColor: "rgba(188, 184, 177, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.14)",
    position: "relative",
  },
  dayNode: {
    position: "absolute",
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  centerCard: {
    position: "absolute",
    top: (DIAMETER - CENTER_SIZE) / 2,
    left: (DIAMETER - CENTER_SIZE) / 2,
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: "rgba(20, 8, 15, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.large,
  },
  monthText: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 15,
    marginBottom: 4,
  },
  dateText: {
    color: theme.colors.text,
    fontSize: 54,
    fontWeight: "700",
    lineHeight: 58,
  },
  cycleDayText: {
    color: theme.colors.secondary,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  phaseText: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
});
