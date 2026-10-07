import React, { useCallback, useState } from "react";
import { Alert, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { Button } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { theme } from "@/theme/theme";
import { useDatabase } from "@/hooks/use-database";
import { ensurePrimaryUser, hasUsablePin, verifyUserPin } from "@/dao/userDao";
import { getWipeThreshold, setWipeThreshold, WIPE_THRESHOLD_CHOICES } from "@/dao/duressDao";

function confirmDestructive(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Erase data after wrong PINs?", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "I understand", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

/** Settings card for "erase data after N wrong PINs". Off by default. */
export default function AutoWipeCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const db = useDatabase();
  const [userId, setUserId] = useState<number | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [currentPin, setCurrentPin] = useState("");

  const load = useCallback(() => {
    async function run() {
      const user = await ensurePrimaryUser(db);
      const threshold = await getWipeThreshold(db, user.user_id);
      setUserId(user.user_id);
      setHasPin(hasUsablePin(user));
      setCurrent(threshold);
      setChoice(threshold);
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
        `After ${choice} wrong PIN attempts in a row, your cycle data and profile details will be permanently erased. This cannot be undone.`
      ))
    ) {
      return;
    }

    await setWipeThreshold(db, userId, choice);
    setCurrent(choice);
    setCurrentPin("");
    Alert.alert("Saved", choice === null ? "Auto-erase is off." : `Data will be erased after ${choice} wrong PINs.`);
  };

  const options: (number | null)[] = [null, ...WIPE_THRESHOLD_CHOICES];

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>Erase after wrong PINs</Text>
      <Text style={styles.body}>
        If someone enters the wrong PIN too many times in a row, your data is erased silently. A correct
        PIN resets the count. You are warned on the last 3 attempts. This cannot be undone.
      </Text>

      {!hasPin ? (
        <Text style={styles.body}>Set your normal PIN first.</Text>
      ) : (
        <>
          <Text style={styles.status}>Status: {current === null ? "off" : `after ${current} wrong PINs`}</Text>
          <View style={styles.row}>
            {options.map((option) => (
              <Button
                key={String(option)}
                mode={choice === option ? "contained" : "outlined"}
                onPress={() => setChoice(option)}
                style={styles.rowButton}
                compact
              >
                {option === null ? "Off" : String(option)}
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
          <Button mode="contained" onPress={handleSave} disabled={choice === current} style={styles.button}>
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
  row: { flexDirection: "row", gap: 8, marginBottom: theme.spacing.small },
  rowButton: { flex: 1 },
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
