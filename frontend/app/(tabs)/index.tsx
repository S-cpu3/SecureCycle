import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { Link } from "expo-router";
import CycleTracker from "@/components/CycleTracker";
import { theme } from "@/theme/theme";

export const metadata = {
  title: "Home",
};

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.background,
      }}
    >
      <CycleTracker />
    </View>
  );
}

const style = StyleSheet.create({
})
