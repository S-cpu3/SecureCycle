import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Button } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { Palette, radius, size, space, type } from "@/theme/tokens";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type Feature = { icon: IconName; title: string; text: string };

type Slide = {
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  chips?: string[];
  features?: Feature[];
  quote?: string;
};

// Copy comes from the README so the intro and the docs say the same thing.
const SLIDES: Slide[] = [
  {
    icon: "shield-lock-outline",
    eyebrow: "Welcome to SecureCycle",
    title: "Your health.\nYour device.",
    body:
      "A private place for sensitive health information: conditions, diagnoses, medications, allergies, " +
      "doctor's appointments, mental health, treatment notes and reproductive health.",
    chips: ["No trackers", "No ads", "No AI training on your data"],
    quote: "Privacy is a fundamental human right, not an option.",
  },
  {
    icon: "database-lock-outline",
    eyebrow: "Stays on your phone",
    title: "No one can see it.\nNot even us.",
    body: "All data is processed locally on your device. Nothing is sent to a server.",
    features: [
      {
        icon: "database-lock-outline",
        title: "Data encryption",
        text: "Stored in a database encrypted with SQLCipher.",
      },
      {
        icon: "key-chain-variant",
        title: "Hardware-backed key",
        text: "The key is random and kept in your phone's secure storage (iOS Keychain or Android Keystore).",
      },
    ],
  },
  {
    icon: "lock-check-outline",
    eyebrow: "Locked down",
    title: "Locked when you're\nnot looking",
    body: "Several layers keep people out, even if they have your phone.",
    features: [
      { icon: "numeric", title: "App PIN", text: "Protect the app with a 6-digit PIN." },
      {
        icon: "timer-sand-complete",
        title: "Brute force protection",
        text: "Each wrong PIN adds a longer wait, up to 24 hours.",
      },
      { icon: "lock-clock", title: "Auto-lock", text: "The app locks as soon as it leaves the screen." },
      {
        icon: "eye-off-outline",
        title: "Privacy Shield",
        text: "The app switcher shows a cover screen, never your health data.",
      },
    ],
  },
  {
    icon: "account-alert-outline",
    eyebrow: "For hard situations",
    title: "Protection if\nyou're forced",
    body: "Optional tools for when someone makes you unlock the app.",
    features: [
      {
        icon: "incognito",
        title: "Duress PIN",
        text: "A second PIN that opens a harmless screen instead of your data.",
      },
      {
        icon: "delete-clock-outline",
        title: "Erase options",
        text: "Erase your data after too many wrong PINs, or if the app isn't unlocked for 1 week to 6 months.",
      },
    ],
  },
  {
    icon: "cellphone-lock",
    eyebrow: "One last step",
    title: "Set your PIN",
    body:
      "The PIN is optional, and we strongly recommend setting one. Without a PIN, anyone who can " +
      "open your phone can open the app.",
  },
];

type Props = {
  // Called once the user finishes or skips. setUpPin is true when they chose to
  // go straight to the PIN settings.
  onDone: (setUpPin: boolean) => void;
};

/**
 * First-run intro. Rendered by the tab layout over the unlocked app, so it is
 * never reachable from the lock screen or a duress session.
 */
export default function Onboarding({ onDone }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  // Keeps the buttons in sync with swipes as well as Next presses.
  useAnimatedReaction(
    () => Math.round(scrollX.value / width),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setIndex)(current);
      }
    },
    [width]
  );

  const goTo = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(350)}
      exiting={FadeOut.duration(250)}
      style={[styles.container, { paddingTop: insets.top + space[2], paddingBottom: insets.bottom + space[4] }]}
    >
      <View style={styles.topBar}>
        {!isLast && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip introduction"
            onPress={() => onDone(false)}
            hitSlop={12}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {SLIDES.map((slide, i) => (
          <SlideView key={slide.title} slide={slide} index={i} width={width} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, i) => (
            <Dot key={slide.title} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>

        {isLast ? (
          <>
            <Button
              mode="contained"
              icon="lock-outline"
              onPress={() => onDone(true)}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Set up my PIN
            </Button>
            <Button mode="text" textColor={colors.inkMuted} onPress={() => onDone(false)} style={styles.button}>
              Not now
            </Button>
          </>
        ) : (
          <Button
            mode="contained"
            icon="arrow-right"
            contentStyle={[styles.buttonContent, styles.iconRight]}
            onPress={() => goTo(index + 1)}
            style={styles.button}
          >
            {index === 0 ? "Get started" : "Next"}
          </Button>
        )}
      </View>
    </Animated.View>
  );
}

type PageProps = { index: number; width: number; scrollX: SharedValue<number> };

function SlideView({ slide, index, width, scrollX }: PageProps & { slide: Slide }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  // The hero shrinks and fades as it leaves; the text drifts a little slower
  // than the page for a light parallax.
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollX.value, range, [0.6, 1, 0.6], Extrapolation.CLAMP) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(scrollX.value, range, [width * 0.25, 0, -width * 0.25], Extrapolation.CLAMP) }],
  }));

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.slide}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <Animated.View style={[styles.heroWrap, heroStyle]}>
        <View style={styles.halo} />
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <MaterialCommunityIcons name={slide.icon} size={52} color={colors.onPrimary} />
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {slide.title}
        </Text>
        <Text style={styles.body}>{slide.body}</Text>

        {slide.chips && (
          <View style={styles.chips}>
            {slide.chips.map((chip) => (
              <View key={chip} style={styles.chip}>
                <MaterialCommunityIcons name="cancel" size={14} color={colors.accentInk} />
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))}
          </View>
        )}

        {slide.features && (
          <View style={styles.card}>
            {slide.features.map((feature, i) => (
              <View key={feature.title} style={[styles.feature, i > 0 && styles.featureDivider]}>
                <View style={styles.featureIcon}>
                  <MaterialCommunityIcons name={feature.icon} size={20} color={colors.accentInk} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureBody}>{feature.text}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {slide.quote && <Text style={styles.quote}>“{slide.quote}”</Text>}
      </Animated.View>
    </ScrollView>
  );
}

function Dot({ index, width, scrollX }: PageProps) {
  const styles = useThemedStyles(makeStyles);
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const dotStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, range, [8, 24, 8], Extrapolation.CLAMP),
    opacity: interpolate(scrollX.value, range, [0.35, 1, 0.35], Extrapolation.CLAMP),
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  topBar: {
    height: 40,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: space[6],
  },
  skip: {
    paddingVertical: space[1],
    paddingHorizontal: space[2],
  },
  skipText: {
    ...type.label,
    fontSize: 15,
    color: colors.inkMuted,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  heroWrap: {
    alignSelf: "center",
    width: 168,
    height: 168,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: space[8],
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  hero: {
    width: 112,
    height: 112,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  textBlock: {
    alignItems: "center",
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.accentInk,
    marginBottom: space[2],
    textAlign: "center",
  },
  title: {
    ...type.screenTitle,
    color: colors.ink,
    textAlign: "center",
    marginBottom: space[3],
  },
  body: {
    ...type.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.inkMuted,
    textAlign: "center",
    maxWidth: 360,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space[2],
    marginTop: space[6],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    paddingVertical: 6,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    ...type.label,
    color: colors.accentInk,
  },
  quote: {
    ...type.body,
    fontStyle: "italic",
    color: colors.inkSubtle,
    textAlign: "center",
    marginTop: space[6],
    maxWidth: 300,
  },
  card: {
    alignSelf: "stretch",
    marginTop: space[6],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
    paddingVertical: space[3],
  },
  featureDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.accentSoft,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...type.bodyStrong,
    fontSize: 15,
    color: colors.ink,
  },
  featureBody: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
  },
  footer: {
    paddingHorizontal: space[6],
    alignItems: "center",
    gap: space[2],
  },
  dots: {
    flexDirection: "row",
    gap: space[2],
    marginBottom: space[4],
  },
  dot: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accentInk,
  },
  button: {
    alignSelf: "stretch",
    borderRadius: radius.lg,
  },
  buttonContent: {
    minHeight: size.touchTarget,
  },
  iconRight: {
    flexDirection: "row-reverse",
  },
});
