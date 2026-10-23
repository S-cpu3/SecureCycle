import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

// Tab navigator layout: defines the three main app tabs (History, Home, Profile)
// and applies shared header/tab-bar styling from the theme.
export default function TabLayout() {
  const { isUnlocked, isDuress } = useAuth();
  const { colors, scheme } = useTheme();
  if (isDuress) return <Redirect href="/decoy" />;
  if (!isUnlocked) return <Redirect href="/lock" />;
  return(
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
  )
}
