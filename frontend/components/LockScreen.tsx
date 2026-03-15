import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '@/theme/theme';
import { useRouter } from 'expo-router';

const PIN_KEY = 'user_pin';

export default function LockScreen() {
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [isPinSet, setIsPinSet] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadPin = async () => {
      const savedPin = await AsyncStorage.getItem(PIN_KEY);
      if (savedPin) {
        setStoredPin(savedPin);
        setIsPinSet(true);
      }
    };
    loadPin();
  }, []);

  const handlePinChange = (value: string) => {
    if (value.length <= 6) {
      setPin(value);
    }
  };

  const handlePinSubmit = async () => {
    if (isPinSet) {
      if (pin === storedPin) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Incorrect PIN');
        setPin('');
      }
    } else {
      if (pin.length === 6) {
        await AsyncStorage.setItem(PIN_KEY, pin);
        setStoredPin(pin);
        setIsPinSet(true);
        router.replace('/(tabs)');
        Alert.alert('Success', 'PIN set successfully!');
      } else {
        Alert.alert('Error', 'PIN must be 6 digits long.');
      }
    }
  };

  const handleBiometricAuth = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      Alert.alert('Error', 'Biometric hardware not supported');
      return;
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      Alert.alert('Error', 'No biometrics enrolled');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to unlock SafeCycle',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Authentication Failed', result.error || 'Could not authenticate');
    }
  };

  const renderPinInput = () => {
    const displayPin = pin.padEnd(6, '_');
    return (
      <View style={styles.pinDisplayContainer}>
        {displayPin.split('').map((char, index) => (
          <Text key={index} style={styles.pinChar}>
            {char === '_' ? '_' : '*'}
          </Text>
        ))}
      </View>
    );
  };

  const renderNumberPad = () => {
    const numbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'back'],
    ];

    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberPadRow}>
            {row.map((num, colIndex) => (
              <Button
                key={colIndex}
                mode="outlined"
                style={styles.numberButton}
                labelStyle={styles.numberButtonLabel}
                onPress={() => {
                  if (num === 'back') {
                    setPin((prev) => prev.slice(0, -1));
                  } else if (num === '') {
                    handleBiometricAuth();
                  } else {
                    handlePinChange(pin + num);
                  }
                }}
                disabled={num === '' && !LocalAuthentication.hasHardwareAsync()} // Disable biometric button if no hardware
              >
                {num === 'back' ? '⌫' : num === '' ? ' biometric ' : num}
              </Button>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isPinSet ? 'Enter PIN' : 'Set Your PIN'}</Text>
      {renderPinInput()}
      {renderNumberPad()}
      <Button
        mode="contained"
        onPress={handlePinSubmit}
        disabled={pin.length !== 6}
        style={styles.submitButton}
      >
        {isPinSet ? 'Unlock' : 'Set PIN'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 24,
    color: theme.colors.text,
    marginBottom: theme.spacing.large * 2,
  },
  pinDisplayContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.large * 2,
  },
  pinChar: {
    fontSize: 30,
    color: theme.colors.text,
    marginHorizontal: theme.spacing.small * 1.25,
    borderBottomWidth: 2,
    borderColor: theme.colors.text,
    width: 20,
    textAlign: 'center',
  },
  numberPad: {
    width: '80%',
    marginBottom: theme.spacing.medium,
  },
  numberPadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.small,
  },
  numberButton: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.roundness * 5,
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  numberButtonLabel: {
    fontSize: 30,
    lineHeight: 32,
    color: theme.colors.primary,
  },
  submitButton: {
    marginTop: theme.spacing.medium,
    width: '80%',
    paddingVertical: theme.spacing.small,
    backgroundColor: theme.colors.primary,
  },
});

