import { View, StyleSheet } from "react-native";
import { Link, Stack } from "expo-router";
import { useThemedStyles } from "@/contexts/ThemeContext";
import { Palette, type } from "@/theme/tokens";

// Fallback screen shown when no route matches anywhere in the app; links back to the root.
export default function NotFoundScreen() {
    const styles = useThemedStyles(makeStyles);

    return (
        <>
            <Stack.Screen options={{ title: 'Oops! Not Found' }} />
            <View style={styles.container}>
                <Link href="/" style={styles.button}>
                  Go back to home screen!
                </Link>
            </View>
        </>
    )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  button: {
    ...type.bodyStrong,
    textDecorationLine: 'underline',
    color: colors.accentInk,
  },
});