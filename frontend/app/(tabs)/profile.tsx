import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";

import { useDatabase } from "@/hooks/use-database";
import { ProfileDao } from "@/services/dao/ProfileDao";
import { UserDao } from "@/services/dao/UserDao";
import type { HealthCondition, UserIntentType } from "@/types/models";
import { theme } from "@/theme/theme";

const ALL_CONDITIONS: { key: HealthCondition; label: string }[] = [
  { key: "PCOS", label: "PCOS" },
  { key: "endometriosis", label: "Endometriosis" },
  { key: "perimenopause", label: "Perimenopause" },
  { key: "fibroids", label: "Fibroids" },
  { key: "thyroid_disorder", label: "Thyroid Disorder" },
  { key: "other", label: "Other" },
];

const ALL_INTENTS: { key: UserIntentType; label: string }[] = [
  { key: "track_only", label: "Just tracking" },
  { key: "conceive", label: "Trying to conceive" },
  { key: "avoid_pregnancy", label: "Avoid pregnancy" },
  { key: "health_monitoring", label: "Health monitoring" },
];

const PREDICTION_SUPPRESSED: HealthCondition[] = ["PCOS", "perimenopause"];

export default function ProfileScreen() {
  const db = useDatabase();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<Map<HealthCondition, boolean>>(new Map());
  const [intent, setIntent] = useState<UserIntentType | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingConditions, setIsSavingConditions] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([UserDao.get(db), ProfileDao.getHealthConditions(db), ProfileDao.getLatestIntent(db)])
      .then(([user, conditions, latestIntent]) => {
        if (!isMounted) {
          return;
        }

        setFirstName(user?.first_name ?? "");
        setLastName(user?.last_name ?? "");
        setDateOfBirth(user?.date_of_birth ?? "");
        setIntent(latestIntent?.intention ?? null);

        const nextConditions = new Map<HealthCondition, boolean>();
        for (const condition of conditions) {
          nextConditions.set(condition.condition, condition.diagnosed === 1);
        }
        setSelectedConditions(nextConditions);
      })
      .catch((error) => {
        console.error("Failed to load profile", error);
      });

    return () => {
      isMounted = false;
    };
  }, [db]);

  const suppressionActive = useMemo(
    () => Array.from(selectedConditions.keys()).some((condition) => PREDICTION_SUPPRESSED.includes(condition)),
    [selectedConditions]
  );

  const toggleCondition = (condition: HealthCondition) => {
    setSelectedConditions((previous) => {
      const next = new Map(previous);

      if (next.has(condition)) {
        next.delete(condition);
      } else {
        next.set(condition, false);
      }

      return next;
    });
  };

  const toggleDiagnosed = (condition: HealthCondition) => {
    setSelectedConditions((previous) => {
      if (!previous.has(condition)) {
        return previous;
      }

      const next = new Map(previous);
      next.set(condition, !previous.get(condition));
      return next;
    });
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);

    try {
      await UserDao.upsert(db, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        date_of_birth: dateOfBirth.trim() || null,
      });
    } catch (error) {
      console.error("Failed to save profile", error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveConditions = async () => {
    setIsSavingConditions(true);

    try {
      await ProfileDao.replaceHealthConditions(
        db,
        Array.from(selectedConditions.entries()).map(([condition, diagnosed]) => ({
          condition,
          diagnosed,
        }))
      );
    } catch (error) {
      console.error("Failed to save conditions", error);
    } finally {
      setIsSavingConditions(false);
    }
  };

  const handleSelectIntent = async (nextIntent: UserIntentType) => {
    setIntent(nextIntent);

    try {
      await ProfileDao.setIntent(db, nextIntent);
    } catch (error) {
      console.error("Failed to save intent", error);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Update the basic details that shape your predictions and stored health context.</Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Personal information</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor="rgba(244,243,238,0.45)"
            style={styles.input}
          />
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor="rgba(244,243,238,0.45)"
            style={styles.input}
          />
          <TextInput
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="Date of birth (YYYY-MM-DD)"
            placeholderTextColor="rgba(244,243,238,0.45)"
            style={styles.input}
            autoCapitalize="none"
          />
          <Button mode="contained" onPress={handleSaveProfile} loading={isSavingProfile} disabled={isSavingProfile} style={styles.button}>
            Save profile
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Health conditions</Text>
          {ALL_CONDITIONS.map((condition) => {
            const selected = selectedConditions.has(condition.key);
            const diagnosed = selectedConditions.get(condition.key) ?? false;

            return (
              <View key={condition.key} style={styles.conditionRow}>
                <Button mode={selected ? "contained" : "outlined"} onPress={() => toggleCondition(condition.key)} style={styles.conditionButton}>
                  {condition.label}
                </Button>
                {selected ? (
                  <Button mode={diagnosed ? "contained-tonal" : "text"} onPress={() => toggleDiagnosed(condition.key)}>
                    {diagnosed ? "Diagnosed" : "Undiagnosed"}
                  </Button>
                ) : null}
              </View>
            );
          })}

          <Button mode="contained" onPress={handleSaveConditions} loading={isSavingConditions} disabled={isSavingConditions} style={styles.button}>
            Save conditions
          </Button>

          {suppressionActive ? <Text style={styles.helperText}>Ovulation and fertile-window prediction will be suppressed for the selected condition set.</Text> : null}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Intent</Text>
          <View style={styles.intentWrap}>
            {ALL_INTENTS.map((option) => (
              <Button
                key={option.key}
                mode={intent === option.key ? "contained" : "outlined"}
                style={styles.intentButton}
                onPress={() => handleSelectIntent(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.medium,
    gap: theme.spacing.medium,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(244, 243, 238, 0.72)",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.1)",
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "rgba(244, 243, 238, 0.08)",
    color: theme.colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(244, 243, 238, 0.12)",
  },
  button: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
  },
  conditionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  conditionButton: {
    flex: 1,
  },
  helperText: {
    color: "rgba(244, 243, 238, 0.68)",
    marginTop: 12,
    lineHeight: 20,
  },
  intentWrap: {
    gap: 10,
  },
  intentButton: {
    justifyContent: "flex-start",
  },
});
