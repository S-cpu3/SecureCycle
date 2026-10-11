import { useTheme } from "@/contexts/ThemeContext";

/** Returns the current palette (follows the user's System / Light / Dark choice). */
export function useColors() {
  return useTheme().colors;
}
