import { View } from "react-native";
import CycleTracker from "@/components/CycleTracker";
import { theme } from "@/theme/theme";
import { usePrediction } from "@/hooks/use-prediction";
import { CycleDao } from "@/services/dao/CycleDao";
import { useDatabase } from "@/hooks/use-database";
import { useEffect, useState } from "react";
import { fromISO } from "@/types/models";

export default function Index() {
  const { prediction } = usePrediction();
  const db = useDatabase();
  const [lastPeriodStart, setLastPeriodStart] = useState<Date | null>(null);

  useEffect(() => {
    if (!db) return;
    CycleDao.computeStats(db).then(stats => {
      if (stats.lastPeriodStart) setLastPeriodStart(fromISO(stats.lastPeriodStart));
    });
  }, [db]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
      <CycleTracker prediction={prediction} lastPeriodStart={lastPeriodStart} />
    </View>
  );
}
