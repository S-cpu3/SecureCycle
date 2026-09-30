import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

type AuthContextValue = {
  isUnlocked: boolean;
  unlock: () => void;
  lock: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      // Relock as soon as the app leaves the foreground
      if (appState.current === "active" && (nextState === "background" || nextState === "inactive")) {
        setIsUnlocked(false);
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const value: AuthContextValue = {
    isUnlocked,
    unlock: () => setIsUnlocked(true),
    lock: () => setIsUnlocked(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth should be used within an AuthProvider");
  }

  return ctx;
}
