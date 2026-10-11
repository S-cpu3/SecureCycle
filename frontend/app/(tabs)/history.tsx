import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import Ionicons from "@expo/vector-icons/Ionicons";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { cardShadow, ColorScheme, Palette, radius, size, space, type } from "@/theme/tokens";
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
        <Text style={styles.title}>Cycle calendar</Text>
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: periodLength === length }}
                  accessibilityLabel={`${length} days`}
                  hitSlop={4}
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
          <Pressable onPress={() => setVisibleMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={4}>
            <Ionicons name="chevron-back" size={size.iconSm} color={colors.ink} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={() => setVisibleMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={4}>
            <Ionicons name="chevron-forward" size={size.iconSm} color={colors.ink} />
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

            const kindLabel =
              dayState?.kind === "period"
                ? ", period day"
                : dayState?.kind === "fertile"
                  ? ", predicted fertile day"
                  : dayState?.kind === "ovulation"
                    ? ", predicted ovulation"
                    : "";
            const textColor =
              dayState?.kind === "period"
                ? colors.onPhasePeriod
                : dayState?.kind === "fertile"
                  ? colors.onPhaseFertile
                  : dayState?.kind === "ovulation"
                    ? colors.onPhaseOvulation
                    : colors.ink;

            return (
              <Pressable
                key={key}
                onPress={() => setSelectedStart(cell)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${cell.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${kindLabel}${isToday ? ", today" : ""}`}
                style={[
                  styles.dayCell,
                  dayState?.kind === "period" && styles.periodDayCell,
                  dayState?.kind === "fertile" && styles.fertileDayCell,
                  dayState?.kind === "ovulation" && styles.ovulationDayCell,
                  isToday && styles.currentDayCell,
                  isSelected && styles.selectedDayCell,
                ]}
              >
                <Text style={[styles.dayText, { color: textColor }]}>{cell.getDate()}</Text>
                {dayState?.kind === "period" ? <Entypo name="drop" size={11} color={textColor} /> : null}
                {dayState?.kind === "fertile" ? (
                  <MaterialCommunityIcons name="star-four-points" size={11} color={textColor} />
                ) : null}
                {dayState?.kind === "ovulation" ? (
                  <MaterialCommunityIcons name="target" size={11} color={textColor} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Legend: colour key for period, fertile, and ovulation day cells */}
        <View style={styles.legendContainer}>
          <View style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.phasePeriod }]}>
              <Entypo name="drop" size={12} color={colors.onPhasePeriod} />
            </View>
            <Text style={styles.legendText}>Period</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.phaseFertile }]}>
              <MaterialCommunityIcons name="star-four-points" size={12} color={colors.onPhaseFertile} />
            </View>
            <Text style={styles.legendText}>Fertile</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.phaseOvulation }]}>
              <MaterialCommunityIcons name="target" size={12} color={colors.onPhaseOvulation} />
            </View>
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
  title: {
    ...type.screenTitle,
    color: colors.ink,
    marginBottom: space[1],
  },
  subtitle: {
    ...type.body,
    color: colors.inkMuted,
    marginBottom: space[4],
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: space[6],
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(scheme),
  },
  sectionTitle: {
    ...type.cardTitle,
    color: colors.ink,
    marginBottom: space[2],
  },
  selectionText: {
    ...type.body,
    color: colors.ink,
    marginBottom: space[4],
  },
  lengthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space[4],
  },
  lengthChip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  lengthChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  lengthChipText: {
    ...type.label,
    color: colors.ink,
  },
  lengthChipTextActive: {
    color: colors.onPrimary,
  },
  saveButton: {
    borderRadius: radius.lg,
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space[2],
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    ...type.sectionTitle,
    color: colors.ink,
  },
  weekHeaderRow: {
    flexDirection: "row",
    marginBottom: space[2],
  },
  weekHeaderText: {
    ...type.caption,
    fontWeight: "600",
    width: `${100 / 7}%`,
    textAlign: "center",
    color: colors.inkMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: space[4],
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginBottom: space[1],
  },
  dayText: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  currentDayCell: {
    borderColor: colors.focus,
  },
  selectedDayCell: {
    borderColor: colors.ink,
  },
  periodDayCell: {
    backgroundColor: colors.phasePeriod,
  },
  fertileDayCell: {
    backgroundColor: colors.phaseFertile,
  },
  ovulationDayCell: {
    backgroundColor: colors.phaseOvulation,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space[6],
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  legendSwatch: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  legendText: {
    ...type.label,
    color: colors.inkMuted,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(scheme),
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyText: {
    ...type.body,
    color: colors.ink,
  },
  historyCount: {
    ...type.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
  },
});
