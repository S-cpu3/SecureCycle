import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import Entypo from '@expo/vector-icons/Entypo';
import { theme } from '@/theme/theme';

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
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function isInRange(value: Date, start: Date, end: Date) {
  const normalizedValue = startOfDay(value).getTime();
  const normalizedStart = startOfDay(start).getTime();
  const normalizedEnd = startOfDay(end).getTime();
  return normalizedValue >= normalizedStart && normalizedValue <= normalizedEnd;
}

function buildMonthGrid(month: Date): CalendarCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const leadingEmpty = firstDay.getDay();

  const cells: CalendarCell[] = [];

  for (let i = 0; i < leadingEmpty; i += 1) {
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

export default function History() {
  const today = startOfDay(new Date());
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [periodStart, setPeriodStart] = useState<Date | null>(null);
  const [periodEnd, setPeriodEnd] = useState<Date | null>(null);

  const monthCells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
      }).format(visibleMonth),
    [visibleMonth]
  );

  const ovulationStart = useMemo(
    () => (periodStart ? addDays(periodStart, 13) : addDays(today, 10)),
    [periodStart, today]
  );

  const ovulationEnd = useMemo(() => addDays(ovulationStart, 4), [ovulationStart]);

  const onSelectDay = (selectedDate: Date) => {
    if (!periodStart || !periodEnd) {
      setPeriodStart(selectedDate);
      setPeriodEnd(addDays(selectedDate, 4));
      return;
    }

    if (selectedDate.getTime() > periodEnd.getTime()) {
      setPeriodEnd(selectedDate);
      return;
    }

    setPeriodStart(selectedDate);
    setPeriodEnd(addDays(selectedDate, 4));
  };

  const goToPreviousMonth = () => {
    setVisibleMonth(
      previous => new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setVisibleMonth(
      previous => new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
    );
  };

  const goToCurrentMonth = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(today);

  const periodLabel =
    periodStart && periodEnd
      ? `${periodStart.toLocaleDateString('en-US')} - ${periodEnd.toLocaleDateString('en-US')}`
      : 'Tap any date to set your period start';

  const ovulationLabel = `${ovulationStart.toLocaleDateString('en-US')} - ${ovulationEnd.toLocaleDateString('en-US')}`;

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
            <Text key={day} style={styles.weekHeaderText}>
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
            const isPeriodDay = !!periodStart && !!periodEnd && isInRange(cell, periodStart, periodEnd);
            const isOvulationDay = isInRange(cell, ovulationStart, ovulationEnd);

            return (
              <Pressable
                key={`${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`}
                onPress={() => onSelectDay(cell)}
                style={[
                  styles.dayCell,
                  isPeriodDay && styles.periodDayCell,
                  isOvulationDay && styles.ovulationDayCell,
                  isToday && styles.currentDayCell,
                ]}
              >
                <Text style={[styles.dayText, isPeriodDay && styles.periodDayText]}>{cell.getDate()}</Text>
                {isPeriodDay && (
                  <View style={styles.periodIconWrap}>
                    <Entypo name="drop" size={12} color={theme.colors.text} />
                  </View>
                )}
                {!isPeriodDay && isOvulationDay && (
                  <View style={styles.ovulationBadge}>
                    <Text style={styles.ovulationBadgeText}>O</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legendContainer}>
          <View style={styles.legendRow}>
            <Entypo name="drop" size={14} color={theme.colors.text} />
            <Text style={styles.legendText}>Period window</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendOvulationDot}>
              <Text style={styles.legendOvulationDotText}>O</Text>
            </View>
            <Text style={styles.legendText}>Ovulation window</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Period:</Text>
          <Text style={styles.infoValue}>{periodLabel}</Text>
          <Text style={styles.infoLabel}>Ovulation:</Text>
          <Text style={styles.infoValue}>{ovulationLabel}</Text>
        </View>

        <Text style={styles.helperText}>
          First tap sets a 5-day period window. Tap a later date to extend it.
        </Text>
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
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
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
  helperText: {
    color: theme.colors.text,
    opacity: 0.75,
    fontSize: 12,
    marginBottom: theme.spacing.small,
  },
});
