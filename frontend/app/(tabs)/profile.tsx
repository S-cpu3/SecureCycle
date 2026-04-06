import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { theme } from '@/theme/theme';
import { useDatabase } from '@/hooks/use-database';
import { UserDao } from '@/services/dao/UserDao';
import { ProfileDao } from '@/services/dao/ProfileDao';
import type { HealthCondition, UserIntentType } from '@/types/models';

// ─── Config ──────────────────────────────────────────────────────────────────

const ALL_CONDITIONS: { key: HealthCondition; label: string }[] = [
  { key: 'PCOS',              label: 'PCOS' },
  { key: 'endometriosis',     label: 'Endometriosis' },
  { key: 'perimenopause',     label: 'Perimenopause' },
  { key: 'fibroids',          label: 'Fibroids' },
  { key: 'thyroid_disorder',  label: 'Thyroid Disorder' },
  { key: 'other',             label: 'Other' },
];

const PREDICTION_SUPPRESSED: HealthCondition[] = ['PCOS', 'perimenopause'];

const ALL_INTENTS: { key: UserIntentType; label: string }[] = [
  { key: 'track_only',        label: 'Just tracking' },
  { key: 'conceive',          label: 'Trying to conceive' },
  { key: 'avoid_pregnancy',   label: 'Avoiding pregnancy' },
  { key: 'health_monitoring', label: 'Health monitoring' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Profile() {
  const db = useDatabase();

  // Personal info
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [dob,       setDob]       = useState('');   // YYYY-MM-DD

  // Health conditions — map of condition key → diagnosed boolean
  const [selectedConditions, setSelectedConditions] = useState<Map<HealthCondition, boolean>>(new Map());

  // Intent
  const [intent, setIntent] = useState<UserIntentType | null>(null);

  // Save feedback
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ─── Load saved values on mount ─────────────────────────────────────────────

  useEffect(() => {
    if (!db) return;

    async function load() {
      const [user, conditions, latestIntent] = await Promise.all([
        UserDao.get(db!),
        ProfileDao.getHealthConditions(db!),
        ProfileDao.getLatestIntent(db!),
      ]);

      if (user) {
        setFirstName(user.first_name ?? '');
        setLastName(user.last_name   ?? '');
        setDob(user.date_of_birth    ?? '');
      }

      if (conditions.length > 0) {
        const map = new Map<HealthCondition, boolean>();
        for (const c of conditions) {
          map.set(c.condition, c.diagnosed === 1);
        }
        setSelectedConditions(map);
      }

      if (latestIntent) setIntent(latestIntent.intention);
    }
    load();
  }, [db]);

  // ─── Save handlers ───────────────────────────────────────────────────────────

  const savePersonalInfo = async () => {
    if (!db) return;
    setSaveStatus('saving');
    await UserDao.upsert(db, { first_name: firstName, last_name: lastName, date_of_birth: dob || undefined });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const toggleCondition = (key: HealthCondition) => {
    setSelectedConditions(prev => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, false);
      }
      return next;
    });
  };

  const toggleDiagnosed = (key: HealthCondition) => {
    setSelectedConditions(prev => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.set(key, !prev.get(key));
      return next;
    });
  };

  const saveConditions = async () => {
    if (!db) return;
    const conditions = Array.from(selectedConditions.entries()).map(([condition, diagnosed]) => ({
      condition,
      diagnosed,
    }));
    await ProfileDao.replaceHealthConditions(db, conditions);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const selectIntent = async (key: UserIntentType) => {
    if (!db) return;
    setIntent(key);
    await ProfileDao.setIntent(db, key);
  };

  const suppressionActive = Array.from(selectedConditions.keys()).some(k =>
    PREDICTION_SUPPRESSED.includes(k)
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.header}>Profile</Text>

      {/* ── Personal Info ── */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.groupTitle}>Personal Info</Text>
          <Divider style={styles.divider} />

          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor="rgba(244,243,238,0.4)"
          />

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor="rgba(244,243,238,0.4)"
          />

          <Text style={styles.label}>Date of Birth</Text>
          <TextInput
            style={styles.input}
            value={dob}
            onChangeText={setDob}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="rgba(244,243,238,0.4)"
            keyboardType="numeric"
            maxLength={10}
          />
          <Text style={styles.hint}>Used for age-based cycle predictions</Text>

          <Button
            mode="contained"
            style={styles.button}
            onPress={savePersonalInfo}
            loading={saveStatus === 'saving'}
          >
            {saveStatus === 'saved' ? 'Saved!' : 'Save'}
          </Button>
        </Card.Content>
      </Card>

      {/* ── Health Conditions ── */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.groupTitle}>Health Conditions</Text>
          <Divider style={styles.divider} />

          {suppressionActive && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Ovulation predictions are suppressed for PCOS and perimenopause due to cycle irregularity.
              </Text>
            </View>
          )}

          {ALL_CONDITIONS.map(({ key, label }) => {
            const selected  = selectedConditions.has(key);
            const diagnosed = selectedConditions.get(key) ?? false;
            return (
              <View key={key} style={styles.conditionRow}>
                <TouchableOpacity
                  style={[styles.checkbox, selected && styles.checkboxChecked]}
                  onPress={() => toggleCondition(key)}
                >
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>

                <Text style={[styles.conditionLabel, !selected && styles.conditionLabelDim]}>
                  {label}
                </Text>

                {selected && (
                  <TouchableOpacity
                    style={[styles.diagnosedBadge, diagnosed && styles.diagnosedBadgeActive]}
                    onPress={() => toggleDiagnosed(key)}
                  >
                    <Text style={styles.diagnosedText}>
                      {diagnosed ? 'Diagnosed' : 'Suspected'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <Button mode="contained" style={styles.button} onPress={saveConditions}>
            Save Conditions
          </Button>
        </Card.Content>
      </Card>

      {/* ── Tracking Intent ── */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.groupTitle}>Tracking Goal</Text>
          <Divider style={styles.divider} />

          {ALL_INTENTS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.intentRow, intent === key && styles.intentRowSelected]}
              onPress={() => selectIntent(key)}
            >
              <View style={[styles.radio, intent === key && styles.radioSelected]} />
              <Text style={[styles.intentLabel, intent === key && styles.intentLabelSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </Card.Content>
      </Card>

      {/* ── Security ── */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.groupTitle}>Security</Text>
          <Divider style={styles.divider} />

          <Button icon="lock" mode="contained" style={styles.button} onPress={() => console.log('Edit Pin')}>
            Edit Pin
          </Button>

          <Button icon="cloud" mode="contained" style={styles.button} onPress={() => console.log('Face ID')}>
            Setup Face ID
          </Button>
        </Card.Content>
      </Card>

      {/* ── Export ── */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.groupTitle}>Export</Text>
          <Divider style={styles.divider} />

          <Button icon="download" mode="contained" style={styles.button} onPress={() => console.log('Export PDF')}>
            Export Data as PDF
          </Button>

          <Button icon="qrcode" mode="contained" style={styles.button} onPress={() => console.log('Export QR')}>
            Export Data as QR Code
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 25,
    color: theme.colors.text,
  },
  card: {
    marginBottom: 20,
    borderRadius: 20,
    elevation: 4,
    backgroundColor: theme.colors.surface,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    color: theme.colors.background,
  },
  divider: {
    marginBottom: 15,
  },
  label: {
    color: theme.colors.background,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  hint: {
    color: theme.colors.background,
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(38,12,26,0.12)',
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: 'rgba(38,12,26,0.3)',
    color: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 4,
  },
  button: {
    borderRadius: 30,
    marginTop: 12,
    backgroundColor: theme.colors.primary,
  },
  warningBox: {
    backgroundColor: 'rgba(173,38,58,0.15)',
    borderRadius: theme.roundness,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    padding: 10,
    marginBottom: 12,
  },
  warningText: {
    color: theme.colors.background,
    fontSize: 12,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  conditionLabel: {
    flex: 1,
    color: theme.colors.background,
    fontSize: 15,
  },
  conditionLabelDim: {
    opacity: 0.5,
  },
  diagnosedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
  diagnosedBadgeActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  diagnosedText: {
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: '600',
  },
  intentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: theme.roundness,
    marginBottom: 6,
    gap: 12,
  },
  intentRowSelected: {
    backgroundColor: 'rgba(173,38,58,0.12)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  radioSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  intentLabel: {
    color: theme.colors.background,
    fontSize: 15,
  },
  intentLabelSelected: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
});
