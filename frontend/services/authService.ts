import * as LocalAuthentication from "expo-local-authentication";

export const onAuthenticate = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return { success: false, error: "Hardware not supported" };

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) return { success: false, error: "No biometrics enrolled" };

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Authenticate with Face ID / Fingerprint",
    fallbackLabel: "Use Passcode",
    disableDeviceFallback: false,
  });

  return result;
};
