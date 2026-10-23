import { useCallback, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Divider, Text, TextInput } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/hooks/use-database";
import { useTheme, useThemedStyles } from "@/contexts/ThemeContext";
import { ensurePrimaryUser } from "@/dao/userDao";
import {
  appointmentDateTime,
  DoctorAppointment,
  ensureWellnessFeatureTables,
  getDoctorAppointments,
  getRecentHeartRateReadings,
  HeartRateReading,
  localDateKey,
  saveDoctorAppointment,
  saveHeartRateReading,
  updateDoctorAppointmentStatus,
} from "@/dao/wellnessDao";
import { cardShadow, ColorScheme, Palette, radius, size, space, type } from "@/theme/tokens";

export default function WellnessHealthTools() {
  const db = useDatabase();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const userId = useRef<number | null>(null);
  const busy = useRef(false);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [readings, setReadings] = useState<HeartRateReading[]>([]);
  const [clinician, setClinician] = useState("");
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [bpm, setBpm] = useState("");
  const [readingNote, setReadingNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"appointment" | "heart" | "status" | null>(null);
  const [loadError, setLoadError] = useState("");
  const [appointmentError, setAppointmentError] = useState("");
  const [heartError, setHeartError] = useState("");
  const [appointmentMessage, setAppointmentMessage] = useState("");
  const [heartMessage, setHeartMessage] = useState("");
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // The existing browser database is not SQLCipher-encrypted. These
      // sensitive features are available only in the native encrypted build.
      if (Platform.OS === "web") return;
      let active = true;
      setLoading(true);
      setLoadError("");
      (async () => {
        try {
          await ensureWellnessFeatureTables(db);
          const user = await ensurePrimaryUser(db);
          const [savedAppointments, savedReadings] = await Promise.all([
            getDoctorAppointments(db, user.user_id),
            getRecentHeartRateReadings(db, user.user_id),
          ]);
          if (!active) return;
          userId.current = user.user_id;
          setAppointments(savedAppointments);
          setReadings(savedReadings);
        } catch {
          // Do not put health records or database errors into console logs.
          if (active) setLoadError("These local health records could not be loaded.");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [db, reload])
  );

  async function addAppointment() {
    if (busy.current || userId.current === null) return;
    setAppointmentError("");
    setAppointmentMessage("");
    const scheduledAt = appointmentDateTime(date.trim(), time.trim());
    if (!clinician.trim()) {
      setAppointmentError("Enter a doctor or clinic name.");
      return;
    }
    if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
      setAppointmentError("Enter a future date (YYYY-MM-DD) and 24-hour time (HH:MM).");
      return;
    }
    busy.current = true;
    setSaving("appointment");
    try {
      await saveDoctorAppointment(db, userId.current, {
        clinician,
        appointmentDate: date.trim(),
        appointmentTime: time.trim(),
        location,
        notes: appointmentNotes,
      });
      setAppointments(await getDoctorAppointments(db, userId.current));
      setClinician("");
      setLocation("");
      setAppointmentNotes("");
      setAppointmentMessage("Appointment saved on this device. No booking or reminder was sent.");
    } catch {
      setAppointmentError("The appointment could not be saved. Please try again.");
    } finally {
      busy.current = false;
      setSaving(null);
    }
  }

  async function finishAppointment(id: number, status: "completed" | "cancelled") {
    if (busy.current || userId.current === null) return;
    busy.current = true;
    setSaving("status");
    setAppointmentError("");
    setAppointmentMessage("");
    try {
      await updateDoctorAppointmentStatus(db, userId.current, id, status);
      setAppointments(await getDoctorAppointments(db, userId.current));
      setAppointmentMessage(
        status === "completed"
          ? "Marked complete in your local record."
          : "Removed from your schedule. Contact your doctor separately to cancel the visit."
      );
    } catch {
      setAppointmentError("The appointment could not be updated. Please try again.");
    } finally {
      busy.current = false;
      setSaving(null);
    }
  }

  async function addReading() {
    if (busy.current || userId.current === null) return;
    setHeartError("");
    setHeartMessage("");
    const value = Number(bpm.trim());
    if (!/^\d+$/.test(bpm.trim()) || !Number.isInteger(value) || value < 30 || value > 250) {
      setHeartError("Enter a whole number from 30 to 250 bpm.");
      return;
    }
    busy.current = true;
    setSaving("heart");
    try {
      await saveHeartRateReading(db, userId.current, value, readingNote);
      setReadings(await getRecentHeartRateReadings(db, userId.current));
      setBpm("");
      setReadingNote("");
      setHeartMessage("Reading saved on this device.");
    } catch {
      setHeartError("The reading could not be saved. Please try again.");
    } finally {
      busy.current = false;
      setSaving(null);
    }
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Private health tools</Text>
        <Text style={styles.helper}>
          Appointments and heart-rate records are available in the native
          encrypted app only. The browser preview does not provide encrypted
          database storage, so entry of these records is disabled here.
        </Text>
      </View>
    );
  }
  if (loading) {
    return <ActivityIndicator style={styles.card} color={colors.accent} />;
  }
  if (loadError) {
    return (
      <View style={styles.card}>
        <Text style={styles.error} accessibilityRole="alert">{loadError}</Text>
        <Button onPress={() => setReload((value) => value + 1)}>Try again</Button>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>Doctor&apos;s appointments</Text>
        <Text style={styles.helper}>
          Your personal schedule only. This does not book a visit, contact your doctor,
          sync a calendar, or send notifications.
        </Text>
        <TextInput
          mode="outlined" label="Doctor or clinic" value={clinician}
          onChangeText={setClinician} maxLength={100} style={styles.input}
          disabled={saving !== null}
        />
        <TextInput
          mode="outlined" label="Date (YYYY-MM-DD)" placeholder="2026-11-30"
          value={date} onChangeText={setDate} maxLength={10}
          autoCapitalize="none" autoCorrect={false} style={styles.input}
          disabled={saving !== null}
        />
        <TextInput
          mode="outlined" label="Time (24-hour HH:MM)" placeholder="09:00"
          value={time} onChangeText={setTime} maxLength={5}
          autoCapitalize="none" autoCorrect={false} style={styles.input}
          disabled={saving !== null}
        />
        <Text style={styles.helper}>Date and time use your device&apos;s local time zone.</Text>
        <TextInput
          mode="outlined" label="Location (optional)" value={location}
          onChangeText={setLocation} maxLength={200} style={styles.input}
          disabled={saving !== null}
        />
        <TextInput
          mode="outlined" label="Appointment notes (optional)" value={appointmentNotes}
          onChangeText={setAppointmentNotes} maxLength={500} multiline
          style={styles.input} disabled={saving !== null}
        />
        {appointmentError ? (
          <Text style={styles.error} accessibilityRole="alert">{appointmentError}</Text>
        ) : null}
        {appointmentMessage ? (
          <Text style={styles.success} accessibilityLiveRegion="polite">{appointmentMessage}</Text>
        ) : null}
        <Button mode="contained" icon="calendar-plus" onPress={addAppointment}
          disabled={saving !== null} loading={saving === "appointment"}
          style={styles.button} contentStyle={styles.buttonContent}>
          Save appointment
        </Button>
        <Divider style={styles.divider} />
        <Text style={styles.subtitle}>Scheduled visits</Text>
        <Text style={styles.helper}>Up to 10 scheduled visits, earliest first.</Text>
        {appointments.length === 0 ? (
          <Text style={styles.helper}>No scheduled appointments yet.</Text>
        ) : appointments.map((appointment) => {
          const scheduledAt = appointmentDateTime(
            appointment.appointment_date, appointment.appointment_time
          );
          return (
            <View key={appointment.appointment_id} style={styles.record}>
              <Text style={styles.subtitle}>{appointment.clinician}</Text>
              <Text style={styles.helper}>
                {scheduledAt?.toLocaleString(undefined, {
                  weekday: "short", month: "short", day: "numeric",
                  year: "numeric", hour: "numeric", minute: "2-digit",
                }) ?? `${appointment.appointment_date} ${appointment.appointment_time}`}
              </Text>
              {scheduledAt && scheduledAt.getTime() < Date.now() ? (
                <Text style={styles.helper}>Past visit - mark complete if attended.</Text>
              ) : null}
              {appointment.location ? <Text style={styles.helper}>{appointment.location}</Text> : null}
              {appointment.notes ? <Text style={styles.helper}>{appointment.notes}</Text> : null}
              <View style={styles.actions}>
                <Button compact disabled={saving !== null}
                  onPress={() => finishAppointment(appointment.appointment_id, "completed")}>
                  Mark complete
                </Button>
                <Button compact disabled={saving !== null}
                  onPress={() => finishAppointment(appointment.appointment_id, "cancelled")}>
                  Remove from schedule
                </Button>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Heart rate monitor</Text>
        <Text style={styles.helper}>
          Manually log a reading from your own pulse check or device. This app
          does not measure your pulse, connect to sensors, or monitor you in the background.
        </Text>
        {readings[0] ? (
          <View style={styles.record}>
            <Text style={styles.value}>{readings[0].bpm} bpm</Text>
            <Text style={styles.helper}>
              Latest reading · {new Date(readings[0].recorded_at).toLocaleString()}
            </Text>
          </View>
        ) : null}
        <TextInput
          mode="outlined" label="Heart rate (bpm)" keyboardType="number-pad"
          value={bpm} onChangeText={setBpm} maxLength={3} style={styles.input}
          disabled={saving !== null}
        />
        <TextInput
          mode="outlined" label="Context (optional, e.g. resting)" value={readingNote}
          onChangeText={setReadingNote} maxLength={200} style={styles.input}
          disabled={saving !== null}
        />
        {heartError ? <Text style={styles.error} accessibilityRole="alert">{heartError}</Text> : null}
        {heartMessage ? (
          <Text style={styles.success} accessibilityLiveRegion="polite">{heartMessage}</Text>
        ) : null}
        <Button mode="contained" icon="heart-pulse" onPress={addReading}
          disabled={saving !== null} loading={saving === "heart"}
          style={styles.button} contentStyle={styles.buttonContent}>
          Save heart rate
        </Button>
        <Divider style={styles.divider} />
        <Text style={styles.subtitle}>Last 5 readings</Text>
        {readings.length === 0 ? (
          <Text style={styles.helper}>Your saved readings will appear here.</Text>
        ) : readings.map((reading) => (
          <View key={reading.reading_id} style={styles.record}>
            <Text style={styles.subtitle}>{reading.bpm} bpm</Text>
            <Text style={styles.helper}>{new Date(reading.recorded_at).toLocaleString()}</Text>
            {reading.note ? <Text style={styles.helper}>{reading.note}</Text> : null}
          </View>
        ))}
        <Text style={styles.helper}>
          This is a personal record, not a diagnosis or an emergency monitor.
          The entry range is a data-validation limit, not a healthy-range assessment.
        </Text>
      </View>
    </>
  );
}

const makeStyles = (colors: Palette, scheme: ColorScheme) => StyleSheet.create({
  card: {
    marginTop: space[6], padding: space[4], borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    ...cardShadow(scheme),
  },
  title: { ...type.cardTitle, color: colors.ink },
  subtitle: { ...type.bodyStrong, color: colors.ink },
  helper: { ...type.caption, color: colors.inkMuted, marginTop: space[2], lineHeight: 19 },
  input: { marginTop: space[3], backgroundColor: colors.surface },
  button: { marginTop: space[4], borderRadius: radius.lg },
  buttonContent: { minHeight: size.touchTarget },
  divider: { marginVertical: space[4], backgroundColor: colors.border },
  record: { marginTop: space[3], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  value: { ...type.value, color: colors.accentInk },
  actions: { flexDirection: "row", flexWrap: "wrap", marginTop: space[2] },
  error: { ...type.caption, color: colors.danger, marginTop: space[2], lineHeight: 19 },
  success: { ...type.caption, color: colors.success, marginTop: space[2], lineHeight: 19 },
});
