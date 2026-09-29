import React, { useEffect } from 'react';
import { DatabaseProvider } from "@/contexts/DatabaseProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Stack, useRouter, useSegments } from "expo-router";
import { PaperProvider } from 'react-native-paper';
import { theme } from "@/theme/theme"

// FIX: the lock screen used to be the only thing protecting the app, and it
// only appeared because index.tsx happened to be the first route rendered.
// A deep link (safecycle:///profile, safecycle:///db-debug) or restored
// navigation state could open any screen directly with no PIN prompt.
// AuthGate redirects every route except the lock screen back to "/" until
// the user has unlocked.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isUnlocked } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const currentRoute = segments[0];
    const onLockScreen = currentRoute === undefined || currentRoute === "index";

    if (!isUnlocked && !onLockScreen) {
      router.replace("/");
    }
  }, [isUnlocked, segments, router]);

  return <>{children}</>;
}

// Root layout: wraps the entire app in the theme provider, the SQLite database
// provider, and the auth gate. Stack screens are headerless; the PIN/biometric
// prompt itself still lives in app/index.tsx via LockScreen.
export default function RootLayout() {
  return(
    <PaperProvider theme={theme}>
      <DatabaseProvider>
        <AuthProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </DatabaseProvider>
    </PaperProvider>
  )
}
