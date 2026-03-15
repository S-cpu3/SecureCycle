import React from 'react';
import { DatabaseProvider } from "@/contexts/DatabaseProvider";
import { Stack } from "expo-router";
import { PaperProvider } from 'react-native-paper';
import { theme } from "@/theme/theme"

export default function RootLayout() {
  return(
    <Stack>
      <PaperProvider theme={theme}>
        <DatabaseProvider>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </DatabaseProvider>
      </PaperProvider>
    </Stack>
  )
}
