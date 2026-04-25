import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import Ionicons from "@expo/vector-icons/Ionicons";
import Entypo from "@expo/vector-icons/Entypo";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "@/theme/theme";
import { useDatabase } from "@/hooks/use-database";
import {
  CalendarDayState,
  getCalendarMonthData,
  getSavedPeriods,
  logPeriod,
  SavedPeriod,
} from "@/dao/cycleDao";
import { ensurePrimaryUser } from "@/dao/userDao";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarCell = Date | null;

// Calendar grid helpers: build a 7-column grid for a given month and normalise dates to midnight.
function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function buildMonthGrid(month: Date): CalendarCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const leadingEmpty = firstDay.getDay();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
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

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function History() {
  const db = useDatabase();
  const today = startOfDay(new Date());

  // State: visible month, selected start date, flow length, calendar coloring, and saved periods list.
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedStart, setSelectedStart] = useState<Date | null>(today);
  const [periodLength, setPeriodLength] = useState(5);
  const [calendarState, setCalendarState] = useState<Record<string, CalendarDayState>>({});
  const [savedPeriods, setSavedPeriods] = useState<SavedPeriod[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Data loading: fetches calendar day states and saved periods; re-runs on tab focus or month change.
  const loadMonth = useCallback(async () => {
    const user = await ensurePrimaryUser(db);
    const monthState = await getCalendarMonthData(db, user.user_id, visibleMonth);
    const periods = await getSavedPeriods(db, user.user_id);
    setCalendarState(monthState);
    setSavedPeriods(periods);
  }, [db, visibleMonth]);

  useFocusEffect(
    useCallback(() => {
      loadMonth().catch((error) => {
        console.error("Failed to load calendar", error);
      });
    }, [loadMonth])
  );

  const monthCells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(visibleMonth),
    [visibleMonth]
  );

  const selectedLabel = selectedStart
    ? selectedStart.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Choose a start date";

  // Save handler: writes a new period entry to the database then refreshes the calendar.
  const handleSavePeriod = async () => {
    if (!selectedStart) {
      return;
    }

    setIsSaving(true);
    try {
      const user = await ensurePrimaryUser(db);
      await logPeriod(db, user.user_id, selectedStart, periodLength);
      await loadMonth();
    } catch (error) {
      Alert.alert(
        "Couldn't save period",
        error instanceof Error ? error.message : "Please choose a start date at least 21 days from the last one."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Cycle Calendar</Text>
        <Text style={styles.subtitle}>Tap a day, choose flow length, then save it.</Text>

        {/* Period logger: tap a start date, pick flow length (3–7 days), then save */}
        <Card style={styles.inputCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Log a period</Text>
            <Text style={styles.selectionText}>{selectedLabel}</Text>

            <View style={styles.lengthRow}>
              {[3, 4, 5, 6, 7].map((length) => (
                <Pressable
                  key={length}
                  onPress={() => setPeriodLength(length)}
                  style={[styles.lengthChip, periodLength === length && styles.lengthChipActive]}
                >
                  <Text style={[styles.lengthChipText, periodLength === length && styles.lengthChipTextActive]}>
                    {length}d
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button mode="contained" style={styles.saveButton} onPress={handleSavePeriod} loading={isSaving}>
              Save period
            </Button>
          </Card.Content>
        </Card>

        {/* Calendar navigation: prev/next month arrows with the current month label */}
        <View style={styles.navigationRow}>
          <Pressable onPress={() => setVisibleMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))} style={styles.navButton}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={() => setVisibleMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekHeaderRow}>
          {WEEK_DAYS.map((day) => (
            <Text key={day} style={styles.weekHeaderText}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar grid: each cell is coloured for period / fertile / ovulation days */}
        <View style={styles.grid}>
          {monthCells.map((cell, index) => {
            if (!cell) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const key = toKey(cell);
            const dayState = calendarState[key];
            const isToday = key === toKey(today);
            const isSelected = selectedStart ? key === toKey(selectedStart) : false;

            return (
              <Pressable
                key={key}
                onPress={() => setSelectedStart(cell)}
                style={[
                  styles.dayCell,
                  dayState?.kind === "period" && styles.periodDayCell,
                  dayState?.kind === "fertile" && styles.fertileDayCell,
                  dayState?.kind === "ovulation" && styles.ovulationDayCell,
                  isToday && styles.currentDayCell,
                  isSelected && styles.selectedDayCell,
                ]}
              >
                <Text style={styles.dayText}>{cell.getDate()}</Text>
                {dayState?.kind === "period" ? (
                  <Entypo name="drop" size={12} color={theme.colors.text} />
                ) : null}
                {dayState?.kind === "ovulation" ? <Text style={styles.ovulationBadgeText}>O</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Legend: colour key for period, fertile, and ovulation day cells */}
        <View style={styles.legendContainer}>
          <View style={styles.legendRow}>
            <Entypo name="drop" size={14} color={theme.colors.text} />
            <Text style={styles.legendText}>Period</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendFertileDot} />
            <Text style={styles.legendText}>Fertile</Text>
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendOvulationDotText}>O</Text>
            <Text style={styles.legendText}>Ovulation</Text>
          </View>
        </View>

        {/* Saved periods list: all logged periods with start/end dates and flow length */}
        <Card style={styles.historyCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Saved periods</Text>
            {savedPeriods.length === 0 ? (
              <Text style={styles.historyText}>No saved periods yet.</Text>
            ) : (
              savedPeriods.map((period) => (
                <View key={`${period.startDate}-${period.endDate}`} style={styles.historyRow}>
                  <Text style={styles.historyText}>
                    {new Date(`${period.startDate}T00:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    to{" "}
                    {new Date(`${period.endDate}T00:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.historyCount}>{period.length} days</Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
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
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(244, 243, 238, 0.72)",
    marginBottom: theme.spacing.medium,
  },
  inputCard: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderRadius: theme.roundness * 3,
    marginBottom: theme.spacing.large,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: theme.spacing.small,
  },
  selectionText: {
    color: theme.colors.text,
    marginBottom: theme.spacing.medium,
  },
  lengthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.medium,
  },
  lengthChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.16)",
    backgroundColor: "rgba(38, 12, 26, 0.35)",
  },
  lengthChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  lengthChipText: {
    color: theme.colors.text,
    fontWeight: "600",
  },
  lengthChipTextActive: {
    color: theme.colors.text,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness * 3,
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.small,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(244,243,238,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  weekHeaderRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.small,
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "rgba(244, 243, 238, 0.7)",
    fontSize: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing.medium,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: "rgba(244,243,238,0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 4,
  },
  dayText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  currentDayCell: {
    borderColor: theme.colors.secondary,
  },
  selectedDayCell: {
    borderColor: theme.colors.text,
    borderWidth: 2,
  },
  periodDayCell: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  fertileDayCell: {
    backgroundColor: "rgba(219, 69, 123, 0.24)",
    borderColor: "rgba(219, 69, 123, 0.4)",
  },
  ovulationDayCell: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.secondary,
  },
  ovulationBadgeText: {
    color: theme.colors.background,
    fontWeight: "800",
    fontSize: 12,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.large,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendText: {
    color: theme.colors.text,
    fontSize: 12,
  },
  legendFertileDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(219, 69, 123, 0.7)",
  },
  legendOvulationDotText: {
    color: theme.colors.secondary,
    fontWeight: "800",
    width: 12,
    textAlign: "center",
  },
  historyCard: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderRadius: theme.roundness * 3,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(244,243,238,0.08)",
  },
  historyText: {
    color: theme.colors.text,
  },
  historyCount: {
    color: "rgba(244, 243, 238, 0.72)",
  },
});
