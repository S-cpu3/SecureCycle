export function gateRedirect(
  route: string | undefined,
  isUnlocked: boolean,
  isDuress: boolean
): string | null {
  const onLockScreen = route === "lock";

  if (isDuress) {
    return route === "decoy" ? null : "/decoy";
  }

  if (!isUnlocked) {
    return onLockScreen ? null : "/lock";
  }

  return route === "decoy" || onLockScreen || route === "index" || route === undefined
    ? "/(tabs)"
    : null;
}
