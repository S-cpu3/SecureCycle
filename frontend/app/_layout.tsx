import React from 'react';
import { DatabaseProvider } from "@/contexts/DatabaseProvider";
import { Stack } from "expo-router";
import { PaperProvider } from 'react-native-paper';
import { theme } from "@/theme/theme"

export default function RootLayout() {
  return(
    <PaperProvider theme={theme}>
      <DatabaseProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </DatabaseProvider>
    </PaperProvider>
  )
}
