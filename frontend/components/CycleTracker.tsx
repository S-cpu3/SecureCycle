import { StyleSheet, View } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Text } from "react-native-paper";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { cardShadow, ColorScheme, Palette, radius, size, space, type } from "@/theme/tokens";

const DIAMETER = size.ringDiameter;
const RADIUS = DIAMETER / 2;
const CENTER_SIZE = size.ringCenter;
const DAY_SIZE = size.dayNode;

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

// Every phase carries an icon as well as a colour: in dark mode period and
// fertile are close in lightness, so the icon is what tells them apart.
function phaseStyle(status: CycleDayStatus, colors: Palette) {
  switch (status) {
    case "period":
      return { backgroundColor: colors.phasePeriod, color: colors.onPhasePeriod };
    case "fertile":
      return { backgroundColor: colors.phaseFertile, color: colors.onPhaseFertile };
    case "ovulation":
      return { backgroundColor: colors.phaseOvulation, color: colors.onPhaseOvulation };
    default:
      return { backgroundColor: colors.phaseLuteal, color: colors.onPhaseLuteal };
  }
}

function PhaseIcon({ status, color }: { status: CycleDayStatus; color: string }) {
  if (status === "period") {
    return <Entypo name="drop" size={14} color={color} />;
  }

  const name =
    status === "fertile" ? "star-four-points" : status === "ovulation" ? "target" : "circle-small";
  return <MaterialCommunityIcons name={name} size={status === "luteal" ? 16 : 14} color={color} />;
}

export default function CycleTracker({
  monthLabel,
  dayLabel,
  statusLabel,
  subtitle,
  days,
}: CycleTrackerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Cycle day ${dayLabel} of ${days.length}, ${statusLabel}`}
    >
      <View style={styles.outerRing}>
        {days.map((day, index) => {
          const angle = (2 * Math.PI * index) / days.length - Math.PI / 2;
          const distance = RADIUS - 10;
          const x = distance * Math.cos(angle) + RADIUS - DAY_SIZE / 2;
          const y = distance * Math.sin(angle) + RADIUS - DAY_SIZE / 2;
          const status = phaseStyle(day.status, colors);

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
              <PhaseIcon status={day.status} color={status.color} />
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

const makeStyles = (colors: Palette, scheme: ColorScheme) => StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  outerRing: {
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: radius.full,
    backgroundColor: colors.ringTrack,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayNode: {
    position: "absolute",
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  centerCard: {
    position: "absolute",
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: radius.full,
    left: RADIUS - CENTER_SIZE / 2,
    top: RADIUS - CENTER_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space[4],
    ...cardShadow(scheme),
  },
  monthText: {
    ...type.eyebrow,
    color: colors.inkMuted,
    marginBottom: space[1],
  },
  dayText: {
    ...type.cycleDay,
    color: colors.ink,
  },
  statusText: {
    ...type.bodyStrong,
    fontSize: 15,
    color: colors.accentInk,
    marginTop: space[1],
    textAlign: "center",
  },
  subtitleText: {
    ...type.caption,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: space[1],
  },
});
