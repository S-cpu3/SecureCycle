import { StyleSheet } from "react-native";
import { cardShadow, ColorScheme, Palette, radius, size, space, type } from "@/theme/tokens";

// Shared look for the protective-setting cards (DuressPinCard, AutoEraseCard,
// AutoWipeCard): the SecuritySettingCard pattern from the design system.
export const makeSecurityCardStyles = (colors: Palette, scheme: ColorScheme) =>
  StyleSheet.create({
    card: {
      padding: space[4],
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow(scheme),
    },
    title: { ...type.cardTitle, color: colors.ink, marginBottom: space[1] },
    body: { ...type.caption, fontSize: 13, lineHeight: 18, color: colors.inkMuted, marginBottom: space[2] },
    status: { ...type.label, color: colors.ink, marginBottom: space[2] },
    // Irreversible-consequence panel: danger text on danger-soft.
    warning: {
      ...type.caption,
      fontSize: 13,
      lineHeight: 18,
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
      borderRadius: radius.md,
      paddingHorizontal: space[4],
      paddingVertical: space[3],
      marginBottom: space[3],
      overflow: "hidden",
    },
    row: { flexDirection: "row", flexWrap: "wrap", gap: space[2], marginBottom: space[3] },
    rowButton: { flex: 1 },
    optionButton: { minWidth: 90 },
    input: {
      minHeight: size.touchTarget,
      color: colors.ink,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.sm,
      paddingHorizontal: space[4],
      paddingVertical: space[3],
      fontSize: 16,
      marginBottom: space[2],
    },
    button: { marginTop: space[2], borderRadius: radius.lg },
  });
