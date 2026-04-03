import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import LockScreen from "@/components/LockScreen";
import { theme } from "@/theme/theme";

export default function Index() {
  const logoY = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const lockScreenOpacity = useSharedValue(0);

  useEffect(() => {
    logoY.value = withTiming(-150, {
      duration: 1000,
      easing: Easing.inOut(Easing.ease),
    });
    logoScale.value = withTiming(0.5, {
      duration: 1000,
      easing: Easing.inOut(Easing.ease),
    });
    lockScreenOpacity.value = withTiming(1, {
      duration: 1000,
      easing: Easing.inOut(Easing.ease),
    });
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoY.value }, { scale: logoScale.value }],
    };
  });

  const lockScreenAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: lockScreenOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, styles.logoBadge, logoAnimatedStyle]}>
        <Image source={require("../assets/images/SafeCycleLogo.png")} style={styles.logoImage} contentFit="contain" />
      </Animated.View>
      <Animated.View
        style={[styles.lockScreenContainer, lockScreenAnimatedStyle]}
      >
        <LockScreen />
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
  logoContainer: {
    position: "absolute",
    alignItems: "center",
  },
  logoBadge: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    overflow: "hidden",
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  lockScreenContainer: {
    width: "100%",
    height: "100%",
  },
});
