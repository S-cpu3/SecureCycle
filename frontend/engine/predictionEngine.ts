// Pure prediction engine — no Expo, SQLite, or React imports.
// All inputs and outputs are plain JS values so this module is fully unit-testable.

export type ConditionKey = 'PCOS' | 'endometriosis' | 'perimenopause';

export interface PredictionInput {
  lastPeriodStart: Date;
  cyclesLogged: number;
  personalAvgCycleLength: number | null;  // null when no logged history
  personalStdDev: number | null;           // null when no logged history
  ageYears: number | null;                 // null when DOB not set
  conditions: ConditionKey[];
  lutealPhase?: number;                    // defaults to 14
}

export interface PredictionResult {
  predicted: Date;
  earliest: Date;
  latest: Date;
  ovulationDate: Date | null;   // null = unreliable (PCOS / perimenopause)
  fertileStart: Date | null;
  fertileEnd: Date | null;
  pmsStart: Date;
  confidenceScore: number;      // 0–100
  showRangeOnly: boolean;       // true when confidence < 30
  cycleLength: number;
  stdDev: number;
}

// ─── Population defaults by age ───────────────────────────────────────────────

interface AgeBracket {
  maxAge: number;
  cycleLength: number;
  stdDev: number;
}

const AGE_BRACKETS: AgeBracket[] = [
  { maxAge: 20,       cycleLength: 30.3, stdDev: 5.0 },
  { maxAge: 35,       cycleLength: 28.7, stdDev: 3.0 },
  { maxAge: 45,       cycleLength: 28.2, stdDev: 4.0 },
  { maxAge: 50,       cycleLength: 28.4, stdDev: 6.5 },
  { maxAge: Infinity, cycleLength: 30.8, stdDev: 8.0 },
];

function getPopulationDefaults(age: number | null): { cycleLength: number; stdDev: number } {
  if (age === null || age < 8) return { cycleLength: 28.7, stdDev: 3.0 };
  return AGE_BRACKETS.find(b => age < b.maxAge) ?? { cycleLength: 28.7, stdDev: 3.0 };
}

// ─── Blending personal data with population average ───────────────────────────
// weight caps at 1.0 after 6 logged cycles

function blend(personal: number, population: number, cyclesLogged: number): number {
  const weight = Math.min(cyclesLogged / 6, 1.0);
  return personal * weight + population * (1 - weight);
}

// ─── Date arithmetic ─────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + Math.round(days));
  return result;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function computePrediction(input: PredictionInput): PredictionResult {
  const {
    lastPeriodStart,
    cyclesLogged,
    personalAvgCycleLength,
    personalStdDev,
    ageYears,
    conditions,
    lutealPhase = 14,
  } = input;

  const pop = getPopulationDefaults(ageYears);

  // Step 1: blend personal data with population defaults
  let cycleLength = blend(
    personalAvgCycleLength ?? pop.cycleLength,
    pop.cycleLength,
    cyclesLogged
  );
  let stdDev = blend(
    personalStdDev ?? pop.stdDev,
    pop.stdDev,
    cyclesLogged
  );

  // Step 2: apply medical condition overrides
  const hasPCOS          = conditions.includes('PCOS');
  const hasEndo          = conditions.includes('endometriosis');
  const hasPerimenopause = conditions.includes('perimenopause');

  if (hasPCOS) {
    cycleLength = Math.max(cycleLength, 35);
    stdDev      = Math.max(stdDev, 10);
  }

  if (hasEndo) {
    cycleLength = Math.min(cycleLength, 27);
    stdDev      = Math.max(stdDev, 4);
  }

  if (hasPerimenopause) {
    stdDev = Math.max(stdDev, 14);
  }

  // Step 3: compute all derived dates from the core formula
  const predicted = addDays(lastPeriodStart, cycleLength);
  const earliest  = addDays(predicted, -stdDev);
  const latest    = addDays(predicted, stdDev);
  const pmsStart  = addDays(predicted, -7);

  // Ovulation and fertile window are suppressed for conditions that make them unreliable
  const suppressOvulation = hasPCOS || hasPerimenopause;
  const ovulationDate = suppressOvulation ? null : addDays(predicted, -lutealPhase);
  const fertileStart  = suppressOvulation ? null : addDays(predicted, -(lutealPhase + 5));
  const fertileEnd    = suppressOvulation ? null : addDays(predicted, -(lutealPhase - 1));

  // Step 4: confidence score — penalise 10 points per day of std deviation
  const confidenceScore = Math.max(0, 100 - stdDev * 10);
  const showRangeOnly   = confidenceScore < 30;

  return {
    predicted,
    earliest,
    latest,
    ovulationDate,
    fertileStart,
    fertileEnd,
    pmsStart,
    confidenceScore,
    showRangeOnly,
    cycleLength,
    stdDev,
  };
}
