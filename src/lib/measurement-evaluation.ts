import { differenceInMonths } from 'date-fns';
import {
  calculateDecimalAge,
  calculateCorrectedAge,
  calculateMonthlyHeightSDS,
  calculateWeightSDSByCompletedMonths,
  HEIGHT_SDS_MAX_COMPLETED_MONTHS,
  calculateObesityIndex,
  calculateObesityIndexByAge,
  calculateStandardWeight,
  calculateStandardWeightByAge,
  isUsableStandardWeight,
  getCorrectedBirthDate,
  isValidGestationalDays,
  isValidGestationalWeeks,
  LMSPoint,
} from './growth-utils';
import { CLINICAL_LIMITS } from './constants';
import { parseMeasurementValue } from './validation-utils';

export interface MeasurementEvaluationInput {
  id: string;
  date: Date;
  height?: number | string;
  weight?: number | string;
}

export interface MeasurementEvaluationContext {
  birthDate: Date;
  sexKey: 'male' | 'female';
  gestationalWeeks: number;
  gestationalDays: number;
  /** 附表1 completed-month [mean, SD] rows for the selected sex. */
  fuhyoHeightTable: ReadonlyArray<readonly [number, number]>;
  weightTable: LMSPoint[];
}

export interface MeasurementEvaluation {
  id: string;
  date: Date;
  age: number;
  correctedAge: number;
  correctedBirthDate: Date | null;
  showCorrected: boolean;
  isPretermBeforeCorrection: boolean;
  isGestationalEvaluationPending: boolean;
  isStandardEvaluationHeld: boolean;
  isHeightSDSOutOfRange: boolean;
  isHeightSDSUnavailable: boolean;
  isHeightInvalid: boolean;
  isWeightInvalid: boolean;
  heightInputText: string;
  weightInputText: string;
  isStandardWeightUnusable: boolean;
  isStandardWeightByAgeUnusable: boolean;
  height: number | undefined;
  weight: number | undefined;
  heightSDS: number | undefined;
  weightSDS: number | undefined;
  bmi: number | undefined;
  obesityIndex: number | null;
  obesityIndexAge: number | null;
}

/** Returns null when the chronological age cannot be calculated (invalid dates). */
export function evaluateMeasurement(
  m: MeasurementEvaluationInput,
  ctx: MeasurementEvaluationContext
): MeasurementEvaluation | null {
  const { birthDate, sexKey, gestationalWeeks, gestationalDays, fuhyoHeightTable, weightTable } = ctx;
  const hasValidGestationalWeeks = isValidGestationalWeeks(gestationalWeeks);
  const isPreterm = hasValidGestationalWeeks && gestationalWeeks < CLINICAL_LIMITS.GESTATION_WEEKS.PRETERM_THRESHOLD;
  const hasValidGestationalDays = isValidGestationalDays(gestationalDays);

  const age = calculateDecimalAge(birthDate, m.date);
  if (age === null) return null;

  const canCalculateCorrection = isPreterm && hasValidGestationalDays;
  const correctedAge = canCalculateCorrection
    ? calculateCorrectedAge(birthDate, m.date, gestationalWeeks, gestationalDays)
    : age;
  const correctedBirthDate = canCalculateCorrection
    ? getCorrectedBirthDate(birthDate, gestationalWeeks, gestationalDays)
    : null;
  const isPretermBeforeCorrection = canCalculateCorrection && correctedBirthDate !== null && correctedAge === null;
  const isGestationalEvaluationPending = age <= CLINICAL_LIMITS.AGE.PRETERM_CORRECTION_MAX_YEARS
    && (!hasValidGestationalWeeks || (isPreterm && !hasValidGestationalDays));
  const isStandardEvaluationHeld = isGestationalEvaluationPending || isPretermBeforeCorrection;
  // Corrected age is clinically applied up to 3.0 years
  const showCorrected = isPreterm && correctedAge !== null && correctedBirthDate !== null && age <= CLINICAL_LIMITS.AGE.PRETERM_CORRECTION_MAX_YEARS;

  const heightInput = parseMeasurementValue(m.height);
  const weightInput = parseMeasurementValue(m.weight);
  const isHeightInvalid = heightInput.status === 'invalid';
  const isWeightInvalid = weightInput.status === 'invalid';
  // Invalid input is kept apart from not-entered: neither is used in any calculation.
  const heightVal = heightInput.status === 'valid' ? heightInput.value : undefined;
  const weightVal = weightInput.status === 'valid' ? weightInput.value : undefined;

  // Height SDS uses 附表1 completed-month mean/SD at every age; undefined means not calculable (no LMS fallback)
  let heightSDS: number | undefined = undefined;
  const heightReferenceBirthDate = showCorrected && correctedBirthDate
    ? correctedBirthDate
    : birthDate;
  const hasHeightInput = heightVal !== undefined;
  if (!isStandardEvaluationHeld && heightVal !== undefined) {
    heightSDS = calculateMonthlyHeightSDS(heightVal, heightReferenceBirthDate, m.date, fuhyoHeightTable) ?? undefined;
  }
  const isHeightSDSOutOfRange = !isStandardEvaluationHeld && hasHeightInput
    && differenceInMonths(m.date, heightReferenceBirthDate) > HEIGHT_SDS_MAX_COMPLETED_MONTHS;
  const isHeightSDSUnavailable = !isStandardEvaluationHeld && hasHeightInput
    && !isHeightSDSOutOfRange && heightSDS === undefined;

  // Calculate Weight SDS
  let weightSDS: number | undefined = undefined;
  if (!isStandardEvaluationHeld && weightVal !== undefined) {
    const weightReferenceBirthDate = showCorrected && correctedBirthDate
      ? correctedBirthDate
      : birthDate;
    weightSDS = calculateWeightSDSByCompletedMonths(weightVal, weightReferenceBirthDate, m.date, weightTable) ?? undefined;
  }

  // Calculate BMI
  let bmi: number | undefined = undefined;
  if (heightVal !== undefined && weightVal !== undefined) {
    const hM = heightVal / 100;
    bmi = weightVal / (hM * hM);
  }

  // Calculate Obesity Index (chronological age; not held by gestational status)
  let obesityIndex: number | null = null;
  let obesityIndexAge: number | null = null;
  let isStandardWeightUnusable = false;
  let isStandardWeightByAgeUnusable = false;
  if (heightVal !== undefined && weightVal !== undefined) {
    obesityIndex = calculateObesityIndex(weightVal, heightVal, age, sexKey);
    obesityIndexAge = calculateObesityIndexByAge(weightVal, heightVal, age, sexKey);
    const standardWeight = calculateStandardWeight(heightVal, age, sexKey);
    const standardWeightByAge = calculateStandardWeightByAge(heightVal, age, sexKey);
    isStandardWeightUnusable = standardWeight !== null && !isUsableStandardWeight(standardWeight);
    isStandardWeightByAgeUnusable = standardWeightByAge !== null && !isUsableStandardWeight(standardWeightByAge);
  }

  return {
    id: m.id,
    date: m.date,
    age,
    correctedAge: correctedAge ?? age,
    correctedBirthDate,
    showCorrected,
    isPretermBeforeCorrection,
    isGestationalEvaluationPending,
    isStandardEvaluationHeld,
    isHeightSDSOutOfRange,
    isHeightSDSUnavailable,
    isHeightInvalid,
    isWeightInvalid,
    heightInputText: typeof m.height === 'string' ? m.height.trim() : String(m.height),
    weightInputText: typeof m.weight === 'string' ? m.weight.trim() : String(m.weight),
    isStandardWeightUnusable,
    isStandardWeightByAgeUnusable,
    height: heightVal,
    weight: weightVal,
    heightSDS,
    weightSDS,
    bmi,
    obesityIndex,
    obesityIndexAge,
  };
}
