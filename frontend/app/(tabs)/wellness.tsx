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
import { theme } from "@/theme/theme";

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
        <ActivityIndicator color={theme.colors.secondary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.title}>Wellness</Text>
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
                accessibilityRole="button"
                accessibilityLabel={`Mood: ${choice.label}`}
                accessibilityState={{ selected }}
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
                  color={selected ? theme.colors.text : theme.colors.secondary}
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
                accessibilityRole="button"
                accessibilityLabel={`Energy ${level} out of 5`}
                accessibilityState={{ selected }}
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
            textColor={theme.colors.background}
            outlineColor="rgba(38, 12, 26, 0.35)"
            activeOutlineColor={theme.colors.primary}
            style={styles.numericInput}
          />
          <TextInput
            label="Water (glasses)"
            value={waterGlasses}
            onChangeText={setWaterGlasses}
            keyboardType="number-pad"
            mode="outlined"
            placeholder="Optional"
            textColor={theme.colors.background}
            outlineColor="rgba(38, 12, 26, 0.35)"
            activeOutlineColor={theme.colors.primary}
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
          textColor={theme.colors.background}
          outlineColor="rgba(38, 12, 26, 0.35)"
          activeOutlineColor={theme.colors.primary}
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
          buttonColor={theme.colors.primary}
          textColor={theme.colors.text}
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
                    size={20}
                    color={theme.colors.secondary}
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

      <Text style={styles.disclaimer}>
        This is a personal wellness record, not a diagnosis or medical advice.
      </Text>
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
    paddingBottom: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.large,
    backgroundColor: theme.colors.background,
  },
  header: {
    marginBottom: theme.spacing.medium,
  },
  title: {
    color: theme.colors.text,
    fontSize: 29,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.secondary,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 5,
  },
  helperText: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  formCard: {
    padding: theme.spacing.medium,
    borderRadius: theme.roundness * 3,
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.12)",
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: theme.spacing.small,
    marginBottom: theme.spacing.medium,
  },
  moodChoice: {
    width: "31%",
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.18)",
    backgroundColor: "rgba(244, 243, 238, 0.06)",
  },
  selectedChoice: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.secondary,
  },
  moodLabel: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginLeft: 5,
  },
  selectedChoiceText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  pressedChoice: {
    opacity: 0.75,
  },
  energyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.small,
    marginBottom: theme.spacing.medium,
  },
  energyChoice: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.24)",
    backgroundColor: "rgba(244, 243, 238, 0.06)",
  },
  selectedEnergy: {
    borderColor: theme.colors.secondary,
    backgroundColor: theme.colors.primary,
  },
  energyValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  numericRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.medium,
  },
  numericInput: {
    width: "48%",
    backgroundColor: theme.colors.surface,
  },
  symptomsInput: {
    minHeight: 110,
    backgroundColor: theme.colors.surface,
  },
  characterCount: {
    color: "rgba(244, 243, 238, 0.56)",
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  saveButton: {
    marginTop: theme.spacing.medium,
    borderRadius: theme.roundness * 3,
  },
  saveButtonContent: {
    minHeight: 48,
  },
  successText: {
    color: "#A9E7BF",
    fontSize: 13,
    marginTop: theme.spacing.small,
  },
  errorText: {
    color: "#FFC0C7",
    fontSize: 13,
    lineHeight: 19,
    marginTop: theme.spacing.small,
  },
  historyCard: {
    marginTop: theme.spacing.large,
    padding: theme.spacing.medium,
    borderRadius: theme.roundness * 3,
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.12)",
  },
  emptyText: {
    color: "rgba(244, 243, 238, 0.68)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: theme.spacing.medium,
  },
  divider: {
    backgroundColor: "rgba(244, 243, 238, 0.16)",
    marginVertical: theme.spacing.small,
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
    marginRight: theme.spacing.small,
    borderRadius: 17,
    backgroundColor: "rgba(219, 69, 123, 0.14)",
  },
  historyDetails: {
    flex: 1,
  },
  historyDate: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  historyText: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  disclaimer: {
    color: "rgba(244, 243, 238, 0.54)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: theme.spacing.medium,
    marginBottom: theme.spacing.medium,
  },
});
