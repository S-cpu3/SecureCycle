import React, { useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, useWindowDimensions, View, ScrollView } from "react-native";
import { Button } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getDefaultHeaderHeight } from "expo-router/react-navigation";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { Palette, radius, size, space, type } from "@/theme/tokens";
import { useDatabase } from "@/hooks/use-database";
import { ensurePrimaryUser, updateRecoveryHash } from "@/dao/userDao";
import { generateRecoveryPhrase, phraseToString } from "@/utils/recovery";
import { hash } from "@/utils/hash";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// Each card gets its own fill so the deck reads as distinct cards, not one long page.
type Tone = { fill: [string, string]; ink: string };

type Card = {
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  tags?: string[];
  tone: (colors: Palette) => Tone;
};

// Copy is kept short enough that every card fits without scrolling.
const CARDS: Card[] = [
  {
    icon: "shield-lock-outline",
    eyebrow: "Welcome",
    title: "Your health.\nYour device.",
    body: "A private place for your health records.",
    tags: ["No trackers", "No ads", "No AI training"],
    tone: (c) => ({ fill: [c.primary, c.accent], ink: c.onPrimary }),
  },
  {
    icon: "database-lock-outline",
    eyebrow: "On-device",
    title: "No one can see it.\nNot even us.",
    body: "Everything is encrypted and never leaves this phone.",
    tone: (c) => ({ fill: [c.phaseFertile, c.phaseFertile], ink: c.onPhaseFertile }),
  },
  {
    icon: "lock-check-outline",
    eyebrow: "Locked down",
    title: "Locked when you're not looking",
    body: "Layers that keep people out, even with your phone.",
    tags: ["PIN", "Auto-lock", "Wrong-PIN delays", "Privacy Shield"],
    tone: (c) => ({ fill: [c.phaseLuteal, c.phaseLuteal], ink: c.onPhaseLuteal }),
  },
  {
    icon: "incognito",
    eyebrow: "If you're forced",
    title: "A PIN that hides everything",
    body: "A duress PIN opens a harmless screen. Data can also auto-erase.",
    tone: (c) => ({ fill: [c.ink, c.ink], ink: c.background }),
  },
  {
    icon: "cellphone-lock",
    eyebrow: "Last step",
    title: "Set your PIN",
    body: "Optional, but without one anyone who opens your phone can open the app.",
    tone: (c) => ({ fill: [c.surface, c.surface], ink: c.ink }),
  },
];

const CARD_MAX_WIDTH = 360;
const CARD_MAX_HEIGHT = 440;
// Matches the bottom tab bar's default (non-compact) height.
const TAB_BAR_HEIGHT = 49;

type Props = {
  // Called once the user finishes or skips. setUpPin is true when they chose to
  // go straight to the PIN settings.
  onDone: (setUpPin: boolean) => void;
};

/**
 * First-run intro. Rendered by the tab layout over the unlocked app, so it is
 * never reachable from the lock screen or a duress session. It only covers the
 * screen content, leaving the header and tab bar visible.
 */
export default function Onboarding({ onDone }: Props) {
  const db = useDatabase();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const frame = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [area, setArea] = useState({ width: frame.width, height: 0 });
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState<string[]>([]);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const top = getDefaultHeaderHeight(frame, false, insets.top);
  const bottom = TAB_BAR_HEIGHT + insets.bottom;

  const handleFinish = async (setUpPin: boolean) => {
    if (setUpPin) {
      const user = await ensurePrimaryUser(db);
      const phrase = generateRecoveryPhrase();
      setRecoveryPhrase(phrase);

      const recoveryHash = await hash(phraseToString(phrase));
      await updateRecoveryHash(db, user.user_id, recoveryHash);

      setShowRecovery(true);
    } else {
      onDone(false);
    }
  };

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ width, height });
  };

  const goTo = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * area.width, animated: true });
  };

  const cardWidth = Math.min(area.width - space[6] * 2, CARD_MAX_WIDTH);
  const cardHeight = Math.min(area.height - space[6] * 2, CARD_MAX_HEIGHT);

  if (showRecovery) {
    return (
      <View style={[styles.overlay, { top, bottom }]}>
        <ScrollView contentContainerStyle={styles.recoveryContainer}>
          <Text style={styles.recoveryTitle}>Your Recovery Key</Text>
          <Text style={styles.recoverySubtitle}>
            Write these words down on paper. This is the ONLY way to recover your account if you forget your PIN.
          </Text>

          <View style={styles.phraseGrid}>
            {recoveryPhrase.map((word, i) => (
              <View key={i} style={styles.phraseItem}>
                <Text style={styles.phraseIndex}>{i + 1}.</Text>
                <Text style={styles.phraseWord}>{word}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => setHasConfirmed(true)}
            style={[styles.confirmBox, hasConfirmed && styles.confirmBoxChecked]}
          >
            <Text style={styles.confirmText}>I have written these words down safely</Text>
          </Pressable>

          <Button
            mode="contained"
            disabled={!hasConfirmed}
            onPress={() => onDone(true)}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Finish Setup
          </Button>
        </ScrollView>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.overlay, { top, bottom }]}
      onLayout={onLayout}
    >
      {area.height > 0 && (
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {CARDS.map((card, i) => (
            <CardView
              key={card.eyebrow}
              card={card}
              index={i}
              page={area}
              cardSize={{ width: cardWidth, height: cardHeight }}
              scrollX={scrollX}
              onNext={() => goTo(i + 1)}
              onDone={handleFinish}
            />
          ))}
        </Animated.ScrollView>
      )}
    </Animated.View>
  );
}

type CardProps = {
  card: Card;
  index: number;
  page: { width: number; height: number };
  cardSize: { width: number; height: number };
  scrollX: SharedValue<number>;
  onNext: () => void;
  onDone: (setUpPin: boolean) => void;
};

function CardView({ card, index, page, cardSize, scrollX, onNext, onDone }: CardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tone = card.tone(colors);
  const isLast = index === CARDS.length - 1;
  const range = [(index - 1) * page.width, index * page.width, (index + 1) * page.width];

  // Neighbouring cards tilt and shrink away, so swiping feels like flipping a deck.
  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0.4, 1, 0.4], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollX.value, range, [0.88, 1, 0.88], Extrapolation.CLAMP) },
      { rotate: `${interpolate(scrollX.value, range, [6, 0, -6], Extrapolation.CLAMP)}deg` },
    ],
  }));

  return (
    <View style={[styles.page, page]}>
      <Animated.View style={[styles.cardShadow, cardSize, cardStyle]}>
        <LinearGradient
          colors={tone.fill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, isLast && styles.lastCard]}
        >
          <MaterialCommunityIcons
            name={card.icon}
            size={180}
            color={tone.ink}
            style={styles.watermark}
            importantForAccessibility="no"
          />

          <View style={styles.topRow}>
            <Text style={[styles.eyebrow, { color: tone.ink }]}>{card.eyebrow}</Text>
            {!isLast && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip introduction"
                onPress={() => onDone(false)}
                hitSlop={12}
              >
                <Text style={[styles.skip, { color: tone.ink }]}>Skip</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.content}>
            <View style={[styles.badge, { borderColor: tone.ink }]}>
              <MaterialCommunityIcons name={card.icon} size={30} color={isLast ? colors.accentInk : tone.ink} />
            </View>
            <Text style={[styles.title, { color: tone.ink }]} accessibilityRole="header">
              {card.title}
            </Text>
            <Text style={[styles.body, { color: tone.ink }]}>{card.body}</Text>

            {card.tags && (
              <View style={styles.tags}>
                {card.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { borderColor: tone.ink }]}>
                    <Text style={[styles.tagText, { color: tone.ink }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {isLast ? (
            <View style={styles.actions}>
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
            </View>
          ) : (
            <View style={styles.bottomRow}>
              <View style={styles.dots} accessible accessibilityLabel={`Card ${index + 1} of ${CARDS.length}`}>
                {CARDS.map((other, i) => (
                  <View
                    key={other.eyebrow}
                    style={[styles.dot, { backgroundColor: tone.ink }, i === index ? styles.dotActive : styles.dotIdle]}
                  />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next card"
                onPress={onNext}
                style={({ pressed }) => [styles.next, { backgroundColor: tone.ink }, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="arrow-right" size={24} color={tone.fill[0]} />
              </Pressable>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.scrim,
    zIndex: 10,
  },
  recoveryContainer: {
    flex: 1,
    padding: space[6],
    justifyContent: "center",
    alignItems: "center",
  },
  recoveryTitle: {
    ...type.screenTitle,
    fontSize: 28,
    textAlign: "center",
    color: colors.ink,
    marginBottom: space[2],
  },
  recoverySubtitle: {
    ...type.body,
    textAlign: "center",
    color: colors.inkMuted,
    marginBottom: space[6],
    paddingHorizontal: space[4],
  },
  phraseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[3],
    justifyContent: "center",
    marginBottom: space[6],
  },
  phraseItem: {
    flexDirection: "row",
    width: "45%",
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space[2],
  },
  phraseIndex: {
    ...type.label,
    color: colors.inkMuted,
    marginRight: space[2],
    width: 20,
  },
  phraseWord: {
    ...type.body,
    fontWeight: "600",
    color: colors.ink,
  },
  confirmBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: space[6],
    width: "100%",
  },
  confirmBoxChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  confirmText: {
    ...type.body,
    color: colors.ink,
    textAlign: "center",
    flex: 1,
  },
  button: {
    alignSelf: "stretch",
    borderRadius: radius.lg,
  },
  buttonContent: {
    minHeight: size.touchTarget,
  },
  page: {
    justifyContent: "center",
    alignItems: "center",
  },
  cardShadow: {
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    padding: space[6],
    overflow: "hidden",
  },
  lastCard: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  watermark: {
    position: "absolute",
    right: -40,
    bottom: -30,
    opacity: 0.08,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    ...type.eyebrow,
    opacity: 0.85,
  },
  skip: {
    ...type.label,
    opacity: 0.85,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: space[3],
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: space[1],
  },
  title: {
    ...type.screenTitle,
    fontSize: 26,
    lineHeight: 32,
  },
  body: {
    ...type.body,
    opacity: 0.9,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
    marginTop: space[1],
  },
  tag: {
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tagText: {
    ...type.label,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: space[1],
  },
  dot: {
    height: 6,
    borderRadius: radius.full,
  },
  dotActive: {
    width: 18,
  },
  dotIdle: {
    width: 6,
    opacity: 0.35,
  },
  next: {
    width: size.touchTarget,
    height: size.touchTarget,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  actions: {
    gap: space[1],
  },
  button: {
    alignSelf: "stretch",
    borderRadius: radius.lg,
  },
  buttonContent: {
    minHeight: size.touchTarget,
  },
});
