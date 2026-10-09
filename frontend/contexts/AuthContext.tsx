import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

type AuthContextValue = {
  isUnlocked: boolean;
  // True while the decoy screen is showing after a duress PIN. The real app is NOT unlocked in this state, so none of its screens are reachable.
  isDuress: boolean;
  unlock: () => void;
  lock: () => void;
  enterDuress: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}


export function AuthProvider({ children }: AuthProviderProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isDuress, setIsDuress] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appState.current === "active" && nextState === "background") {
        setIsUnlocked(false);
        setIsDuress(false);
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const unlock = useCallback(() => setIsUnlocked(true), []);
  const lock = useCallback(() => {
    setIsUnlocked(false);
    setIsDuress(false);
  }, []);
  const enterDuress = useCallback(() => {
    setIsUnlocked(false);
    setIsDuress(true);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isUnlocked,
    isDuress,
    unlock,
    lock,
    enterDuress,
  }), [isUnlocked, isDuress, unlock, lock, enterDuress]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth should be used within an AuthProvider");
  }

  return ctx;
}
