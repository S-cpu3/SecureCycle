// Imports: Stack (Nagivate between screens)
import { DatabaseProvider } from "@/contexts/DatabaseProvider";
import { Stack } from "expo-router";

export default function RootLayout() {
  return(
    <DatabaseProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </DatabaseProvider>
  )
}
