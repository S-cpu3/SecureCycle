import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/theme/theme";

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
    </Tabs>
  )
}
