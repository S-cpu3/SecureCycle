import { StyleSheet, View } from "react-native";
import Entypo from '@expo/vector-icons/Entypo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from "react-native-paper";
import type { PredictionResult } from "@/engine/predictionEngine";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DIAMETER          = 300;
const RADIUS            = DIAMETER / 2;
const SIZE              = 30;
const DAYS_IN_RING      = 30;
const DAYS              = Array.from({ length: DAYS_IN_RING }, (_, i) => i + 1);
const DISTANCE_FROM_EDGE = 15;
const CENTER_SIZE       = 240;

// ─── Day type classification ──────────────────────────────────────────────────

type DayType = 'period' | 'ovulation' | 'fertile' | 'pms' | 'predicted' | 'normal';

function getDayType(dom: number, today: Date, prediction: PredictionResult | null): DayType {
  if (!prediction) return 'normal';

  const month = today.getMonth();
  const year  = today.getFullYear();
  const date  = new Date(year, month, dom);
  const t     = date.getTime();

  // Check fertile window first (subset of predicted period range)
  if (prediction.fertileStart && prediction.fertileEnd) {
    if (t >= prediction.fertileStart.getTime() && t <= prediction.fertileEnd.getTime()) {
      return 'fertile';
    }
  }

  // Ovulation date
  if (prediction.ovulationDate && date.toDateString() === prediction.ovulationDate.toDateString()) {
    return 'ovulation';
  }

  // PMS window
  if (t >= prediction.pmsStart.getTime() && t < prediction.predicted.getTime()) {
    return 'pms';
  }

  // Predicted period range
  if (t >= prediction.earliest.getTime() && t <= prediction.latest.getTime()) {
    return 'predicted';
  }

  return 'normal';
}

// ─── Icon per day type ────────────────────────────────────────────────────────

function DayIcon({ type }: { type: DayType }) {
  switch (type) {
    case 'period':
      return <Entypo name="drop" size={20} color="#AD263A" />;
    case 'fertile':
      return <Entypo name="drop" size={18} color="#DB457B" />;
    case 'ovulation':
      return <MaterialCommunityIcons name="circle" size={18} color="#DB457B" />;
    case 'pms':
      return <MaterialCommunityIcons name="cloud" size={18} color="#9b6e8a" />;
    case 'predicted':
      return <MaterialCommunityIcons name="circle-outline" size={18} color="#AD263A" />;
    default:
      return <MaterialCommunityIcons name="circle-small" size={16} color="rgba(240,240,240,0.3)" />;
  }
}

// ─── Center phase label ───────────────────────────────────────────────────────

function getPhaseLabel(today: Date, prediction: PredictionResult | null): string {
  if (!prediction) return '';
  const t = today.getTime();

  if (prediction.fertileStart && prediction.fertileEnd) {
    if (t >= prediction.fertileStart.getTime() && t <= prediction.fertileEnd.getTime()) {
      return 'Fertile window';
    }
  }
  if (prediction.ovulationDate && today.toDateString() === prediction.ovulationDate.toDateString()) {
    return 'Ovulation day';
  }
  if (t >= prediction.pmsStart.getTime() && t < prediction.predicted.getTime()) {
    return 'PMS likely';
  }
  if (t >= prediction.earliest.getTime() && t <= prediction.latest.getTime()) {
    return 'Period expected';
  }
  return '';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CycleTrackerProps {
  prediction: PredictionResult | null;
  lastPeriodStart?: Date | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CycleTracker({ prediction, lastPeriodStart }: CycleTrackerProps) {
  const today = new Date();

  // Fix: getDate() returns the day of the month (1–31), not getDay() (0–6 weekday)
  const dateOfMonth = today.getDate();
  const monthName   = MONTHS[today.getMonth()];

  const cycleDay = lastPeriodStart
    ? Math.floor((today.getTime() - lastPeriodStart.getTime()) / 86_400_000) + 1
    : null;

  const phaseLabel = getPhaseLabel(today, prediction);

  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        {DAYS.map((dom, index) => {
          const angle = (2 * Math.PI * index) / DAYS.length;
          const x     = (RADIUS - DISTANCE_FROM_EDGE) * Math.cos(angle) + RADIUS - SIZE / 2;
          const y     = (RADIUS - DISTANCE_FROM_EDGE) * Math.sin(angle) + RADIUS - SIZE / 2;
          const type  = getDayType(dom, today, prediction);

          return (
            <View key={index} style={[styles.item, { left: x, top: y }]}>
              <DayIcon type={type} />
            </View>
          );
        })}

        <View style={styles.centerContent}>
          <Text style={styles.monthText}>{monthName}</Text>
          <Text style={styles.dateText}>{dateOfMonth}</Text>
          {cycleDay !== null && (
            <Text style={styles.cycleDayText}>Day {cycleDay}</Text>
          )}
          {phaseLabel !== '' && (
            <Text style={styles.phaseText}>{phaseLabel}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  circle: {
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: DIAMETER / 2,
    backgroundColor: "#c98bb9",
    position: "relative",
  },
  item: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContent: {
    position: "absolute",
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: "#683257",
    justifyContent: "center",
    alignItems: "center",
    left: RADIUS - CENTER_SIZE / 2,
    top:  RADIUS - CENTER_SIZE / 2,
  },
  monthText: {
    fontSize: 12,
    color: "#f0f0f0",
  },
  dateText: {
    fontSize: 64,
    color: "#f0f0f0",
    lineHeight: 70,
  },
  cycleDayText: {
    fontSize: 13,
    color: "#f0f0f0",
    opacity: 0.85,
  },
  phaseText: {
    fontSize: 12,
    color: "#f0f0f0",
    opacity: 0.75,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
