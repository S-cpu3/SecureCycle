import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type * as SQLite from "expo-sqlite";
import { ensurePrimaryUser, hasUsablePin } from "@/dao/userDao";

// Only a "seen" marker is stored, never any health data. It lives in the OS
// keystore next to the appearance preference.
const ONBOARDING_KEY = "onboarding_seen_v1";

// SecureStore only exists on iOS and Android; the web preview keeps the flag in localStorage.
async function readFlag(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(ONBOARDING_KEY) ?? null;
  }

  return SecureStore.getItemAsync(ONBOARDING_KEY);
}

export async function markOnboardingSeen() {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(ONBOARDING_KEY, "true");
    return;
  }

  await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
}

/**
 * True for a first-time user. Someone who already has a PIN set up from before
 * this intro existed is not new, so they skip it.
 */
export async function shouldShowOnboarding(db: SQLite.SQLiteDatabase): Promise<boolean> {
  if ((await readFlag()) === "true") {
    return false;
  }

  const user = await ensurePrimaryUser(db);
  if (hasUsablePin(user)) {
    await markOnboardingSeen();
    return false;
  }

  return true;
}
