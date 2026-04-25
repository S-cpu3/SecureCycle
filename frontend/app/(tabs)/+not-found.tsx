import { View, StyleSheet } from "react-native";
import { Link, Stack } from "expo-router";
import { Text } from "react-native-paper";
import { theme } from "@/theme/theme";

// Fallback screen for any unmatched route inside the (tabs) group.
// In practice this should never appear, but guards against broken deep-links.
export default function TabsNotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View style={styles.container}>
        <Text style={styles.message}>This tab doesn't exist.</Text>
        <Link href="/(tabs)" style={styles.link}>
          Go to Home
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  message: {
    color: theme.colors.text,
    fontSize: 18,
    marginBottom: 16,
  },
  link: {
    color: theme.colors.secondary,
    fontSize: 16,
    textDecorationLine: "underline",
  },
});
