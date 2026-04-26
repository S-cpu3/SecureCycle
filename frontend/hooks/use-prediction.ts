import { useCallback, useEffect, useState } from "react";
import { useDatabase } from "@/hooks/use-database";
import { UserDao } from "@/services/dao/UserDao";
import { ProfileDao } from "@/services/dao/ProfileDao";
import { CycleDao } from "@/services/dao/CycleDao";
import { computePrediction, PredictionResult, ConditionKey } from "@/engine/predictionEngine";
import { fromISO } from "@/types/models";

export interface UsePredictionResult {
  prediction: PredictionResult | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

// Derive age in whole years from a date-of-birth ISO string
function calcAge(dob: string): number {
  const birth = new Date(dob + 'T00:00:00');
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// Map stored condition strings to the engine's recognised ConditionKey union
const ENGINE_CONDITIONS = new Set<ConditionKey>(['PCOS', 'endometriosis', 'perimenopause']);

export function usePrediction(): UsePredictionResult {
  const db = useDatabase();
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading]       = useState<boolean>(true);
  const [error, setError]           = useState<Error | null>(null);

  const run = useCallback(async () => {
    if (!db) return;

    setLoading(true);
    setError(null);

    try {
      const [user, conditions, stats] = await Promise.all([
        UserDao.get(db),
        ProfileDao.getHealthConditions(db),
        CycleDao.computeStats(db),
      ]);

      // Can't predict without at least a last period start date
      if (!stats.lastPeriodStart) {
        setPrediction(null);
        return;
      }

      const ageYears = user?.date_of_birth ? calcAge(user.date_of_birth) : null;

      // Only pass conditions the engine understands (PCOS, endometriosis, perimenopause)
      const engineConditions = conditions
        .map(c => c.condition)
        .filter((c): c is ConditionKey => ENGINE_CONDITIONS.has(c as ConditionKey));

      const result = computePrediction({
        lastPeriodStart:        fromISO(stats.lastPeriodStart),
        cyclesLogged:           stats.cyclesLogged,
        personalAvgCycleLength: stats.avgCycleLength,
        personalStdDev:         stats.stdDev,
        ageYears,
        conditions:             engineConditions,
      });

      setPrediction(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    run();
  }, [run]);

  return { prediction, loading, error, refresh: run };
}
