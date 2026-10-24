  export default function PrivacyShield({ children }: { children: React.ReactNode }) {
    const { colors } = useTheme();
    // REMOVED: isCovered state to avoid unmounting lag
    const opacity = useRef(new Animated.Value(0)).current;
    const [pointerEvents, setPointerEvents] = useState<"none" | "auto">("none");

    useEffect(() => {
      const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
        if (nextState !== "active") {
          opacity.setValue(1);
          setPointerEvents("auto");
          return;
        }

        setPointerEvents("none");
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      });

      return () => subscription.remove();
    }, [opacity]);

    return (
      <View style={styles.root}>
        {children}
        <Animated.View
          pointerEvents={pointerEvents}
          style={[styles.cover, { backgroundColor: colors.background, opacity }]}
        >
          <Image
            source={require("../assets/images/SafeCycleLogo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    );
  }

