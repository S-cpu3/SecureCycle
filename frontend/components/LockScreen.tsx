import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert, AppState, Platform, Pressable } from "react-native";
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
import { useAuth } from "@/contexts/AuthContext"; // FIX 1: shared unlock state
import {
  attemptsUntilWipe,
  checkDuressPin,
  getDuressConfig,
  getWipeThreshold,
  hasUserData,
  wipeUserData,
} from "@/dao/duressDao";

const PIN_LENGTH = 6;

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function LockScreen() {
  const db = useDatabase();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { unlock, enterDuress } = useAuth();
  // Set when the duress PIN was typed, so the unlock animation ends on the decoy
  // screen instead of the real app. A ref (not state) so the animation callback
  // always sees the current value.
  const duressRef = useRef(false);
  const [pin, setPin] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isPinSet, setIsPinSet] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

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

  // Let AuthGate navigate after the auth-state update has committed. Navigating
  // here races the tab guard, which can still observe a locked session.
  // For a duress PIN the real app is never unlocked.
  const navigateToTabs = useCallback(() => {
    if (duressRef.current) {
      enterDuress();
      return;
    }

    unlock();
  }, [unlock, enterDuress]);

  const handleUnlock = useCallback(() => {
    if (isUnlocking) {
      return;
    }

    setIsUnlocking(true);
    lockScreenOpacity.value = withTiming(0, {
      duration: 220,
      easing: Easing.inOut(Easing.ease),
    });
    gradientOpacity.value = withTiming(1, {
      duration: 120,
      easing: Easing.inOut(Easing.ease),
    });
    logoOpacity.value = withTiming(1, {
      duration: 140,
      easing: Easing.out(Easing.ease),
    });
    gradientScale.value = withTiming(
      1.04,
      {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(navigateToTabs)();
        }
      }
    );
  }, [gradientOpacity, gradientScale, isUnlocking, lockScreenOpacity, logoOpacity, navigateToTabs]);

  useEffect(() => {
    async function loadState() {
      const user = await ensurePrimaryUser(db);
      // Inactivity auto-erase runs here, before the PIN screen accepts anything.
      // A failure in this optional feature must never stop the lock screen loading.
      try {
        await runAutoEraseIfDue(db, user.user_id);
      } catch (error) {
        console.error("Auto-erase check failed", error);
      }
      const security = await getSecuritySettings(db, user.user_id);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;

      // FIX 4: a pin_hash saved by the old, broken sha256() ("00000NaN...")
      // can't be verified against any real PIN. Treat it the same as "no PIN
      // set yet" so the user can set a fresh one instead of being locked out.
      const pinIsUsable = hasUsablePin(user);
      const duressConfig = await getDuressConfig(db, user.user_id);

      setUserId(user.user_id);
      setIsPinSet(pinIsUsable);
      setLockedUntil(security.lockout_until ? new Date(security.lockout_until).getTime() : 0);
      setCanUseBiometrics(hasHardware && isEnrolled);
      // A coerced person can be made to use their face or finger, which would
      // open the real data. While a duress PIN exists, biometric unlock is off.
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

  // Restarts the inactivity auto-erase countdown. Must never block an unlock.
  const markUnlocked = async (uid: number) => {
    try {
      await touchLastUnlock(db, uid);
    } catch (error) {
      console.error("Failed to record unlock time", error);
    }
  };

  // The lock screen can stay mounted for days in the background, so run the
  // check again whenever the app comes back to the foreground.
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
    if (isLocked || value.length > PIN_LENGTH) {
      return;
    }

    setPin(value);
  };

  const handlePinSubmit = async () => {
    if (!userId || isLocked || pin.length !== PIN_LENGTH) {
      return;
    }

    if (!isPinSet) {
      await updateUserPin(db, userId, pin);
      await clearFailedPinAttempts(db, userId);
      setPin("");
      setIsPinSet(true);
      setLockedUntil(0);
      handleUnlock();
      return;
    }

    // Both checks always run so the work done does not reveal which PIN was typed.
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
      // Must look exactly like a normal unlock: failed attempts are cleared, no
      // alert, same animation. If anything below throws, fall through and treat
      // it as a wrong PIN rather than showing an error that gives it away.
      try {

        if (duressAction === "wipe") {
          try {
            await wipeUserData(db);
          } catch (error) {
            // The decoy still shows and the real app stays locked either way.
            console.error("Duress wipe failed", error);
          }
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

    // Optional "erase after N wrong PINs". Counts attempts, not time, so changing
    // the phone's clock doesn't help. The erase is silent: the screen looks the
    // same as any other wrong PIN. Only the last 3 attempts show a warning, to
    // protect an owner who is simply mistyping.
    let warning = "";
    try {
      const remaining = attemptsUntilWipe(result.failedAttempts, await getWipeThreshold(db, userId));

      if (remaining === 0) {
        if (await hasUserData(db)) {
          await wipeUserData(db);
        }
      } else if (remaining !== null && remaining <= 3) {
        warning = ` ${remaining} more wrong ${remaining === 1 ? "attempt" : "attempts"} will erase your data.`;
      }
    } catch (error) {
      console.error("Failed-attempt erase check failed", error);
    }

    Alert.alert("Incorrect PIN", `Try again in ${Math.ceil(result.backoffMs / 1000)} seconds.${warning}`);
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

  // Entered digits show as filled dots, never as characters.
  const renderPinInput = () => (
    <View
      style={styles.pinDisplayContainer}
      accessible
      accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}
    >
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <View key={index} style={[styles.pinDot, index < pin.length && styles.pinDotFilled]} />
      ))}
    </View>
  );

  const renderNumberPad = () => {
    const numbers = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "back"],
    ];
    const biometricIcon = Platform.OS === "ios" ? "face-recognition" : "fingerprint";

    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberPadRow}>
            {row.map((num, colIndex) => {
              const isAction = num === "" || num === "back";
              const disabled =
                (num === "" && (!canUseBiometrics || !isBiometricEnabled)) || isLocked || !isLoaded;

              return (
                <Pressable
                  key={colIndex}
                  accessibilityRole="button"
                  accessibilityLabel={
                    num === "back" ? "Delete digit" : num === "" ? "Unlock with biometrics" : num
                  }
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  android_ripple={{ color: colors.border, borderless: true, radius: size.pinKey / 2 }}
                  style={({ pressed }) => [
                    styles.numberButton,
                    isAction && styles.actionButton,
                    pressed && !isAction && styles.numberButtonPressed,
                    disabled && styles.numberButtonDisabled,
                    // Hide the biometric key entirely when biometrics are off.
                    num === "" && (!canUseBiometrics || !isBiometricEnabled) && styles.hiddenButton,
                  ]}
                  onPress={() => {
                    if (num === "back") {
                      if (!isLocked) {
                        setPin((previous) => previous.slice(0, -1));
                      }
                      return;
                    }

                    if (num === "") {
                      handleBiometricAuth();
                      return;
                    }

                    handlePinChange(pin + num);
                  }}
                >
                  {num === "back" ? (
                    <MaterialCommunityIcons name="backspace-outline" size={28} color={colors.accentInk} />
                  ) : num === "" ? (
                    <MaterialCommunityIcons name={biometricIcon} size={30} color={colors.accentInk} />
                  ) : (
                    <Text style={styles.numberButtonLabel} maxFontSizeMultiplier={1.4}>
                      {num}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const lockScreenAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: lockScreenOpacity.value,
    };
  });

  const gradientAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: gradientOpacity.value,
      transform: [{ scale: gradientScale.value }],
    };
  });

  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: logoOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      <AnimatedLinearGradient
        colors={[colors.primary, colors.accent, colors.background]}
        style={[styles.gradientOverlay, gradientAnimatedStyle]}
      >
        <Animated.View style={logoAnimatedStyle}>
          <Image source={require("../assets/images/SafeCycleLogo.png")} style={styles.logo} contentFit="contain" />
        </Animated.View>
      </AnimatedLinearGradient>

      <Animated.View style={[styles.lockScreenContainer, lockScreenAnimatedStyle]}>
        {renderPinInput()}
        <Text style={styles.helperText}>
          {isPinSet ? "Enter your 6-digit PIN" : "Set a PIN later from Profile"}
        </Text>
        {isLocked ? (
          <Text style={styles.lockMessage}>Incorrect PIN. Try again in {lockSecondsRemaining}s.</Text>
        ) : (
          <Text style={styles.lockMessageMuted}>
            {isBiometricEnabled && canUseBiometrics
              ? "Biometric unlock is enabled without device passcode fallback."
              : "Biometric unlock can be enabled later from Profile."}
          </Text>
        )}
        {renderNumberPad()}
        <Button
          mode="contained"
          onPress={handlePinSubmit}
          disabled={pin.length !== PIN_LENGTH || isLocked || !isLoaded}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
        >
          {isPinSet ? "Unlock" : "Set PIN"}
        </Button>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  lockScreenContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  helperText: {
    ...type.cardTitle,
    marginBottom: space[1],
    color: colors.ink,
  },
  lockMessage: {
    ...type.body,
    marginBottom: space[6],
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: space[6],
  },
  lockMessageMuted: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: space[6],
    color: colors.inkMuted,
    textAlign: "center",
    paddingHorizontal: space[8],
  },
  pinDisplayContainer: {
    flexDirection: "row",
    gap: space[3],
    marginBottom: space[6],
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  pinDotFilled: {
    backgroundColor: colors.accentInk,
    borderColor: colors.accentInk,
  },
  numberPad: {
    width: "80%",
    maxWidth: 320,
    marginBottom: space[4],
  },
  numberPadRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: space[4],
  },
  numberButton: {
    width: size.pinKey,
    height: size.pinKey,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.full,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  actionButton: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  numberButtonPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  numberButtonDisabled: {
    opacity: 0.4,
  },
  hiddenButton: {
    opacity: 0,
  },
  numberButtonLabel: {
    ...type.pinDigit,
    color: colors.ink,
  },
  submitButton: {
    marginTop: space[2],
    width: "80%",
    maxWidth: 320,
    borderRadius: radius.lg,
  },
  submitButtonContent: {
    minHeight: size.touchTarget,
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: radius.lg,
  },
});
