import React, { useEffect } from 'react';
import { DatabaseProvider } from "@/contexts/DatabaseProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Href, Stack, useRouter, useSegments } from "expo-router";
import { PaperProvider } from 'react-native-paper';
import { theme } from "@/theme/theme"
import { gateRedirect } from "@/utils/routeGate";

// Decides which routes are reachable:
//  - duress session: only the decoy screen
//  - locked:         only the lock screen
//  - unlocked:       everything except the decoy screen
// This is what enforces the lock, so deep links (safecycle:///profile) and
// restored navigation state can't skip the PIN.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isUnlocked, isDuress } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const target = gateRedirect(segments[0], isUnlocked, isDuress);

    if (target) {
      // typedRoutes is on, so the plain string from gateRedirect needs a cast.
      router.replace(target as Href);
    }
  }, [isUnlocked, isDuress, segments, router]);

  return <>{children}</>;
}

// Root layout: wraps the entire app in the theme provider, the SQLite database
// provider, and the auth gate. The PIN/biometric prompt itself lives in
// app/index.tsx via LockScreen.
export default function RootLayout() {
  return(
    <PaperProvider theme={theme}>
      <DatabaseProvider>
        <AuthProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="decoy" options={{ gestureEnabled: false }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </DatabaseProvider>
    </PaperProvider>
  )
}
