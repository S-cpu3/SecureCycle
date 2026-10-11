import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ColorScheme, palette, Palette } from "@/theme/tokens";

// The user's appearance choice from Profile. "system" follows the OS setting.
export type Appearance = "system" | "light" | "dark";

const APPEARANCE_KEY = "appearance";

type ThemeContextValue = {
  colors: Palette;
  scheme: ColorScheme;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isAppearance(value: string | null): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}

// SecureStore only exists on iOS and Android; the web preview keeps the choice in localStorage.
async function readAppearance(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(APPEARANCE_KEY) ?? null;
  }

  return SecureStore.getItemAsync(APPEARANCE_KEY);
}

async function writeAppearance(value: Appearance) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(APPEARANCE_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(APPEARANCE_KEY, value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>("system");

  // The preference lives on the device with the app's other local settings.
  useEffect(() => {
    readAppearance()
      .then((stored) => {
        if (isAppearance(stored)) {
          setAppearanceState(stored);
        }
      })
      .catch((error) => console.error("Failed to load appearance preference", error));
  }, []);

  const setAppearance = useCallback((next: Appearance) => {
    setAppearanceState(next);
    writeAppearance(next).catch((error) =>
      console.error("Failed to save appearance preference", error)
    );
  }, []);

  const scheme: ColorScheme =
    appearance === "system" ? (systemScheme === "light" ? "light" : "dark") : appearance;

  const value = useMemo(
    () => ({ colors: palette[scheme] as Palette, scheme, appearance, setAppearance }),
    [scheme, appearance, setAppearance]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Current palette and appearance controls. Outside a ThemeProvider (for example
 * an error fallback rendered above it) this falls back to the OS colour scheme.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  const systemScheme = useColorScheme();

  if (context) {
    return context;
  }

  const scheme: ColorScheme = systemScheme === "light" ? "light" : "dark";
  return { colors: palette[scheme] as Palette, scheme, appearance: "system", setAppearance: () => {} };
}

/**
 * Builds a StyleSheet from the current palette and rebuilds it only when the
 * theme changes. Pass a factory defined at module level so it stays stable.
 */
export function useThemedStyles<T>(factory: (colors: Palette, scheme: ColorScheme) => T): T {
  const { colors, scheme } = useTheme();
  return useMemo(() => factory(colors, scheme), [factory, colors, scheme]);
}
