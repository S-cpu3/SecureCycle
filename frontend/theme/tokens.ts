import type { TextStyle } from "react-native";

// Design tokens for SecureCycle. These mirror tokens.json in the SecureCycle
// design system — change values there first, then here.
// Dark (Midnight) is the original look; Light (Parchment) is the light-mode option.

export const palette = {
  dark: {
    background: "#260c1a",
    surface: "#361f2b",
    surfaceRaised: "#432c38",
    border: "#3f2833",
    borderStrong: "#85757c",
    ink: "#f4f3ee",
    inkMuted: "#bab2b3",
    inkSubtle: "#998d91",
    primary: "#ad263a",
    primaryPressed: "#8f1d2f",
    onPrimary: "#f4f3ee",
    accent: "#db457b",
    onAccent: "#260c1a",
    accentInk: "#ec7fa5",
    accentSoft: "#3f1428",
    focus: "#ec7fa5",
    success: "#a9e7bf",
    danger: "#ffb3bd",
    onDanger: "#3a0710",
    dangerSoft: "#4a1420",
    ringTrack: "#3e2832",
    phasePeriod: "#ad263a",
    onPhasePeriod: "#f4f3ee",
    phaseFertile: "#772646",
    onPhaseFertile: "#f4f3ee",
    phaseOvulation: "#db457b",
    onPhaseOvulation: "#260c1a",
    phaseLuteal: "#533f49",
    onPhaseLuteal: "#f4f3ee",
    scrim: "rgba(10, 3, 7, 0.72)",
  },
  light: {
    background: "#f4f3ee",
    surface: "#ffffff",
    surfaceRaised: "#ece8e3",
    border: "#e3ddd7",
    borderStrong: "#8c8287",
    ink: "#260c1a",
    inkMuted: "#5e4c55",
    inkSubtle: "#7a6a72",
    primary: "#ad263a",
    primaryPressed: "#8f1d2f",
    onPrimary: "#ffffff",
    accent: "#db457b",
    onAccent: "#260c1a",
    accentInk: "#b8325f",
    accentSoft: "#f8dde7",
    focus: "#ad263a",
    success: "#1f7a4a",
    danger: "#b00020",
    onDanger: "#ffffff",
    dangerSoft: "#fbe3e6",
    ringTrack: "#e9e3dc",
    phasePeriod: "#ad263a",
    onPhasePeriod: "#ffffff",
    phaseFertile: "#f6d3df",
    onPhaseFertile: "#260c1a",
    phaseOvulation: "#db457b",
    onPhaseOvulation: "#260c1a",
    phaseLuteal: "#d9d1ca",
    onPhaseLuteal: "#260c1a",
    scrim: "rgba(38, 12, 26, 0.48)",
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type Palette = { [K in keyof typeof palette.dark]: string };

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 10: 40 } as const;

export const radius = { sm: 8, md: 16, lg: 24, full: 999 } as const;

export const size = {
  touchTarget: 48,
  pinKey: 80,
  ringDiameter: 300,
  ringCenter: 194,
  dayNode: 26,
  iconMd: 24,
  iconSm: 20,
} as const;

// Text roles from the design system's type scale. Body text uses the platform
// system face (SF Pro / Roboto), so no fontFamily is set.
type TextRole =
  | "cycleDay" | "screenTitle" | "sectionTitle" | "cardTitle" | "value" | "bodyStrong"
  | "body" | "label" | "caption" | "eyebrow" | "finePrint" | "pinDigit";

export const type: Record<TextRole, TextStyle> = {
  cycleDay: { fontSize: 50, lineHeight: 54, fontWeight: "600", fontVariant: ["tabular-nums"] },
  screenTitle: { fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.3 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  value: { fontSize: 20, lineHeight: 26, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase" },
  finePrint: { fontSize: 11, lineHeight: 16, fontWeight: "400" },
  pinDigit: { fontSize: 30, lineHeight: 32, fontWeight: "400", fontVariant: ["tabular-nums"] },
};

// shadow-card: light mode only; dark separates layers with surface steps and borders.
export function cardShadow(scheme: ColorScheme) {
  if (scheme === "dark") {
    return {};
  }

  return {
    shadowColor: "#260c1a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };
}
