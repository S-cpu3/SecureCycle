export function gateRedirect(
  route: string | undefined,
  isUnlocked: boolean,
  isDuress: boolean
): string | null {
  const onLockScreen = route === undefined || route === "index";

  if (isDuress) {
    return route === "decoy" ? null : "/decoy";
  }

  if (!isUnlocked) {
    return onLockScreen ? null : "/";
  }

  return route === "decoy" ? "/(tabs)" : null;
}
