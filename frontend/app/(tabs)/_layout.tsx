import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, Tabs, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDatabase } from "@/hooks/use-database";
import Onboarding from "@/components/Onboarding";
import { markOnboardingSeen, shouldShowOnboarding } from "@/utils/onboarding";

// Tab navigator layout: defines the three main app tabs (History, Home, Profile)
// and applies shared header/tab-bar styling from the theme.
export default function TabLayout() {
  const { isUnlocked, isDuress } = useAuth();
  const { colors, scheme } = useTheme();
  const db = useDatabase();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // The first-run intro only ever shows here, inside the unlocked app, so it
  // can't be used to get past the lock screen or out of the decoy screen.
  useEffect(() => {
    if (!isUnlocked || isDuress) return;

    shouldShowOnboarding(db)
      .then(setShowOnboarding)
      .catch((error) => console.error("Failed to check onboarding state", error));
  }, [db, isUnlocked, isDuress]);

  const finishOnboarding = (setUpPin: boolean) => {
    setShowOnboarding(false);
    markOnboardingSeen().catch((error) => console.error("Failed to save onboarding state", error));

    if (setUpPin) {
      router.navigate("/profile");
    }
  };

  if (isDuress) return <Redirect href="/decoy" />;
  if (!isUnlocked) return <Redirect href="/lock" />;
  return(
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          // Carmine is too dark to read as an icon tint on midnight, so dark mode uses rose.
          tabBarActiveTintColor: scheme === "dark" ? colors.accentInk : colors.primary,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarShowLabel: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          sceneStyle: {
            backgroundColor: colors.background,
          },
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        }}
      >

        {/* Calendar view for logging and reviewing saved periods */}
        <Tabs.Screen
          name="history"
          options={{ 
            title: "", 
            tabBarAccessibilityLabel: "History",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color as string} />
            ) 
          }}
        />

        {/* Home dashboard showing the cycle ring and recent log entries */}
        <Tabs.Screen
          name="index"
          options={{
            title: "",
            tabBarAccessibilityLabel: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color as string} />
            )
          }}
        />

        <Tabs.Screen
          name="wellness"
          options={{
            title: "",
            tabBarAccessibilityLabel: "Wellness check-in",
            tabBarIcon: ({ color, focused }) => (
              <MaterialCommunityIcons name={focused ? "heart-pulse" : "heart-outline"} size={24} color={color as string} />
            ),
          }}
        />

        {/* User profile, PIN / biometric security settings, and doctor export */}
        <Tabs.Screen
          name="profile"
          options={{ 
            title: "",
            tabBarAccessibilityLabel: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color as string} />
            ) 
          }}
        />

        {/*
        <Tabs.Screen
          name="db-debug"
          options={{
            title: "",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "bug" : "bug-outline"} size={24} color={color as string} />
            ),
          }}
        />
        */}
      </Tabs>
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
    </View>
  )
}
