import * as LocalAuthentication from 'expo-local-authentication';

export const onAuthenticate = async () => {
  // 1. Check if the device has biometric hardware
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return { success: false, error: 'Hardware not supported' };

  // 2. Check if the user has fingerprints or FaceID enrolled
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) return { success: false, error: 'No biometrics enrolled' };

  // 3. Trigger authentication
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate with Face ID / Fingerprint',
    fallbackLabel: 'Use Passcode',
    disableDeviceFallback: false, // Set to true if you want to FORBID PIN fallback
  });

  return result;
};
