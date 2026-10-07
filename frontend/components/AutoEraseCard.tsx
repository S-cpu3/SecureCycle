import React, { useCallback, useState } from "react";
import { Alert, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { Button } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { theme } from "@/theme/theme";
import { useDatabase } from "@/hooks/use-database";
import { ensurePrimaryUser, hasUsablePin, verifyUserPin } from "@/dao/userDao";
import {
  AUTO_ERASE_CHOICES,
  AUTO_ERASE_TEST_CHOICE,
  AutoEraseSettings,
  autoEraseDeadline,
  getAutoEraseSettings,
  setAutoEraseDays,
} from "@/dao/autoEraseDao";

function confirmDestructive(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Erase data when unused?", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "I understand", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function labelForDays(days: number | null) {
  if (days === null) return "off";
  const all = [...AUTO_ERASE_CHOICES, AUTO_ERASE_TEST_CHOICE];
  return all.find((choice) => choice.days === days)?.label ?? `${days} days`;
}

/** Settings card for "erase my data if the app isn't unlocked for a while". Off by default. */
export default function AutoEraseCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const db = useDatabase();
  const [userId, setUserId] = useState<number | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [settings, setSettings] = useState<AutoEraseSettings>({ days: null, lastUnlockedAt: null, autoErasedAt: null });
  const [choice, setChoice] = useState<number | null>(null);
  const [currentPin, setCurrentPin] = useState("");

  const load = useCallback(() => {
    async function run() {
      const user = await ensurePrimaryUser(db);
      const loaded = await getAutoEraseSettings(db, user.user_id);
      setUserId(user.user_id);
      setHasPin(hasUsablePin(user));
      setSettings(loaded);
      setChoice(loaded.days);
    }
    run().catch((error) => console.error("Failed to load auto-erase settings", error));
  }, [db]);

  useFocusEffect(load);

  const handleSave = async () => {
    if (!userId) return;

    if (currentPin.length !== 6 || !(await verifyUserPin(db, currentPin))) {
      Alert.alert("Incorrect PIN", "Enter your current PIN to change this setting.");
      return;
    }

    if (
      choice !== null &&
      !(await confirmDestructive(
        `If you don't unlock the app for ${labelForDays(choice)}, your cycle data and profile details will be permanently erased the next time the app is opened. This cannot be undone.`
      ))
    ) {
      return;
    }

    await setAutoEraseDays(db, userId, choice);
    setSettings(await getAutoEraseSettings(db, userId));
    setCurrentPin("");
    Alert.alert("Saved", choice === null ? "Auto-erase is off." : `The ${labelForDays(choice)} countdown has started.`);
  };

  const deadline = autoEraseDeadline(settings.lastUnlockedAt, settings.days);
  const options: { label: string; days: number | null }[] = [
    { label: "Off", days: null },
    ...AUTO_ERASE_CHOICES,
    ...(__DEV__ ? [AUTO_ERASE_TEST_CHOICE] : []),
  ];

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>Erase if unused</Text>
      <Text style={styles.body}>
        Erases your data if the app isn't unlocked for the time you choose. Every successful unlock
        restarts the countdown. The erase happens the next time the app is opened, and it cannot be undone.
      </Text>

      {!hasPin ? (
        <Text style={styles.body}>Set your normal PIN first.</Text>
      ) : (
        <>
          <Text style={styles.status}>Status: {settings.days === null ? "off" : `after ${labelForDays(settings.days)} unused`}</Text>
          {deadline ? (
            <Text style={styles.body}>Erases on or after {formatDate(deadline)} unless you unlock before then.</Text>
          ) : null}
          {settings.autoErasedAt ? (
            <Text style={styles.body}>Last automatic erase: {formatDate(new Date(settings.autoErasedAt))}.</Text>
          ) : null}

          <View style={styles.row}>
            {options.map((option) => (
              <Button
                key={option.label}
                mode={choice === option.days ? "contained" : "outlined"}
                onPress={() => setChoice(option.days)}
                style={styles.optionButton}
                compact
              >
                {option.label}
              </Button>
            ))}
          </View>

          <TextInput
            value={currentPin}
            onChangeText={setCurrentPin}
            placeholder="Current PIN"
            placeholderTextColor="rgba(244, 243, 238, 0.45)"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            style={styles.input}
          />
          <Button mode="contained" onPress={handleSave} disabled={choice === settings.days} style={styles.button}>
            Save
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.medium,
    borderRadius: theme.roundness * 3,
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    marginTop: theme.spacing.medium,
  },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  body: { color: "rgba(244, 243, 238, 0.75)", lineHeight: 18, marginBottom: theme.spacing.small },
  status: { color: theme.colors.text, marginBottom: theme.spacing.small },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: theme.spacing.small },
  optionButton: { minWidth: 90 },
  input: {
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.25)",
    borderRadius: theme.roundness * 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: theme.spacing.small,
  },
  button: { marginTop: theme.spacing.small },
});
