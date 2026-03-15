import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import LockScreen from "@/components/LockScreen";
import { Svg, Circle, Image } from "react-native-svg";
import { theme } from "@/theme/theme";

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

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
      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <AnimatedSvg height="200" width="200" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="50" fill={theme.colors.primary} />
          <Image
            href="@/assets/images/SafeCycleLogo.svg"
            width="80"
            height="80"
            x="10"
            y="10"
          />
        </AnimatedSvg>
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
  lockScreenContainer: {
    width: "100%",
    height: "100%",
  },
});
