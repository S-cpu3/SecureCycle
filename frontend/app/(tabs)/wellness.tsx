import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  Text,
  TextInput,
} from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import WellnessHealthTools from "@/components/WellnessHealthTools";
import { ensurePrimaryUser } from "@/dao/userDao";
import {
  getRecentWellnessCheckIns,
  getWellnessCheckIn,
  localDateKey,
  saveWellnessCheckIn,
  WELLNESS_MOOD_LABELS,
  WellnessCheckIn,
  WellnessMood,
} from "@/dao/wellnessDao";
import { useDatabase } from "@/hooks/use-database";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { cardShadow, ColorScheme, Palette, radius, size, space, type } from "@/theme/tokens";

const MOOD_CHOICES: {
  value: WellnessMood;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { value: "very_low", label: "Very low", icon: "emoticon-sad-outline" },
  { value: "low", label: "Low", icon: "emoticon-neutral-outline" },
  { value: "okay", label: "Okay", icon: "emoticon-outline" },
  { value: "good", label: "Good", icon: "emoticon-happy-outline" },
  { value: "great", label: "Great", icon: "emoticon-excited-outline" },
];

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatCheckInDetails(checkIn: WellnessCheckIn) {
  const details = [`Energy ${checkIn.energy}/5`];

  if (checkIn.sleep_hours !== null) {
    details.push(`${checkIn.sleep_hours} hours sleep`);
  }

  if (checkIn.water_glasses !== null) {
    details.push(`${checkIn.water_glasses} glasses of water`);
  }

  return details.join(" · ");
}

export default function WellnessScreen() {
  const db = useDatabase();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [userId, setUserId] = useState<number | null>(null);
  const [todayCheckIn, setTodayCheckIn] = useState<WellnessCheckIn | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<WellnessCheckIn[]>([]);
  const [mood, setMood] = useState<WellnessMood>("okay");
  const [energy, setEnergy] = useState(3);
  const [sleepHours, setSleepHours] = useState("");
  const [waterGlasses, setWaterGlasses] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadCheckIns() {
        setIsLoading(true);
        setLoadError("");

        try {
          const user = await ensurePrimaryUser(db);
          const date = localDateKey();
          const [today, recent] = await Promise.all([
            getWellnessCheckIn(db, user.user_id, date),
            getRecentWellnessCheckIns(db, user.user_id, 7),
          ]);

          if (!isActive) {
            return;
          }

          setUserId(user.user_id);
          setTodayCheckIn(today);
          setRecentCheckIns(recent);
          setMood(today?.mood ?? "okay");
          setEnergy(today?.energy ?? 3);
          setSleepHours(
            today?.sleep_hours === null || today?.sleep_hours === undefined
              ? ""
              : String(today.sleep_hours)
          );
          setWaterGlasses(
            today?.water_glasses === null || today?.water_glasses === undefined
              ? ""
              : String(today.water_glasses)
          );
          setSymptoms(today?.symptoms ?? "");
          setSaveError("");
          setSaveMessage("");
        } catch (error) {
          console.error("Failed to load wellness check-ins", error);

          if (isActive) {
            setLoadError("Your wellness check-ins could not be loaded.");
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      loadCheckIns();

      return () => {
        isActive = false;
      };
    }, [db])
  );

  async function handleSave() {
    const parsedSleep = sleepHours.trim() === "" ? null : Number(sleepHours);
    const parsedWater =
      waterGlasses.trim() === "" ? null : Number(waterGlasses);

    if (
      parsedSleep !== null &&
      (!Number.isFinite(parsedSleep) || parsedSleep < 0 || parsedSleep > 24)
    ) {
      setSaveError("Enter sleep as a number from 0 to 24 hours.");
      setSaveMessage("");
      return;
    }

    if (
      parsedWater !== null &&
      (!Number.isInteger(parsedWater) || parsedWater < 0 || parsedWater > 30)
    ) {
      setSaveError("Enter water as a whole number from 0 to 30 glasses.");
      setSaveMessage("");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const activeUserId =
        userId ?? (await ensurePrimaryUser(db)).user_id;
      const date = localDateKey();

      await saveWellnessCheckIn(db, activeUserId, {
        date,
        mood,
        energy,
        sleepHours: parsedSleep,
        waterGlasses: parsedWater,
        symptoms: symptoms.trim() || null,
      });

      const [updatedToday, updatedRecent] = await Promise.all([
        getWellnessCheckIn(db, activeUserId, date),
        getRecentWellnessCheckIns(db, activeUserId, 7),
      ]);

      setTodayCheckIn(updatedToday);
      setRecentCheckIns(updatedRecent);
      setSaveMessage("Today’s check-in is saved on this device.");
    } catch (error) {
      console.error("Failed to save wellness check-in", error);
      setSaveError("Your check-in could not be saved. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.title}>Daily wellness</Text>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Daily wellness</Text>
        <Text style={styles.subtitle}>{todayLabel}</Text>
        <Text style={styles.helperText}>
          A quick personal check-in. Your entries stay in this app’s local
          database.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>How are you feeling?</Text>
        <View style={styles.moodGrid}>
          {MOOD_CHOICES.map((choice) => {
            const selected = mood === choice.value;

            return (
              <Pressable
                key={choice.value}
                accessibilityRole="radio"
                accessibilityLabel={`Mood: ${choice.label}`}
                accessibilityState={{ checked: selected }}
                android_ripple={{ color: colors.border }}
                onPress={() => setMood(choice.value)}
                style={({ pressed }) => [
                  styles.moodChoice,
                  selected && styles.selectedChoice,
                  pressed && styles.pressedChoice,
                ]}
              >
                <MaterialCommunityIcons
                  name={choice.icon}
                  size={23}
                  color={selected ? colors.onPrimary : colors.inkMuted}
                />
                <Text
                  style={[
                    styles.moodLabel,
                    selected && styles.selectedChoiceText,
                  ]}
                >
                  {choice.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Energy</Text>
        <Text style={styles.helperText}>Rate your energy from 1 to 5.</Text>
        <View style={styles.energyRow}>
          {[1, 2, 3, 4, 5].map((level) => {
            const selected = energy === level;

            return (
              <Pressable
                key={level}
                accessibilityRole="radio"
                accessibilityLabel={`Energy ${level} out of 5`}
                accessibilityState={{ checked: selected }}
                onPress={() => setEnergy(level)}
                style={({ pressed }) => [
                  styles.energyChoice,
                  selected && styles.selectedEnergy,
                  pressed && styles.pressedChoice,
                ]}
              >
                <Text
                  style={[
                    styles.energyValue,
                    selected && styles.selectedChoiceText,
                  ]}
                >
                  {level}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.numericRow}>
          <TextInput
            label="Sleep (hours)"
            value={sleepHours}
            onChangeText={setSleepHours}
            keyboardType="decimal-pad"
            mode="outlined"
            placeholder="Optional"
            outlineColor={colors.borderStrong}
            activeOutlineColor={colors.focus}
            style={styles.numericInput}
          />
          <TextInput
            label="Water (glasses)"
            value={waterGlasses}
            onChangeText={setWaterGlasses}
            keyboardType="number-pad"
            mode="outlined"
            placeholder="Optional"
            outlineColor={colors.borderStrong}
            activeOutlineColor={colors.focus}
            style={styles.numericInput}
          />
        </View>

        <TextInput
          label="Symptoms or notes (optional)"
          value={symptoms}
          onChangeText={setSymptoms}
          mode="outlined"
          multiline
          numberOfLines={4}
          maxLength={500}
          outlineColor={colors.borderStrong}
          activeOutlineColor={colors.focus}
          style={styles.symptomsInput}
        />
        <Text style={styles.characterCount}>{symptoms.length}/500</Text>

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        {saveMessage ? (
          <Text style={styles.successText}>{saveMessage}</Text>
        ) : null}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
        >
          {todayCheckIn ? "Update check-in" : "Save check-in"}
        </Button>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.sectionTitle}>Last 7 days</Text>
        <Text style={styles.helperText}>
          Your recent daily check-ins, newest first.
        </Text>
        {recentCheckIns.length === 0 ? (
          <Text style={styles.emptyText}>
            Your saved check-ins will appear here.
          </Text>
        ) : (
          recentCheckIns.map((checkIn, index) => (
            <View key={checkIn.checkin_id}>
              {index > 0 ? <Divider style={styles.divider} /> : null}
              <View style={styles.historyRow}>
                <View style={styles.historyIcon}>
                  <MaterialCommunityIcons
                    name="heart-pulse"
                    size={18}
                    color={colors.accentInk}
                  />
                </View>
                <View style={styles.historyDetails}>
                  <Text style={styles.historyDate}>
                    {checkIn.date === localDateKey()
                      ? "Today"
                      : formatDate(checkIn.date)}
                    {" · "}
                    {WELLNESS_MOOD_LABELS[checkIn.mood]}
                  </Text>
                  <Text style={styles.historyText}>
                    {formatCheckInDetails(checkIn)}
                  </Text>
                  {checkIn.symptoms ? (
                    <Text style={styles.historyText} numberOfLines={2}>
                      {checkIn.symptoms}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <WellnessHealthTools />

      <Text style={styles.disclaimer}>
        This is a personal wellness record, not a diagnosis or medical advice.
      </Text>
    </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: space[6],
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: space[6],
  },
  title: {
    ...type.screenTitle,
    color: colors.ink,
  },
  subtitle: {
    ...type.bodyStrong,
    fontSize: 15,
    color: colors.accentInk,
    marginTop: space[1],
  },
  helperText: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
    marginTop: space[1],
  },
  formCard: {
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(scheme),
  },
  sectionTitle: {
    ...type.cardTitle,
    color: colors.ink,
    marginBottom: space[1],
  },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: "3.5%",
    marginTop: space[2],
    marginBottom: space[4],
  },
  moodChoice: {
    width: "31%",
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: space[1],
    paddingHorizontal: space[1],
    marginBottom: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    overflow: "hidden",
  },
  selectedChoice: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  moodLabel: {
    ...type.caption,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  selectedChoiceText: {
    color: colors.onPrimary,
    fontWeight: "700",
  },
  pressedChoice: {
    opacity: 0.78,
  },
  energyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space[2],
    marginBottom: space[4],
  },
  energyChoice: {
    width: size.touchTarget,
    height: size.touchTarget,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  selectedEnergy: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  energyValue: {
    ...type.bodyStrong,
    fontVariant: ["tabular-nums"],
    color: colors.ink,
  },
  numericRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space[4],
  },
  numericInput: {
    width: "48%",
    backgroundColor: colors.surface,
  },
  symptomsInput: {
    minHeight: 110,
    backgroundColor: colors.surface,
  },
  characterCount: {
    ...type.finePrint,
    color: colors.inkSubtle,
    textAlign: "right",
    marginTop: space[1],
  },
  saveButton: {
    marginTop: space[4],
    borderRadius: radius.lg,
  },
  saveButtonContent: {
    minHeight: size.touchTarget,
  },
  successText: {
    ...type.caption,
    fontSize: 13,
    color: colors.success,
    marginTop: space[2],
  },
  errorText: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    marginTop: space[2],
  },
  historyCard: {
    marginTop: space[6],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow(scheme),
  },
  emptyText: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkMuted,
    marginTop: space[4],
  },
  divider: {
    backgroundColor: colors.border,
    marginVertical: space[3],
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  historyIcon: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    marginRight: space[3],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  historyDetails: {
    flex: 1,
  },
  historyDate: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.ink,
  },
  historyText: {
    ...type.caption,
    lineHeight: 18,
    color: colors.inkMuted,
    marginTop: 2,
  },
  disclaimer: {
    ...type.finePrint,
    color: colors.inkSubtle,
    marginTop: space[4],
    marginBottom: space[4],
  },
});
