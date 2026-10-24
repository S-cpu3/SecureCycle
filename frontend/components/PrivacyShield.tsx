import React, { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Animated, Image, StyleSheet, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

// Covers the app whenever it is not active, so the app-switcher snapshot shows
// this screen instead of health data. Opaque on purpose: a blur can still reveal
// shapes and colours.
export default function PrivacyShield({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const [pointerEvents, setPointerEvents] = useState<"none" | "auto">("none");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState !== "active") {
        // Stop any fade-out still running, so the cover can't fade away
        // while the app is in the background.
        opacity.stopAnimation();
        opacity.setValue(1);
        setPointerEvents("auto");
        return;
      }

      setPointerEvents("none");
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });

    return () => subscription.remove();
  }, [opacity]);

  return (
    <View style={styles.root}>
      {children}
      <Animated.View
        pointerEvents={pointerEvents}
        style={[styles.cover, { backgroundColor: colors.background, opacity }]}
      >
        <Image
          source={require("../assets/images/SafeCycleLogo.png")}
          style={styles.logo}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  logo: StyleSheet.absoluteFillObject,
});
