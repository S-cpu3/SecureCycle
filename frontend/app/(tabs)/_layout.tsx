// Imports: Tabs (Bottom Tab Navigation) & Icons for the Tab Bar
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function TabLayout() {
  return(
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffd33d',
        headerStyle: {
          backgroundColor: '#25292e',
        },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#25292e',
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

      <Tabs.Screen
        name="db-debug"
        options={{
          title: "",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bug" : "bug-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
