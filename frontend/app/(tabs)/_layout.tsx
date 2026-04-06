import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/theme/theme";

/**
 * Renders the main tab-based navigation layout for the app.
 *
 * Configures shared tab and header styling (active tint, background, text color,
 * and header shadow visibility), and defines three primary tabs:
 * - `history` (calendar icon)
 * - `index` (home icon)
 * - `profile` (person icon)
 *
 * Each tab uses a focused/unfocused Ionicons variant and hides the tab title text.
 * A `db-debug` tab is present in the file but intentionally disabled/commented out.
 *
 * @returns The configured `<Tabs />` navigator for the `(tabs)` route group.
 */
export default function TabLayout() {
  return(
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >


      <Tabs.Screen 
        name="history"
        options={{ 
          title: "", 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
          ) 
        }}
      />

      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "", 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ) 
        }}
      />

      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: "",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
          ) 
        }}
      />

      {/*
      <Tabs.Screen
        name="db-debug"
        options={{
          title: "",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bug" : "bug-outline"} size={24} color={color} />
          ),
        }}
      />
      */}
    </Tabs>
  )
}
