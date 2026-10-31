import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert, AppState, Platform, Pressable, TextInput } from "react-native";
import { Image } from "expo-image";
import { Button } from "react-native-paper";
import * as LocalAuthentication from "expo-local-authentication";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { Palette, radius, size, space, type } from "@/theme/tokens";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useDatabase } from "@/hooks/use-database";
import { ensurePrimaryUser, hasUsablePin, updateUserPin, verifyUserPin } from "@/dao/userDao";
import {
  clearFailedPinAttempts,
  getSecuritySettings,
  registerFailedPinAttempt,
} from "@/dao/securityDao";
import { runAutoEraseIfDue, touchLastUnlock } from "@/dao/autoEraseDao";
import { useAuth } from "@/contexts/AuthContext";
import {
  attemptsUntilWipe,
  checkDuressPin,
  getDuressConfig,
  getWipeThreshold,
  hasUserData,
  wipeUserData,
} from "@/dao/duressDao";
import { sha256 } from "@/utils/hash";
import { verifyRecoveryPhrase } from "@/dao/userDao";

const PIN_LENGTH = 6;

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function LockScreen() {
  const db = useDatabase();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { unlock, enterDuress } = useAuth();
  const duressRef = useRef(false);
  const submittingRef = useRef(false);
  const [pin, setPin] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isPinSet, setIsPinSet] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");

  const lockScreenOpacity = useSharedValue(1);
  const gradientOpacity = useSharedValue(0);
  const gradientScale = useSharedValue(0.92);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    if (lockedUntil <= Date.now()) {
      return;
    }
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const lockSecondsRemaining = useMemo(() => {
    return Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  }, [lockedUntil, now]);

  const isLocked = lockSecondsRemaining > 0;

  const navigateToTabs = useCallback(() => {
    if (duressRef.current) {
      enterDuress();
      return;
    }
    unlock();
  }, [unlock, enterDuress]);

  const handleUnlock = useCallback(() => {
    if (isUnlocking) return;
    setIsUnlocking(true);
    lockScreenOpacity.value = withTiming(0, { duration: 220, easing: Easing.inOut(Easing.ease) });
    gradientOpacity.value = withTiming(1, { duration: 120, easing: Easing.inOut(Easing.ease) });
    logoOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.ease) });
    gradientScale.value = withTiming(1.04, { duration: 520, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) { runOnJS(navigateToTabs)(); }
    });
  }, [gradientOpacity, gradientScale, isUnlocking, lockScreenOpacity, logoOpacity, navigateToTabs]);

  useEffect(() => {
    async function loadState() {
      const user = await ensurePrimaryUser(db);
      try {
        await runAutoEraseIfDue(db, user.user_id);
      } catch (error) {
        console.error("Auto-erase check failed", error);
      }
      const security = await getSecuritySettings(db, user.user_id);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
      const pinIsUsable = hasUsablePin(user);
      const duressConfig = await getDuressConfig(db, user.user_id);

      setUserId(user.user_id);
      setIsPinSet(pinIsUsable);
      setLockedUntil(security.lockout_until ? new Date(security.lockout_until).getTime() : 0);
      setCanUseBiometrics(hasHardware && isEnrolled);
      setIsBiometricEnabled(security.biometric_enabled === 1 && !duressConfig.isSet);
      setIsLoaded(true);

      if (!pinIsUsable) {
        handleUnlock();
      }
    }
    loadState().catch((error) => {
      console.error("Failed to load lock screen state", error);
      setIsLoaded(true);
    });
  }, [db, handleUnlock]);

  const markUnlocked = async (uid: number) => {
    try {
      await touchLastUnlock(db, uid);
    } catch (error) {
      console.error("Failed to record unlock time", error);
    }
  };

  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        runAutoEraseIfDue(db, userId).catch((error) => console.error("Auto-erase check failed", error));
      }
    });
    return () => subscription.remove();
  }, [db, userId]);

  const handlePinChange = (value: string) => {
    if (isLocked || value.length > PIN_LENGTH) return;
    setPin(value);
  };

  const checkPin = async () => {
    if (!userId || isLocked || pin.length !== PIN_LENGTH) return;
    if (!isPinSet) {
      await updateUserPin(db, userId, pin);
      await clearFailedPinAttempts(db, userId);
      setPin("");
      setIsPinSet(true);
      setLockedUntil(0);
      handleUnlock();
      return;
    }
    const isValid = await verifyUserPin(db, pin);
    const duressAction = await checkDuressPin(db, userId, pin);
    if (isValid) {
      await clearFailedPinAttempts(db, userId);
      await markUnlocked(userId);
      setPin("");
      setLockedUntil(0);
      handleUnlock();
      return;
    }
    if (duressAction) {
      try {
        if (duressAction === "wipe") {
          try { await wipeUserData(db); } catch (error) { console.error("Duress wipe failed", error); }
        }
        duressRef.current = true;
        setPin("");
        setLockedUntil(0);
        handleUnlock();
        return;
      } catch (error) {
        console.error("Duress session failed", error);
      }
    }
    const result = await registerFailedPinAttempt(db, userId);
    setPin("");
    setLockedUntil(new Date(result.lockoutUntil).getTime());
    let warning = "";
    try {
      const remaining = attemptsUntilWipe(result.failedAttempts, await getWipeThreshold(db, userId));
      if (remaining === 0) {
        if (await hasUserData(db)) { await wipeUserData(db); }
      } else if (remaining !== null && remaining <= 3) {
        warning = ` ${remaining} more wrong ${remaining === 1 ? "attempt" : "attempts"} will erase your data.`;
      }
    } catch (error) {
      console.error("Failed-attempt erase check failed", error);
    }
    Alert.alert("Incorrect PIN", `Try again in ${Math.ceil(result.backoffMs / 1000)} seconds.${warning}`);
  };

  const handlePinSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await checkPin();
    } catch (error) {
      console.error("PIN check failed", error);
      setPin("");
      Alert.alert("PIN check failed", "The PIN could not be checked. Please try again.");
    } finally {
      submittingRef.current = false;
    }
  };

  const handleBiometricAuth = async () => {
    if (!userId || isLocked || !isBiometricEnabled || !canUseBiometrics) {
      Alert.alert("Unavailable", "Face ID or biometrics are not enabled on this device.");
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to unlock SafeCycle",
      disableDeviceFallback: true,
    });
    if (!result.success) {
      Alert.alert("Authentication Failed", result.error || "Could not authenticate.");
      return;
    }
    await clearFailedPinAttempts(db, userId);
    await markUnlocked(userId);
    setLockedUntil(0);
    handleUnlock();
  };

  const handleRecoverySubmit = async () => {
    if (!userId || !recoveryInput) return;
    try {
      const isValid = await verifyRecoveryPhrase(db, userId, recoveryInput, sha256);
      if (isValid) {
        Alert.alert("Verified", "Recovery phrase accepted. Please set a new PIN.");
        setIsPinSet(false);
        setIsRecovering(false);
        setRecoveryInput("");
        setPin("");
      } else {
        Alert.alert("Failed", "Invalid recovery phrase.");
      }
    } catch (error) {
      console.error("Recovery failed", error);
      Alert.alert("Error", "An error occurred during recovery.");
    }
  };

  const renderPinInput = () => (
    <View style={styles.pinDisplayContainer} accessible accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}>
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <View key={index} style={[styles.pinDot, index < pin.length && styles.pinDotFilled]} />
      ))}
    </View>
  );

  const renderNumberPad = () => {
    const numbers = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "back"]];
    const biometricIcon = Platform.OS === "ios" ? "face-recognition" : "fingerprint";
    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberPadRow}>
            {row.map((num, colIndex) => {
              const isAction = num === "" || num === "back";
              const disabled = (num === "" && (!canUseBiometrics || !isBiometricEnabled)) || isLocked || !isLoaded;
              return (
                <Pressable
                  key={colIndex}
                  accessibilityRole="button"
                  accessibilityLabel={num === "back" ? "Delete digit" : num === "" ? "Unlock with biometrics" : num}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  android_ripple={{ color: colors.border, borderless: true, radius: size.pinKey / 2 }}
                  style={({ pressed }) => [styles.numberButton, isAction && styles.actionButton, pressed && !isAction && styles.numberButtonPressed, disabled && styles.numberButtonDisabled, num === "" && (!canUseBiometrics || !isBiometricEnabled) && styles.hiddenButton]}
                  onPress={() => {
                    if (num === "back") {
                      if (!isLocked) setPin((previous) => previous.slice(0, -1));
                      return;
                    }
                    if (num === "") {
                      handleBiometricAuth();
                      return;
                    }
                    handlePinChange(pin + num);
                  }}
                >
                  {num === "back" ? <MaterialCommunityIcons name="backspace-outline" size={28} color={colors.accentInk} /> : num === "" ? <MaterialCommunityIcons name={biometricIcon} size={30} color={colors.accentInk} /> : <Text style={styles.numberButtonLabel} maxFontSizeMultiplier={1.4}>{num}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const lockScreenAnimatedStyle = useAnimatedStyle(() => ({ opacity: lockScreenOpacity.value }));
  const gradientAnimatedStyle = useAnimatedStyle(() => ({ opacity: gradientOpacity.value, transform: [{ scale: gradientScale.value }] }));
  const logoAnimatedStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));

  return (
    <View style={styles.container}>
      {isRecovering ? (
        <View style={styles.recoveryView}>
          <Text style={styles.helperText}>Recovery Mode</Text>
          <Text style={styles.lockMessageMuted}>Enter your 12-word phrase separated by spaces</Text>
          <TextInput
            style={styles.recoveryInput}
            value={recoveryInput}
            onChangeText={setRecoveryInput}
            placeholder="word1 word2 word3..."
            placeholderTextColor={colors.inkMuted}
            multiline
          />
          <Button mode="contained" onPress={handleRecoverySubmit} style={styles.submitButton}>
            Verify & Reset PIN
          </Button>
          <Button onPress={() => setIsRecovering(false)} style={{ marginTop: 10 }}>
            Back to Lock Screen
          </Button>
        </View>
      ) : (
        <View style={styles.lockScreenContainer}>
          <AnimatedLinearGradient colors={[colors.primary, colors.accent, colors.background]} style={[styles.gradientOverlay, gradientAnimatedStyle]}>
            <Animated.View style={logoAnimatedStyle}>
              <Image source={require("../assets/images/SafeCycleLogo.png")} style={styles.logo} contentFit="contain" />
            </Animated.View>
          </AnimatedLinearGradient>
          {renderPinInput()}
          <Text style={styles.helperText}>{isPinSet ? "Enter your 6-digit PIN" : "Set a PIN later from Profile"}</Text>
          {isLocked ? <Text style={styles.lockMessage}>Incorrect PIN. Try again in {lockSecondsRemaining}s.</Text> : <Text style={styles.lockMessageMuted}>{isBiometricEnabled && canUseBiometrics ? "Biometric unlock is enabled without device passcode fallback." : "Biometric unlock can be enabled later from Profile."}</Text>}
          {renderNumberPad()}
          <Button mode="contained" onPress={handlePinSubmit} disabled={pin.length !== PIN_LENGTH || isLocked || !isLoaded} style={styles.submitButton} contentStyle={styles.submitButtonContent}>
            {isPinSet ? "Unlock" : "Set PIN"}
          </Button>
          <Pressable onPress={() => setIsRecovering(true)} style={{ marginTop: 20 }}>
            <Text style={{ color: colors.accent, textAlign: 'center', fontWeight: '600' }}>Forgot your PIN?</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  gradientOverlay: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center" },
  lockScreenContainer: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  recoveryView: { width: "100%", padding: space[6], justifyContent: "center", alignItems: "center" },
  recoveryInput: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space[4],
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.ink,
    marginBottom: space[6],
    textAlign: "center",
    minHeight: 100,
  },
  helperText: { ...type.cardTitle, marginBottom: space[1], color: colors.ink },
  lockMessage: { ...type.body, marginBottom: space[6], color: colors.danger, textAlign: "center", paddingHorizontal: space[6] },
  lockMessageMuted: { ...type.caption, fontSize: 13, lineHeight: 18, marginBottom: space[6], color: colors.inkMuted, textAlign: "center", paddingHorizontal: space[8] },
  pinDisplayContainer: { flexDirection: "row", gap: space[3], marginBottom: space[6] },
  pinDot: { width: 14, height: 14, borderRadius: radius.full, borderWidth: 2, borderColor: colors.borderStrong },
  pinDotFilled: { backgroundColor: colors.accentInk, borderColor: colors.accentInk },
  numberPad: { width: "80%", maxWidth: 320, marginBottom: space[4] },
  numberPadRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: space[4] },
  numberButton: { width: size.pinKey, height: size.pinKey, justifyContent: "center", alignItems: "center", borderRadius: radius.full, borderColor: colors.borderStrong, borderWidth: 1, backgroundColor: colors.surface },
  actionButton: { borderColor: "transparent", backgroundColor: "transparent" },
  numberButtonPressed: { backgroundColor: colors.surfaceRaised },
  numberButtonDisabled: { opacity: 0.4 },
  hiddenButton: { opacity: 0 },
  numberButtonLabel: { ...type.pinDigit, color: colors.ink },
  submitButton: { marginTop: space[2], width: "80%", maxWidth: 320, borderRadius: radius.lg },
  submitButtonContent: { minHeight: size.touchTarget },
  logo: { width: 110, height: 110, borderRadius: radius.lg },
});
