import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/theme/theme";

// Tab navigator layout: defines the three main app tabs (History, Home, Profile)
// and applies shared header/tab-bar styling from the theme.
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

      {/* Calendar view for logging and reviewing saved periods */}
      <Tabs.Screen
        name="history"
        options={{ 
          title: "", 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
          ) 
        }}
      />

      {/* Home dashboard showing the cycle ring and recent log entries */}
      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          )
        }}
      />

      {/* User profile, PIN / biometric security settings, and doctor export */}
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
