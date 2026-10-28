import React, { useEffect, useState } from "react";
import { AppState, AppStateStatus, Image, StyleSheet, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

// Covers the app whenever it is not active, so the app-switcher snapshot shows
// this screen instead of health data. The cover is shown or removed by state, with
// no animation, so it can't get stuck on top of the app.
export default function PrivacyShield({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [isCovered, setIsCovered] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      setIsCovered(nextState !== "active");
    });

    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.root}>
      {children}
      {isCovered && (
        <View style={[styles.cover, { backgroundColor: colors.background }]}>
          <Image
            source={require("../assets/images/SafeCycleLogo.png")}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  logo: StyleSheet.absoluteFill,
});
