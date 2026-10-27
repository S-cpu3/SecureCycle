import React, { useCallback, useState } from "react";
import { Alert, StyleProp, Text, TextInput, View, ViewStyle } from "react-native";
import { Button } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { makeSecurityCardStyles } from "@/components/securityCardStyles";
import { useDatabase } from "@/hooks/use-database";
import { ensurePrimaryUser, hasUsablePin, verifyUserPin } from "@/dao/userDao";
import { setBiometricEnabled } from "@/dao/securityDao";
import {
  clearDuressPin,
  DuressAction,
  DuressConfig,
  getDuressConfig,
  setDuressPin,
} from "@/dao/duressDao";

function confirmDestructive(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Erase data on duress PIN?", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "I understand", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Settings card for the duress PIN. A duress session never reaches the Profile
 * screen (it shows the decoy error screen instead), so this card is only ever
 * visible after a normal unlock.
 */
export default function DuressPinCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const db = useDatabase();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeSecurityCardStyles);
  const [userId, setUserId] = useState<number | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [config, setConfig] = useState<DuressConfig>({ isSet: false, action: null });
  const [action, setAction] = useState<DuressAction>("decoy");
  const [currentPin, setCurrentPin] = useState("");
  const [duressPin, setDuressPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const load = useCallback(() => {
    async function run() {
      const user = await ensurePrimaryUser(db);
      setUserId(user.user_id);
      setHasPin(hasUsablePin(user));
      setConfig(await getDuressConfig(db, user.user_id));
    }
    run().catch((error) => console.error("Failed to load duress settings", error));
  }, [db]);

  useFocusEffect(load);

  const resetFields = () => {
    setCurrentPin("");
    setDuressPinValue("");
    setConfirmPin("");
  };

  const handleSave = async () => {
    if (!userId) return;

    if (currentPin.length !== 6 || duressPin.length !== 6 || confirmPin.length !== 6) {
      Alert.alert("PIN Required", "Enter your current PIN and the new duress PIN (6 digits each).");
      return;
    }
    if (duressPin !== confirmPin) {
      Alert.alert("PIN Mismatch", "The two duress PIN entries do not match.");
      return;
    }
    if (!(await verifyUserPin(db, currentPin))) {
      Alert.alert("Incorrect PIN", "Your current PIN didn't match.");
      return;
    }
    if (await verifyUserPin(db, duressPin)) {
      Alert.alert("Choose a different PIN", "The duress PIN must not be the same as your real PIN.");
      return;
    }
    if (
      action === "wipe" &&
      !(await confirmDestructive(
        "Entering this PIN will permanently delete your cycle data and profile details. It cannot be undone."
      ))
    ) {
      return;
    }

    await setDuressPin(db, userId, duressPin, action);
    // Biometrics would open the real data under coercion, so they are turned off.
    await setBiometricEnabled(db, userId, false);
    resetFields();
    setConfig(await getDuressConfig(db, userId));
    Alert.alert("Duress PIN saved", "Only use your Duress PIN when needed");
  };

  const handleRemove = async () => {
    if (!userId) return;
    if (currentPin.length !== 6 || !(await verifyUserPin(db, currentPin))) {
      Alert.alert("Incorrect PIN", "Enter your current PIN to remove the duress PIN.");
      return;
    }
    await clearDuressPin(db, userId);
    resetFields();
    setConfig(await getDuressConfig(db, userId));
    Alert.alert("Removed", "The duress PIN has been removed.");
  };

  const placeholderColor = colors.inkSubtle;

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>Duress PIN</Text>
      <Text style={styles.body}>
        A second PIN for when you are forced to unlock the app. It plays the normal unlock animation,
        then shows a fake "Something went wrong" error screen instead of SecureCycle. Your real app stays locked.
      </Text>

      {!hasPin ? (
        <Text style={styles.body}>Set your normal PIN first.</Text>
      ) : (
        <>
          <Text style={styles.status}>
            Status: {config.isSet ? `on (${config.action === "wipe" ? "error screen + erases data" : "error screen"})` : "off"}
          </Text>

          <View style={styles.row}>
            <Button
              mode={action === "decoy" ? "contained" : "outlined"}
              textColor={action === "decoy" ? colors.onPrimary : colors.ink}
              onPress={() => setAction("decoy")}
              style={styles.rowButton}
            >
              Error screen only
            </Button>
            <Button
              mode={action === "wipe" ? "contained" : "outlined"}
              textColor={action === "wipe" ? colors.onPrimary : colors.ink}
              onPress={() => setAction("wipe")}
              style={styles.rowButton}
            >
              Error screen + erase
            </Button>
          </View>

          <TextInput value={currentPin} onChangeText={setCurrentPin} placeholder="Current PIN" placeholderTextColor={placeholderColor} keyboardType="number-pad" maxLength={6} secureTextEntry style={styles.input} />
          <TextInput value={duressPin} onChangeText={setDuressPinValue} placeholder="New duress PIN" placeholderTextColor={placeholderColor} keyboardType="number-pad" maxLength={6} secureTextEntry style={styles.input} />
          <TextInput value={confirmPin} onChangeText={setConfirmPin} placeholder="Confirm duress PIN" placeholderTextColor={placeholderColor} keyboardType="number-pad" maxLength={6} secureTextEntry style={styles.input} />

          <Button mode="contained" onPress={handleSave} style={styles.button}>
            {config.isSet ? "Replace duress PIN" : "Save duress PIN"}
          </Button>
          {config.isSet ? (
            <Button
              mode="outlined"
              onPress={handleRemove}
              textColor={colors.danger}
              style={[styles.button, { borderColor: colors.danger }]}
            >
              Remove duress PIN
            </Button>
          ) : null}
        </>
      )}
    </View>
  );
}
