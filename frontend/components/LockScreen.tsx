import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Image } from "expo-image";
import { Button } from "react-native-paper";
import * as LocalAuthentication from "expo-local-authentication";
import { theme } from "@/theme/theme";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useDatabase } from "@/hooks/use-database";
import { ensurePrimaryUser, verifyUserPin } from "@/dao/userDao";
import {
  clearFailedPinAttempts,
  getSecuritySettings,
  registerFailedPinAttempt,
} from "@/dao/securityDao";
import { isValidPinHash } from "@/utils/hash";

const PIN_LENGTH = 6;

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function LockScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [isPinSet, setIsPinSet] = useState(false);
  const [hasInvalidStoredPin, setHasInvalidStoredPin] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
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

  const navigateToTabs = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

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
      const security = await getSecuritySettings(db, user.user_id);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
      const hasPin = isValidPinHash(user.pin_hash) && Boolean(user.pin_salt);
      const hasInvalidPin = Boolean(user.pin_hash) && !hasPin;

      setUserId(user.user_id);
      setIsPinSet(hasPin);
      setHasInvalidStoredPin(hasInvalidPin);
      setLockedUntil(security.lockout_until ? new Date(security.lockout_until).getTime() : 0);
      setCanUseBiometrics(hasHardware && isEnrolled);
      setIsBiometricEnabled(security.biometric_enabled === 1);
      setIsLoaded(true);

      if (!hasPin && !hasInvalidPin) {
        handleUnlock();
      }
    }

    loadState().catch((error) => {
      console.error("Failed to load lock screen state", error);
      setIsLoaded(true);
    });
  }, [db, handleUnlock]);

  const handlePinChange = (value: string) => {
    if (isLocked || value.length > PIN_LENGTH) {
      return;
    }

    setPin(value);
  };

  const handlePinSubmit = async () => {
    if (!userId || isLocked || isVerifyingPin || pin.length !== PIN_LENGTH) {
      return;
    }

    if (!isPinSet) {
      setPin("");
      Alert.alert(
        "PIN Not Configured",
        hasInvalidStoredPin
          ? "The saved PIN hash is invalid. Reset the local app data, then set a new PIN from Profile."
          : "Set your app PIN from Profile before using PIN unlock."
      );
      return;
    }

    setIsVerifyingPin(true);
    try {
      const isValid = await verifyUserPin(db, userId, pin);

      if (isValid) {
        await clearFailedPinAttempts(db, userId);
        setPin("");
        setLockedUntil(0);
        handleUnlock();
        return;
      }

      const result = await registerFailedPinAttempt(db, userId);
      setPin("");
      setLockedUntil(new Date(result.lockoutUntil).getTime());
      Alert.alert("Incorrect PIN", `Try again in ${Math.ceil(result.backoffMs / 1000)} seconds.`);
    } finally {
      setIsVerifyingPin(false);
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
    setLockedUntil(0);
    handleUnlock();
  };

  const renderPinInput = () => {
    const displayPin = pin.padEnd(PIN_LENGTH, "_");

    return (
      <View style={styles.pinDisplayContainer}>
        {displayPin.split("").map((char, index) => (
          <Text key={index} style={styles.pinChar}>
            {char === "_" ? "_" : "*"}
          </Text>
        ))}
      </View>
    );
  };

  const renderNumberPad = () => {
    const numbers = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "back"],
    ];

    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberPadRow}>
            {row.map((num, colIndex) => (
              <Button
                key={colIndex}
                mode="outlined"
                style={styles.numberButton}
                labelStyle={styles.numberButtonLabel}
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
                disabled={(num === "" && (!canUseBiometrics || !isBiometricEnabled)) || isLocked || !isLoaded || isVerifyingPin}
              >
                {num === "back" ? "⌫" : num === "" ? " biometric " : num}
              </Button>
            ))}
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
        colors={[theme.colors.primary, theme.colors.secondary, theme.colors.background]}
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
          <Text style={styles.lockMessage}>Too many attempts. Try again in {lockSecondsRemaining}s.</Text>
        ) : hasInvalidStoredPin ? (
          <Text style={styles.lockMessage}>
            The saved PIN cannot be verified. Reset local app data and set a new PIN from Profile.
          </Text>
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
          disabled={pin.length !== PIN_LENGTH || isLocked || !isLoaded || !isPinSet || isVerifyingPin}
          style={styles.submitButton}
        >
          Unlock
        </Button>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    marginBottom: theme.spacing.small,
    color: "rgba(244, 243, 238, 0.78)",
    fontSize: 14,
  },
  lockMessage: {
    marginBottom: theme.spacing.medium,
    color: theme.colors.text,
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: theme.spacing.large,
  },
  lockMessageMuted: {
    marginBottom: theme.spacing.medium,
    color: "rgba(244, 243, 238, 0.7)",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: theme.spacing.large * 1.5,
    lineHeight: 18,
  },
  pinDisplayContainer: {
    flexDirection: "row",
    marginBottom: theme.spacing.medium,
  },
  pinChar: {
    fontSize: 30,
    color: theme.colors.text,
    marginHorizontal: theme.spacing.small * 1.25,
    borderBottomWidth: 2,
    borderColor: theme.colors.text,
    width: 20,
    textAlign: "center",
  },
  numberPad: {
    width: "80%",
    marginBottom: theme.spacing.medium,
  },
  numberPadRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: theme.spacing.small,
  },
  numberButton: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: theme.roundness * 5,
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  numberButtonLabel: {
    fontSize: 30,
    lineHeight: 32,
    color: theme.colors.primary,
  },
  submitButton: {
    marginTop: theme.spacing.medium,
    width: "80%",
    paddingVertical: theme.spacing.small,
    backgroundColor: theme.colors.primary,
  },
  logo: {
    width: 110,
    height: 110,
  },
});
