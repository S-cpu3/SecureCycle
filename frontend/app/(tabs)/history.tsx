import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Text, TextInput } from "react-native-paper";
import Ionicons from "@expo/vector-icons/Ionicons";
import Entypo from "@expo/vector-icons/Entypo";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "@/theme/theme";
import { useDatabase } from "@/hooks/use-database";
import {
  CycleForDate,
  DailyLogEntry,
  CalendarDayState,
  getCycleForDate,
  getEntriesForDate,
  getCalendarMonthData,
  getSavedPeriods,
  logPeriod,
  SavedPeriod,
  saveSymptomForDate,
} from "@/dao/cycleDao";
import { ensurePrimaryUser } from "@/dao/userDao";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SYMPTOM_OPTIONS = [
  "Cramps",
  "Bloating",
  "Headache",
  "Fatigue",
  "Mood changes",
  "Acne",
];
const INTENSITY_OPTIONS = ["mild", "moderate", "severe"];

type CalendarCell = Date | null;

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
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [periodLength, setPeriodLength] = useState(5);
  const [calendarState, setCalendarState] = useState<
    Record<string, CalendarDayState>
  >({});
  const [savedPeriods, setSavedPeriods] = useState<SavedPeriod[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<CycleForDate | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<DailyLogEntry[]>([]);
  const [symptomType, setSymptomType] = useState("");
  const [symptomIntensity, setSymptomIntensity] = useState("moderate");
  const [symptomNotes, setSymptomNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSymptom, setIsSavingSymptom] = useState(false);

  const loadMonth = useCallback(async () => {
    const user = await ensurePrimaryUser(db);
    const monthState = await getCalendarMonthData(
      db,
      user.user_id,
      visibleMonth,
    );
    const periods = await getSavedPeriods(db, user.user_id);
    setCalendarState(monthState);
    setSavedPeriods(periods);
  }, [db, visibleMonth]);

  const loadSelectedDate = useCallback(
    async (date: Date | null) => {
      if (!date) {
        setSelectedCycle(null);
        setSelectedEntries([]);
        setSymptomType("");
        setSymptomIntensity("moderate");
        setSymptomNotes("");
        return;
      }

      const user = await ensurePrimaryUser(db);
      const [cycle, entries] = await Promise.all([
        getCycleForDate(db, user.user_id, date),
        getEntriesForDate(db, user.user_id, date),
      ]);
      const symptomEntry = entries.find((entry) => entry.entry_type === "symptom");
      setSelectedCycle(cycle);
      setSelectedEntries(entries);
      setSymptomType(symptomEntry?.symptom_type ?? "");
      setSymptomIntensity(symptomEntry?.intensity ?? "moderate");
      setSymptomNotes(symptomEntry?.notes ?? "");
    },
    [db],
  );

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadMonth(), loadSelectedDate(selectedDate)]).catch((error) => {
        console.error("Failed to load calendar", error);
      });
    }, [loadMonth, loadSelectedDate, selectedDate]),
  );

  useEffect(() => {
    loadSelectedDate(selectedDate).catch((error) => {
      console.error("Failed to load selected date", error);
    });
  }, [loadSelectedDate, selectedDate]);

  const monthCells = useMemo(
    () => buildMonthGrid(visibleMonth),
    [visibleMonth],
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(visibleMonth),
    [visibleMonth],
  );

  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Choose a start date";

  const handleSavePeriod = async () => {
    if (!selectedDate) {
      return;
    }

    setIsSaving(true);
    try {
      const user = await ensurePrimaryUser(db);
      await logPeriod(db, user.user_id, selectedDate, periodLength);
      await Promise.all([loadMonth(), loadSelectedDate(selectedDate)]);
    } catch (error) {
      Alert.alert(
        "Couldn't save period",
        error instanceof Error
          ? error.message
          : "Please choose a start date at least 21 days from the last one.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSymptom = async () => {
    if (!selectedDate) {
      return;
    }

    setIsSavingSymptom(true);
    try {
      const user = await ensurePrimaryUser(db);
      await saveSymptomForDate(
        db,
        user.user_id,
        selectedDate,
        symptomType,
        symptomIntensity,
        symptomNotes,
      );
      await loadSelectedDate(selectedDate);
      await loadMonth();
    } catch (error) {
      Alert.alert(
        "Couldn't save symptom",
        error instanceof Error ? error.message : "Try selecting a date inside a saved cycle.",
      );
    } finally {
      setIsSavingSymptom(false);
    }
  };

  const selectedCycleLabel = selectedCycle
    ? `Cycle day ${selectedCycle.dayNumber}`
    : "No saved cycle for this date";

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Cycle Calendar</Text>
        <Text style={styles.subtitle}>
          Tap a day, choose flow length, then save it.
        </Text>

        <Card style={styles.inputCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Log a period</Text>
            <Text style={styles.selectionText}>{selectedLabel}</Text>

            <View style={styles.lengthRow}>
              {[3, 4, 5, 6, 7].map((length) => (
                <Pressable
                  key={length}
                  onPress={() => setPeriodLength(length)}
                  style={[
                    styles.lengthChip,
                    periodLength === length && styles.lengthChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.lengthChipText,
                      periodLength === length && styles.lengthChipTextActive,
                    ]}
                  >
                    {length}d
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button
              mode="contained"
              style={styles.saveButton}
              onPress={handleSavePeriod}
              loading={isSaving}
            >
              Save period
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.navigationRow}>
          <Pressable
            onPress={() =>
              setVisibleMonth(
                (previous) =>
                  new Date(previous.getFullYear(), previous.getMonth() - 1, 1),
              )
            }
            style={styles.navButton}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable
            onPress={() =>
              setVisibleMonth(
                (previous) =>
                  new Date(previous.getFullYear(), previous.getMonth() + 1, 1),
              )
            }
            style={styles.navButton}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        <View style={styles.weekHeaderRow}>
          {WEEK_DAYS.map((day) => (
            <Text key={day} style={styles.weekHeaderText}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {monthCells.map((cell, index) => {
            if (!cell)
              return <View key={`empty-${index}`} style={styles.dayCell} />;

            const key = toKey(cell);
            const dayState = calendarState[key];
            const isToday = key === toKey(today);
            const isSelected = selectedDate
              ? key === toKey(selectedDate)
              : false;

            return (
              <Pressable
                key={key}
                onPress={() => setSelectedDate(cell)}
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
                {dayState?.kind === "ovulation" ? (
                  <Text style={styles.ovulationBadgeText}>O</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

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

        <Card style={styles.entryCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Daily entry</Text>
            <Text style={styles.selectionText}>{selectedLabel}</Text>
            <Text style={styles.entryMetaText}>{selectedCycleLabel}</Text>
            {selectedCycle ? (
              <Text style={styles.entryMetaText}>
                {selectedCycle.startDate} to {selectedCycle.endDate ?? "Open"}
              </Text>
            ) : (
              <Text style={styles.entryHintText}>
                Save a period first, then pick a day inside that cycle to log symptoms.
              </Text>
            )}

            {selectedEntries.length > 0 ? (
              <View style={styles.loggedRows}>
                {selectedEntries.map((entry) => (
                  <View
                    key={entry.entry_id}
                    style={styles.loggedRow}
                  >
                    <Text style={styles.loggedTitle}>
                      {entry.entry_type === "period" ? "Period" : "Symptom"}
                    </Text>
                    <Text style={styles.loggedBody}>
                      {entry.symptom_type || entry.intensity || entry.notes || "Logged"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.optionRow}>
              {SYMPTOM_OPTIONS.map((option) => {
                const isActive = symptomType === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setSymptomType(option)}
                    style={[
                      styles.optionChip,
                      isActive && styles.optionChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        isActive && styles.optionChipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.intensityRow}>
              {INTENSITY_OPTIONS.map((option) => {
                const isActive = symptomIntensity === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setSymptomIntensity(option)}
                    style={[
                      styles.intensityChip,
                      isActive && styles.intensityChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.intensityChipText,
                        isActive && styles.intensityChipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              mode="outlined"
              label="Notes"
              value={symptomNotes}
              onChangeText={setSymptomNotes}
              multiline
              style={styles.notesInput}
              outlineColor="rgba(244, 243, 238, 0.16)"
              activeOutlineColor={theme.colors.secondary}
              textColor={theme.colors.text}
              theme={{
                colors: {
                  surface: "rgba(38, 12, 26, 0.35)",
                  onSurfaceVariant: "rgba(244, 243, 238, 0.7)",
                  primary: theme.colors.secondary,
                },
              }}
            />

            <Button
              mode="contained"
              style={styles.saveButton}
              onPress={handleSaveSymptom}
              loading={isSavingSymptom}
              disabled={!selectedCycle || symptomType.trim().length === 0}
            >
              Save symptom
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.historyCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Saved periods</Text>
            {savedPeriods.length === 0 ? (
              <Text style={styles.historyText}>No saved periods yet.</Text>
            ) : (
              savedPeriods.map((period) => (
                <Pressable
                  key={`${period.startDate}-${period.endDate}`}
                  onPress={() => {
                    const startDate = new Date(`${period.startDate}T00:00:00`);
                    setVisibleMonth(
                      new Date(startDate.getFullYear(), startDate.getMonth(), 1),
                    );
                    setSelectedDate(startDate);
                  }}
                  style={styles.historyRow}
                >
                  <Text style={styles.historyText}>
                    {new Date(
                      `${period.startDate}T00:00:00`,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    to{" "}
                    {new Date(`${period.endDate}T00:00:00`).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </Text>
                  <Text style={styles.historyCount}>{period.length} days</Text>
                </Pressable>
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
  entryCard: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderRadius: theme.roundness * 3,
    marginBottom: theme.spacing.large,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  entryMetaText: {
    color: "rgba(244, 243, 238, 0.72)",
    marginBottom: 4,
  },
  entryHintText: {
    color: "rgba(244, 243, 238, 0.72)",
    lineHeight: 20,
    marginBottom: theme.spacing.medium,
  },
  loggedRows: {
    marginTop: theme.spacing.small,
    marginBottom: theme.spacing.medium,
    gap: 8,
  },
  loggedRow: {
    padding: 10,
    borderRadius: theme.roundness * 2,
    backgroundColor: "rgba(38, 12, 26, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(244,243,238,0.08)",
  },
  loggedTitle: {
    color: theme.colors.text,
    fontWeight: "700",
    marginBottom: 4,
  },
  loggedBody: {
    color: "rgba(244, 243, 238, 0.72)",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: theme.spacing.medium,
    marginBottom: theme.spacing.medium,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.16)",
    backgroundColor: "rgba(38, 12, 26, 0.35)",
  },
  optionChipActive: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.secondary,
  },
  optionChipText: {
    color: theme.colors.text,
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: theme.colors.background,
  },
  intensityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: theme.spacing.medium,
  },
  intensityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.16)",
    backgroundColor: "rgba(38, 12, 26, 0.35)",
    alignItems: "center",
  },
  intensityChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  intensityChipText: {
    color: theme.colors.text,
    fontWeight: "600",
  },
  intensityChipTextActive: {
    color: theme.colors.text,
  },
  notesInput: {
    backgroundColor: "transparent",
    marginBottom: theme.spacing.medium,
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
