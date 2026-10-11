import { MD3DarkTheme, MD3LightTheme, MD3Theme } from "react-native-paper";
import { ColorScheme, Palette, radius } from "@/theme/tokens";

// Maps the SecureCycle palette onto react-native-paper's MD3 theme so Paper's
// Button, TextInput, Card and ActivityIndicator follow light and dark mode.
export function buildPaperTheme(scheme: ColorScheme, colors: Palette): MD3Theme {
  const base = scheme === "dark" ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    dark: scheme === "dark",
    roundness: radius.sm,
    colors: {
      ...base.colors,
      primary: colors.primary,
      onPrimary: colors.onPrimary,
      primaryContainer: colors.accentSoft,
      onPrimaryContainer: colors.ink,
      secondary: colors.accent,
      onSecondary: colors.onAccent,
      secondaryContainer: colors.accentSoft,
      onSecondaryContainer: colors.ink,
      background: colors.background,
      onBackground: colors.ink,
      surface: colors.surface,
      onSurface: colors.ink,
      surfaceVariant: colors.surfaceRaised,
      onSurfaceVariant: colors.inkMuted,
      outline: colors.borderStrong,
      outlineVariant: colors.border,
      error: colors.danger,
      onError: colors.onDanger,
      errorContainer: colors.dangerSoft,
      onErrorContainer: colors.danger,
      backdrop: colors.scrim,
      elevation: {
        ...base.colors.elevation,
        level0: "transparent",
        level1: colors.surface,
        level2: colors.surface,
        level3: colors.surfaceRaised,
      },
    },
  };
}
