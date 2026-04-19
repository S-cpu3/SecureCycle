import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";

import { usePrediction } from "@/hooks/use-prediction";
import { useDatabase } from "@/hooks/use-database";
import { CycleDao } from "@/services/dao/CycleDao";
import { PeriodDao } from "@/services/dao/PeriodDao";
import { toISO, type Period } from "@/types/models";
import { theme } from "@/theme/theme";

type CalendarCell = Date | null;

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function buildMonthGrid(month: Date): CalendarCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getPeriodRange(period: Period) {
  return {
    start: new Date(`${period.start_date}T00:00:00`),
    end: new Date(`${period.end_date}T00:00:00`),
  };
}

function isWithin(date: Date, start: Date, end: Date) {
  const value = startOfDay(date).getTime();
  return value >= start.getTime() && value <= end.getTime();
}

export default function HistoryScreen() {
  const db = useDatabase();
  const today = startOfDay(new Date());
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [periodLength, setPeriodLength] = useState(5);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { prediction, refresh } = usePrediction();

  const loadPeriods = useCallback(async () => {
    const nextPeriods = await PeriodDao.getAll(db);
    setPeriods(nextPeriods);
  }, [db]);

  useEffect(() => {
    loadPeriods().catch((error) => {
      console.error("Failed to load period history", error);
    });
  }, [loadPeriods]);

  const monthCells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(visibleMonth),
    [visibleMonth]
  );

  const handleLogPeriod = useCallback(
    async (selectedDate: Date) => {
      setIsSaving(true);

      try {
        const cycleId = await CycleDao.start(db, toISO(selectedDate));
        await PeriodDao.log(db, cycleId, toISO(selectedDate), toISO(addDays(selectedDate, periodLength - 1)));
        await loadPeriods();
        refresh();
      } catch (error) {
        console.error("Failed to log period", error);
        Alert.alert("Unable to save period", "Please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [db, loadPeriods, periodLength, refresh]
  );

  const latestPeriod = periods[0] ?? null;
  const periodLabel = latestPeriod ? `${latestPeriod.start_date} - ${latestPeriod.end_date}` : "No periods logged yet";
  const nextLabel = prediction
    ? prediction.showRangeOnly
      ? `${prediction.earliest.toLocaleDateString()} - ${prediction.latest.toLocaleDateString()}`
      : prediction.predicted.toLocaleDateString()
    : "Unavailable";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>Tap a date to log a period start. New logs currently use the length selected below.</Text>

      <Card style={styles.summaryCard}>
        <Card.Content>
          <Text style={styles.summaryTitle}>Latest saved period</Text>
          <Text style={styles.summaryValue}>{periodLabel}</Text>
          <Text style={styles.summaryMeta}>Next estimate: {nextLabel}</Text>
        </Card.Content>
      </Card>

      <Card style={styles.calendarCard}>
        <Card.Content>
          <View style={styles.monthHeader}>
            <Button textColor={theme.colors.secondary} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              Prev
            </Button>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Button textColor={theme.colors.secondary} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              Next
            </Button>
          </View>

          <View style={styles.weekRow}>
            {WEEK_DAYS.map((day) => (
              <Text key={day} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {monthCells.map((cell, index) => {
              if (!cell) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const isToday = isSameDay(cell, today);
              const isPeriodDay = periods.some((period) => {
                const range = getPeriodRange(period);
                return isWithin(cell, range.start, range.end);
              });
              const isFertileDay =
                !!prediction?.fertileStart &&
                !!prediction?.fertileEnd &&
                isWithin(cell, startOfDay(prediction.fertileStart), startOfDay(prediction.fertileEnd));
              const isPredictedDay =
                !!prediction && isWithin(cell, startOfDay(prediction.earliest), startOfDay(prediction.latest));

              return (
                <Pressable
                  key={cell.toISOString()}
                  style={[
                    styles.dayCell,
                    isPeriodDay && styles.periodDay,
                    isPredictedDay && styles.predictedDay,
                    isFertileDay && styles.fertileDay,
                    isToday && styles.todayCell,
                  ]}
                  onPress={() => handleLogPeriod(cell)}
                  disabled={isSaving}
                >
                  <Text style={styles.dayText}>{cell.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.lengthRow}>
            {[3, 4, 5, 6, 7].map((length) => (
              <Pressable
                key={length}
                style={[styles.lengthChip, length === periodLength && styles.lengthChipActive]}
                onPress={() => setPeriodLength(length)}
              >
                <Text style={styles.lengthText}>{length}d</Text>
              </Pressable>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.legendCard}>
        <Card.Content>
          <Text style={styles.summaryTitle}>Legend</Text>
          <Text style={styles.legendText}>Filled red: logged period</Text>
          <Text style={styles.legendText}>Outlined rose: predicted period range</Text>
          <Text style={styles.legendText}>Soft pink: fertile window</Text>
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
    padding: theme.spacing.medium,
    gap: theme.spacing.medium,
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
  },
  summaryCard: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  summaryTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  summaryValue: {
    color: theme.colors.secondary,
    fontSize: 16,
    marginTop: 8,
  },
  summaryMeta: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 14,
    marginTop: 8,
  },
  calendarCard: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    color: "rgba(244, 243, 238, 0.56)",
    fontSize: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayCell: {
    width: "12.5%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  dayText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  todayCell: {
    borderColor: theme.colors.secondary,
  },
  periodDay: {
    backgroundColor: "rgba(173, 38, 58, 0.82)",
  },
  predictedDay: {
    borderColor: "#F2A7BE",
  },
  fertileDay: {
    backgroundColor: "rgba(219, 69, 123, 0.22)",
  },
  lengthRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    justifyContent: "center",
  },
  lengthChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  lengthChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  lengthText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  legendCard: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  legendText: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
});
