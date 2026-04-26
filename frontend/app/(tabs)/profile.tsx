import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Button, Card, Divider, Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as LocalAuthentication from "expo-local-authentication";
import Constants from "expo-constants";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import QRCode from "react-native-qrcode-svg";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "@/theme/theme";
import { useDatabase } from "@/hooks/use-database";
import { getExportData, getHomeCycleData } from "@/dao/cycleDao";
import {
  ensurePrimaryUser,
  updateUserPin,
  updateUserProfile,
  UserProfile,
} from "@/dao/userDao";
import {
  getSecuritySettings,
  saveShareToken,
  setBiometricEnabled,
} from "@/dao/securityDao";

type SecurityState = {
  biometric_enabled: number;
  failed_attempts: number;
  lockout_until: string | null;
};

type SharePayload = {
  version: number;
  token: string;
  exportedAt: string;
  patient: {
    firstName: string;
    lastName: string;
    birthDate: string;
  };
  summary: {
    phase: string;
    cycleDay: number;
    ovulationDay: number;
    periodDays: number[];
    fertileDays: number[];
  };
  recentEntries: {
    date: string;
    entry_type: string;
    intensity: string | null;
    symptom_type: string | null;
    notes: string | null;
  }[];
};

function createShareToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBirthDate(value: string) {
  if (!value) {
    return "Select birthday";
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "Select birthday";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toPickerDate(value: string) {
  const parsed = value
    ? new Date(`${value}T00:00:00`)
    : new Date("1998-01-01T00:00:00");
  return Number.isNaN(parsed.getTime())
    ? new Date("1998-01-01T00:00:00")
    : parsed;
}

function toIsoBirthDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPdfHtml(payload: SharePayload) {
  const patientName =
    `${payload.patient.firstName} ${payload.patient.lastName}`.trim() ||
    "SafeCycle Demo User";
  const rows = payload.recentEntries
    .map(
      (entry) =>
        `<tr><td>${entry.date}</td><td>${entry.entry_type}</td><td>${entry.intensity ?? "-"}</td><td>${entry.symptom_type ?? "-"}</td><td>${entry.notes ?? "-"}</td></tr>`,
    )
    .join("");

  return `
    <html>
      <body style="font-family: Helvetica, Arial, sans-serif; padding: 28px; color: #260C1A;">
        <h1 style="margin-bottom: 4px;">SafeCycle Private Export</h1>
        <p style="margin-top: 0; color: #AD263A;">Generated ${payload.exportedAt}</p>
        <h2>Patient</h2>
        <p><strong>Name:</strong> ${patientName}</p>
        <p><strong>Birthday:</strong> ${payload.patient.birthDate || "Not set"}</p>
        <h2>Cycle Summary</h2>
        <p><strong>Current phase:</strong> ${payload.summary.phase}</p>
        <p><strong>Current cycle day:</strong> ${payload.summary.cycleDay}</p>
        <p><strong>Predicted ovulation day:</strong> ${payload.summary.ovulationDay}</p>
        <p><strong>Period days:</strong> ${payload.summary.periodDays.join(", ")}</p>
        <p><strong>Fertile days:</strong> ${payload.summary.fertileDays.join(", ")}</p>
        <h2>Recent Entries</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 8px 0;">Date</th>
              <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 8px 0;">Type</th>
              <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 8px 0;">Intensity</th>
              <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 8px 0;">Symptom</th>
              <th style="text-align: left; border-bottom: 1px solid #ccc; padding: 8px 0;">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top: 24px; font-size: 12px; color: #666;">Share token: ${payload.token}</p>
      </body>
    </html>
  `;
}

export default function Profile() {
  const db = useDatabase();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [cycleDay, setCycleDay] = useState(0);
  const [daysUntilPeriod, setDaysUntilPeriod] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthDateDraft, setBirthDateDraft] = useState(
    new Date("1998-01-01T00:00:00"),
  );
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isFaceIdBusy, setIsFaceIdBusy] = useState(false);
  const isExpoGo = Constants.appOwnership === "expo";

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const user = await ensurePrimaryUser(db);
        const securityState = await getSecuritySettings(db, user.user_id);
        const cycle = await getHomeCycleData(db, user.user_id);

        setProfile(user);
        setSecurity(securityState);
        setFirstName(user.first_name ?? "");
        setLastName(user.last_name ?? "");
        setBirthDate(user.birth_date ?? "");
        setBirthDateDraft(toPickerDate(user.birth_date ?? ""));
        setPhaseLabel(cycle?.phaseLabel ?? "No cycle logged");
        setCycleDay(cycle?.currentCycleDay ?? 0);
        setDaysUntilPeriod(
          cycle ? Math.max(0, cycle.cycleLength - cycle.currentCycleDay) : 0,
        );
      }

      load().catch((error) => {
        console.error("Failed to load profile data", error);
      });
    }, [db]),
  );

  const fullName = useMemo(() => {
    const name = `${firstName} ${lastName}`.trim();
    return name || "SafeCycle Demo User";
  }, [firstName, lastName]);

  const reloadSecurity = async (userId: number) => {
    const securityState = await getSecuritySettings(db, userId);
    setSecurity(securityState);
  };

  const handleSaveProfile = async () => {
    if (!profile) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await updateUserProfile(db, profile.user_id, {
        firstName,
        lastName,
        birthDate,
      });

      if (updatedProfile) {
        setProfile(updatedProfile);
      }

      Alert.alert("Saved", "Profile updated.");
    } finally {
      setIsSaving(false);
    }
  };

  const openBirthDatePicker = () => {
    setBirthDateDraft(toPickerDate(birthDate));
    setShowBirthDatePicker(true);
  };

  const handleBirthDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowBirthDatePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setBirthDateDraft(selectedDate);

    if (Platform.OS === "android") {
      setBirthDate(toIsoBirthDate(selectedDate));
    }
  };

  const confirmBirthDate = () => {
    setBirthDate(toIsoBirthDate(birthDateDraft));
    setShowBirthDatePicker(false);
  };

  const handleChangePin = async () => {
    if (!profile) {
      return;
    }

    if (newPin.length !== 6 || confirmPin.length !== 6) {
      Alert.alert("PIN Required", "Enter a 6-digit PIN in both fields.");
      return;
    }

    if (newPin !== confirmPin) {
      Alert.alert("PIN Mismatch", "The two PIN entries do not match.");
      return;
    }

    await updateUserPin(db, profile.user_id, newPin);
    setNewPin("");
    setConfirmPin("");
    Alert.alert("PIN Updated", "The app PIN has been updated.");
  };

  const handleEnableBiometrics = async () => {
    if (!profile) {
      return;
    }

    if (isExpoGo) {
      Alert.alert(
        "Development Build Required",
        "Face ID needs a development build on iPhone. Expo Go does not support it.",
      );
      return;
    }

    setIsFaceIdBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware
        ? await LocalAuthentication.isEnrolledAsync()
        : false;

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          "Unavailable",
          "Face ID or biometrics are not enrolled on this device.",
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Enable biometric unlock for SafeCycle",
        disableDeviceFallback: true,
      });

      if (!result.success) {
        Alert.alert(
          "Not Enabled",
          result.error || "Biometric setup was cancelled.",
        );
        return;
      }

      await setBiometricEnabled(db, profile.user_id, true);
      await reloadSecurity(profile.user_id);
      Alert.alert(
        "Enabled",
        "Biometric unlock now requires Face ID or biometrics only.",
      );
    } finally {
      setIsFaceIdBusy(false);
    }
  };

  const handleDisableBiometrics = async () => {
    if (!profile) {
      return;
    }

    await setBiometricEnabled(db, profile.user_id, false);
    await reloadSecurity(profile.user_id);
    Alert.alert("Disabled", "Biometric unlock has been turned off.");
  };

  const buildSharePayload = async () => {
    if (!profile) {
      return null;
    }

    const exportData = await getExportData(db, profile.user_id);
    const cycle = await getHomeCycleData(db, profile.user_id);
    const token = createShareToken();

    await saveShareToken(db, profile.user_id, token);

    if (!cycle) {
      return {
        version: 1,
        token,
        exportedAt: exportData.exportedAt,
        patient: exportData.patient,
        summary: {
          phase: "No cycle logged",
          cycleDay: 0,
          ovulationDay: 0,
          periodDays: [],
          fertileDays: [],
        },
        recentEntries: exportData.entries.slice(0, 8),
      } satisfies SharePayload;
    }

    return {
      version: 1,
      token,
      exportedAt: exportData.exportedAt,
      patient: exportData.patient,
      summary: {
        phase: cycle.phaseLabel,
        cycleDay: cycle.currentCycleDay,
        ovulationDay: cycle.ovulationDay,
        periodDays: cycle.periodDays,
        fertileDays: cycle.fertileDays,
      },
      recentEntries: exportData.entries.slice(0, 8),
    } satisfies SharePayload;
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const payload = await buildSharePayload();

      if (!payload) {
        return;
      }

      setSharePayload(payload);
      const Print = await import("expo-print");
      const Sharing = await import("expo-sharing");
      const file = await Print.printToFileAsync({
        html: buildPdfHtml(payload),
      });
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share SafeCycle PDF",
        });
      } else {
        Alert.alert("PDF Ready", `PDF saved to ${file.uri}`);
      }
    } catch (error) {
      console.error("Failed to export PDF", error);
      Alert.alert(
        "Export Failed",
        "PDF export is unavailable until the required Expo packages are installed.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleShowQr = async () => {
    try {
      const payload = await buildSharePayload();

      if (!payload) {
        return;
      }

      setSharePayload(payload);
      setShowQrModal(true);
    } catch (error) {
      console.error("Failed to create QR payload", error);
      Alert.alert("QR Failed", "Unable to build the doctor share payload.");
    }
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {`${(firstName[0] || "S").toUpperCase()}${(lastName[0] || "C").toUpperCase()}`}
            </Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.handle}>Private cycle tracking</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <MaterialCommunityIcons
                name="shield-check"
                size={16}
                color={theme.colors.text}
              />
              <Text style={styles.badgeText}>Private</Text>
            </View>
            <View style={[styles.badge, styles.badgeSpacer]}>
              <MaterialCommunityIcons
                name="face-recognition"
                size={16}
                color={theme.colors.text}
              />
              <Text style={styles.badgeText}>
                {security?.biometric_enabled ? "Biometric ready" : "PIN only"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          <Card style={[styles.statCard, styles.statCardSpacer]}>
            <Card.Content style={styles.statCardContent}>
              <MaterialCommunityIcons
                name="calendar-month"
                size={22}
                color={theme.colors.secondary}
              />
              <Text style={styles.statValue}>28 days</Text>
              <Text style={styles.statLabel}>Cycle length</Text>
            </Card.Content>
          </Card>
          <Card style={[styles.statCard, styles.statCardSpacer]}>
            <Card.Content style={styles.statCardContent}>
              <MaterialCommunityIcons
                name="heart-pulse"
                size={22}
                color={theme.colors.secondary}
              />
              <Text style={styles.statValue}>Day {cycleDay}</Text>
              <Text style={styles.statLabel}>Cycle day</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={22}
                color={theme.colors.secondary}
              />
              <Text style={styles.statValue}>{daysUntilPeriod} days</Text>
              <Text style={styles.statLabel}>Until next period</Text>
            </Card.Content>
          </Card>
        </View>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Profile details</Text>
              <Text style={styles.sectionSubtitle}>Basic details</Text>
            </View>
            <Divider style={styles.divider} />
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor="rgba(244, 243, 238, 0.45)"
              style={styles.input}
            />
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor="rgba(244, 243, 238, 0.45)"
              style={styles.input}
            />
            <Pressable style={styles.dateButton} onPress={openBirthDatePicker}>
              <Text style={styles.dateButtonLabel}>Birthday</Text>
              <Text style={styles.dateButtonValue}>
                {formatBirthDate(birthDate)}
              </Text>
            </Pressable>
            <Button
              mode="contained"
              style={styles.primaryButton}
              onPress={handleSaveProfile}
              loading={isSaving}
            >
              Save profile
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Security</Text>
              <Text style={styles.sectionSubtitle}>App access</Text>
            </View>
            <Divider style={styles.divider} />
            <Text style={styles.snapshotValue}>{phaseLabel}</Text>
            <Text style={styles.supportText}>
              Face ID unlock does not fall back to the device passcode.
            </Text>
            <TextInput
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New 6-digit PIN"
              placeholderTextColor="rgba(244, 243, 238, 0.45)"
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
            />
            <TextInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm new PIN"
              placeholderTextColor="rgba(244, 243, 238, 0.45)"
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
            />
            <Button
              mode="contained"
              style={styles.primaryButton}
              onPress={handleChangePin}
            >
              Update PIN
            </Button>
            <View style={styles.inlineButtons}>
              <Button
                mode="contained"
                style={[styles.primaryButton, styles.inlineButton]}
                onPress={handleEnableBiometrics}
                loading={isFaceIdBusy}
              >
                Enable Face ID
              </Button>
              <Button
                mode="outlined"
                textColor={theme.colors.text}
                style={[styles.secondaryButton, styles.inlineButton]}
                onPress={handleDisableBiometrics}
              >
                Disable
              </Button>
            </View>
            <Text style={styles.statusText}>
              Biometric status:{" "}
              {security?.biometric_enabled ? "enabled" : "disabled"}
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Doctor export</Text>
              <Text style={styles.sectionSubtitle}>
                Share a summary when needed
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={18}
                  color={theme.colors.background}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>PDF export</Text>
                <Text style={styles.rowDescription}>
                  Create a printable cycle summary.
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons
                  name="qrcode"
                  size={18}
                  color={theme.colors.background}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Doctor QR</Text>
                <Text style={styles.rowDescription}>
                  Show a quick share code for viewing on another device.
                </Text>
              </View>
            </View>
            <View style={styles.inlineButtons}>
              <Button
                mode="contained"
                style={[styles.primaryButton, styles.inlineButton]}
                onPress={handleExportPdf}
                loading={isExporting}
              >
                Export PDF
              </Button>
              <Button
                mode="outlined"
                textColor={theme.colors.text}
                style={[styles.secondaryButton, styles.inlineButton]}
                onPress={handleShowQr}
              >
                Show QR
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Doctor share QR</Text>
            <Text style={styles.modalText}>
              Scan this code to read the current local demo payload.
            </Text>
            {sharePayload ? (
              <>
                <View style={styles.qrWrap}>
                  <QRCode value={JSON.stringify(sharePayload)} size={220} />
                </View>
                <Text style={styles.modalToken}>
                  Share token: {sharePayload.token}
                </Text>
              </>
            ) : null}
            <Pressable
              style={styles.modalClose}
              onPress={() => setShowQrModal(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBirthDatePicker && Platform.OS === "ios"}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBirthDatePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dateModalCard}>
            <Text style={styles.modalTitle}>Birthday</Text>
            <DateTimePicker
              value={birthDateDraft}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={handleBirthDateChange}
              textColor={theme.colors.background}
            />
            <View style={styles.inlineButtons}>
              <Button
                mode="outlined"
                textColor={theme.colors.background}
                style={[styles.dateModalButton, styles.dateModalSecondary]}
                onPress={() => setShowBirthDatePicker(false)}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                style={[styles.dateModalButton, styles.dateModalPrimary]}
                onPress={confirmBirthDate}
              >
                Done
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {showBirthDatePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={birthDateDraft}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleBirthDateChange}
        />
      ) : null}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.medium,
    paddingTop: theme.spacing.large,
    paddingBottom: theme.spacing.large * 2,
  },
  hero: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderRadius: theme.roundness * 3,
    padding: theme.spacing.large,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.12)",
    alignItems: "center",
    marginBottom: theme.spacing.large,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.medium,
  },
  avatarText: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  name: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  handle: {
    color: "rgba(244, 243, 238, 0.74)",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.medium,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(38, 12, 26, 0.4)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
    marginRight: 10,
  },
  badgeSpacer: {
    marginRight: 0,
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },
  statRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.large,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness * 2,
  },
  statCardSpacer: {
    marginRight: 10,
  },
  statCardContent: {
    minHeight: 118,
  },
  statValue: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 4,
  },
  statLabel: {
    color: "rgba(38, 12, 26, 0.72)",
    fontSize: 12,
    lineHeight: 16,
  },
  sectionCard: {
    marginBottom: theme.spacing.medium,
    borderRadius: theme.roundness * 3,
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.12)",
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: "rgba(244, 243, 238, 0.68)",
    fontSize: 12,
  },
  divider: {
    marginBottom: theme.spacing.medium,
    backgroundColor: "rgba(244, 243, 238, 0.12)",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.18)",
    borderRadius: theme.roundness * 2,
    paddingHorizontal: theme.spacing.medium,
    paddingVertical: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.small,
    backgroundColor: "rgba(38, 12, 26, 0.4)",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.18)",
    borderRadius: theme.roundness * 2,
    paddingHorizontal: theme.spacing.medium,
    paddingVertical: 14,
    marginBottom: theme.spacing.small,
    backgroundColor: "rgba(38, 12, 26, 0.4)",
  },
  dateButtonLabel: {
    color: "rgba(244, 243, 238, 0.55)",
    fontSize: 12,
    marginBottom: 4,
  },
  dateButtonValue: {
    color: theme.colors.text,
    fontSize: 16,
  },
  primaryButton: {
    borderRadius: theme.roundness * 3,
    backgroundColor: theme.colors.primary,
    marginTop: theme.spacing.small,
  },
  secondaryButton: {
    borderRadius: theme.roundness * 3,
    borderColor: "rgba(244, 243, 238, 0.3)",
    marginTop: theme.spacing.small,
  },
  inlineButtons: {
    flexDirection: "row",
    gap: 10,
  },
  inlineButton: {
    flex: 1,
  },
  supportText: {
    color: "rgba(244, 243, 238, 0.74)",
    lineHeight: 18,
    marginBottom: theme.spacing.medium,
  },
  statusText: {
    color: theme.colors.text,
    marginTop: theme.spacing.small,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  rowDescription: {
    color: "rgba(244, 243, 238, 0.68)",
    fontSize: 12,
    lineHeight: 16,
  },
  snapshotValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: theme.spacing.small,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.large,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: theme.roundness * 3,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.large,
    alignItems: "center",
  },
  dateModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: theme.roundness * 3,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.large,
  },
  modalTitle: {
    color: theme.colors.background,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalText: {
    color: "rgba(38, 12, 26, 0.72)",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: theme.spacing.medium,
  },
  qrWrap: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: theme.roundness * 2,
  },
  modalToken: {
    color: theme.colors.background,
    marginTop: theme.spacing.medium,
    textAlign: "center",
  },
  modalClose: {
    marginTop: theme.spacing.large,
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalCloseText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  dateModalButton: {
    flex: 1,
    borderRadius: theme.roundness * 3,
  },
  dateModalPrimary: {
    backgroundColor: theme.colors.primary,
  },
  dateModalSecondary: {
    borderColor: "rgba(38, 12, 26, 0.2)",
  },
});
