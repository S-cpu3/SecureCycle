import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme/theme";


const RETRY_DELAY_MS = 1600;

export default function DecoyScreen() {
  const insets = useSafeAreaInsets();
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
          <ActivityIndicator size="large" color={theme.colors.primary} />
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
            <Button mode="outlined" onPress={retry} style={styles.button}>
              Go home
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  iconText: { color: theme.colors.primary, fontSize: 40, fontWeight: "700", lineHeight: 46 },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  body: {
    color: "rgba(244, 243, 238, 0.75)",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  code: { color: "rgba(244, 243, 238, 0.45)", fontSize: 13 },
  loadingText: { color: "rgba(244, 243, 238, 0.75)", fontSize: 16, marginTop: 16 },
  actions: { gap: 12 },
  button: { paddingVertical: 4 },
});
