import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import Entypo from '@expo/vector-icons/Entypo';
import { theme } from '@/theme/theme';
import { useDatabase } from '@/hooks/use-database';
import { usePrediction } from '@/hooks/use-prediction';
import { CycleDao } from '@/services/dao/CycleDao';
import { PeriodDao } from '@/services/dao/PeriodDao';
import type { Period } from '@/types/models';
import { toISO } from '@/types/models';

// ─── Date helpers (unchanged from original) ──────────────────────────────────

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarCell = Date | null;

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
    first.getMonth()    === second.getMonth()    &&
    first.getDate()     === second.getDate()
  );
}

function isInRange(value: Date, start: Date, end: Date) {
  const v = startOfDay(value).getTime();
  return v >= startOfDay(start).getTime() && v <= startOfDay(end).getTime();
}

function buildMonthGrid(month: Date): CalendarCell[] {
  const year       = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay   = new Date(year, monthIndex, 1);
  const totalDays  = new Date(year, monthIndex + 1, 0).getDate();
  const leading    = firstDay.getDay();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function History() {
  const today = startOfDay(new Date());
  const db    = useDatabase();

  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [periods, setPeriods] = useState<Period[]>([]);

  const { prediction, refresh } = usePrediction();

  // ─── Load persisted periods on mount ─────────────────────────────────────────

  useEffect(() => {
    if (!db) return;
    async function load() {
      const cycle = await CycleDao.getLatest(db!);
      if (cycle) {
        const ps = await PeriodDao.getForCycle(db!, cycle.cycle_id);
        setPeriods(ps);
      }
    }
    load();
  }, [db]);

  // ─── Calendar grid ─────────────────────────────────────────────────────────

  const monthCells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(visibleMonth),
    [visibleMonth]
  );

  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(today);

  // ─── Day-tap handler ─────────────────────────────────────────────────────────

  const onSelectDay = useCallback(async (selectedDate: Date) => {
    if (!db) return;

    const iso = toISO(selectedDate);

    // Check if there's an existing period that we might be extending
    const latestPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

    if (
      latestPeriod &&
      selectedDate > new Date(latestPeriod.start_date + 'T00:00:00')
    ) {
      // Extend the current period's end date
      await PeriodDao.updateEnd(db, latestPeriod.period_id, iso);
    } else {
      // Start a new cycle and log a 5-day period
      const cycleId  = await CycleDao.start(db, iso);
      await PeriodDao.log(db, cycleId, iso, toISO(addDays(selectedDate, 4)));
    }

    // Reload periods and refresh prediction
    const cycle = await CycleDao.getLatest(db);
    if (cycle) {
      const ps = await PeriodDao.getForCycle(db, cycle.cycle_id);
      setPeriods(ps);

    }

    refresh();
  }, [db, periods, refresh]);

  // ─── Navigation ──────────────────────────────────────────────────────────────

  const goToPreviousMonth = () =>
    setVisibleMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setVisibleMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));
  const goToCurrentMonth = () =>
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  // ─── Derived dates from prediction ──────────────────────────────────────────

  const ovulationStart  = prediction?.fertileStart  ?? null;
  const ovulationEnd    = prediction?.fertileEnd    ?? null;
  const predictedStart  = prediction?.earliest      ?? null;
  const predictedEnd    = prediction?.latest        ?? null;

  // ─── Info card labels ────────────────────────────────────────────────────────

  const activePeriod    = periods.at(-1);
  const periodLabel = activePeriod
    ? `${activePeriod.start_date} – ${activePeriod.end_date}`
    : 'Tap any date to log your period';

  const ovulationLabel = ovulationStart && ovulationEnd
    ? `${toISO(ovulationStart)} – ${toISO(ovulationEnd)}`
    : prediction?.ovulationDate === null && prediction !== null
      ? 'Ovulation tracking unavailable'
      : '–';

  const nextPeriodLabel = prediction
    ? prediction.showRangeOnly
      ? `${toISO(prediction.earliest)} – ${toISO(prediction.latest)}`
      : toISO(prediction.predicted)
    : '–';

  const confidenceLabel = prediction
    ? `~${Math.round(prediction.confidenceScore)}% confidence`
    : '';

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Cycle Calendar</Text>
        <Text style={styles.subtitle}>{todayLabel}</Text>

        <View style={styles.navigationRow}>
          <Pressable onPress={goToPreviousMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={goToNextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <Pressable onPress={goToCurrentMonth} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </Pressable>

        <View style={styles.weekHeaderRow}>
          {WEEK_DAYS.map(day => (
            <Text key={day} style={styles.weekHeaderText}>{day}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {monthCells.map((cell, index) => {
            if (!cell) return <View key={`empty-${index}`} style={styles.dayCell} />;

            const isToday    = isSameDay(cell, today);
            const isPeriod   = periods.some(p =>
              isInRange(cell, new Date(p.start_date + 'T00:00:00'), new Date(p.end_date + 'T00:00:00'))
            );
            const isOvulation = !!ovulationStart && !!ovulationEnd &&
              isInRange(cell, ovulationStart, ovulationEnd);
            const isPredicted = !!predictedStart && !!predictedEnd &&
              isInRange(cell, predictedStart, predictedEnd) && !isPeriod;

            return (
              <Pressable
                key={`${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`}
                onPress={() => onSelectDay(cell)}
                style={[
                  styles.dayCell,
                  isPeriod    && styles.periodDayCell,
                  isOvulation && styles.ovulationDayCell,
                  isPredicted && styles.predictedDayCell,
                  isToday     && styles.currentDayCell,
                ]}
              >
                <Text style={[styles.dayText, isPeriod && styles.periodDayText]}>
                  {cell.getDate()}
                </Text>

                {isPeriod && (
                  <View style={styles.periodIconWrap}>
                    <Entypo name="drop" size={12} color={theme.colors.text} />
                  </View>
                )}

                {!isPeriod && isOvulation && (
                  <View style={styles.ovulationBadge}>
                    <Text style={styles.ovulationBadgeText}>O</Text>
                  </View>
                )}

                {isPredicted && (
                  <View style={styles.predictedDot} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendRow}>
            <Entypo name="drop" size={14} color={theme.colors.text} />
            <Text style={styles.legendText}>Period</Text>
          </View>
          {ovulationStart && (
            <View style={styles.legendRow}>
              <View style={styles.legendOvulationDot}>
                <Text style={styles.legendOvulationDotText}>O</Text>
              </View>
              <Text style={styles.legendText}>Fertile window</Text>
            </View>
          )}
          {predictedStart && (
            <View style={styles.legendRow}>
              <View style={styles.legendPredictedDot} />
              <Text style={styles.legendText}>Predicted period</Text>
            </View>
          )}
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Current Period</Text>
          <Text style={styles.infoValue}>{periodLabel}</Text>

          <Text style={styles.infoLabel}>Fertile Window</Text>
          <Text style={styles.infoValue}>{ovulationLabel}</Text>

          <Text style={styles.infoLabel}>
            Next Period {prediction?.showRangeOnly ? '(estimated range)' : ''}
          </Text>
          <Text style={styles.infoValue}>{nextPeriodLabel}</Text>

          {confidenceLabel !== '' && (
            <Text style={styles.confidenceText}>{confidenceLabel}</Text>
          )}
        </View>

        <Text style={styles.helperText}>
          Tap a date to log your period start. Tap a later date to extend it.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: theme.colors.text,
    opacity: 0.75,
    marginBottom: theme.spacing.medium,
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.small,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(244,243,238,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  todayButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.roundness,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: theme.spacing.medium,
  },
  todayButtonText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.small,
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: theme.colors.text,
    opacity: 0.75,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.medium,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: 'rgba(244,243,238,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  dayText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  currentDayCell: {
    borderColor: theme.colors.secondary,
    borderWidth: 2,
  },
  periodDayCell: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  periodDayText: {
    color: theme.colors.text,
  },
  periodIconWrap: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  ovulationDayCell: {
    borderColor: theme.colors.secondary,
    backgroundColor: 'rgba(219,69,123,0.2)',
  },
  ovulationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovulationBadgeText: {
    color: theme.colors.text,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
  predictedDayCell: {
    borderColor: theme.colors.secondary,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  predictedDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.secondary,
    opacity: 0.7,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: theme.spacing.medium,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    color: theme.colors.text,
    opacity: 0.9,
    fontSize: 13,
  },
  legendOvulationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendOvulationDotText: {
    color: theme.colors.text,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
  legendPredictedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.secondary,
    borderStyle: 'dashed',
  },
  infoCard: {
    backgroundColor: 'rgba(188,184,177,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: theme.spacing.small,
  },
  infoLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoValue: {
    color: theme.colors.text,
    opacity: 0.9,
    marginBottom: 8,
  },
  confidenceText: {
    color: theme.colors.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  helperText: {
    color: theme.colors.text,
    opacity: 0.75,
    fontSize: 12,
    marginBottom: theme.spacing.small,
  },
});
