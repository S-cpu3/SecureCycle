import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { Palette, radius, space, type } from "@/theme/tokens";


const RETRY_DELAY_MS = 1600;

export default function DecoyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [isRetrying, setIsRetrying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Both buttons "try again": a short spinner, then the same error. Nothing
  // here can ever lead to the real app.
  const retry = () => {
    if (isRetrying) return;
    setIsRetrying(true);
    timer.current = setTimeout(() => setIsRetrying(false), RETRY_DELAY_MS);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {isRetrying ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading your data…</Text>
        </View>
      ) : (
        <>
          <View style={styles.center}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>!</Text>
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>
              SecureCycle couldn't load your data. This is usually temporary. Please try again.
            </Text>
            <Text style={styles.code}>Error code: SC-4012</Text>
          </View>

          <View style={styles.actions}>
            <Button mode="contained" onPress={retry} style={styles.button}>
              Try again
            </Button>
            <Button mode="outlined" textColor={colors.ink} onPress={retry} style={styles.button}>
              Go home
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: space[6],
    justifyContent: "space-between",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[6],
  },
  iconText: { color: colors.danger, fontSize: 40, fontWeight: "700", lineHeight: 46 },
  title: { ...type.sectionTitle, fontSize: 24, lineHeight: 30, color: colors.ink, marginBottom: space[3], textAlign: "center" },
  body: {
    ...type.body,
    fontSize: 16,
    color: colors.inkMuted,
    textAlign: "center",
    marginBottom: space[4],
  },
  code: { ...type.caption, fontSize: 13, color: colors.inkSubtle },
  loadingText: { ...type.body, fontSize: 16, color: colors.inkMuted, marginTop: space[4] },
  actions: { gap: space[3] },
  button: { paddingVertical: space[1], borderRadius: radius.lg },
});
