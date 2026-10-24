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
import { CLINICAL_LIMITS, DEFAULT_GROWTH_REFERENCE, type GrowthReference } from './constants';
import { parseMeasurementValue } from './validation-utils';
import {
  calculateAchondroplasiaHeightSDS,
  calculateAchondroplasiaWeightSDS,
  resolveAchondroplasiaReference,
} from './achondroplasia-growth';
import { calculateWeightForHeightSDS } from './achondroplasia-weight-for-height';

/**
 * CLARITY weight-for-height outcome. `not-applicable` is the Japanese reference (no such indicator); `not-entered`
 * means height or weight was left empty; `invalid-input` means either entered value is not a usable number;
 * `out-of-range` is a height outside the reference's valid height range; `unavailable` is a reference defect.
 */
export type WeightForHeightStatus =
  | 'not-applicable'
  | 'not-entered'
  | 'invalid-input'
  | 'ok'
  | 'out-of-range'
  | 'unavailable';

export interface MeasurementEvaluationInput {
  id: string;
  date: Date;
  height?: number | string;
  weight?: number | string;
}

export interface MeasurementEvaluationContext {
  /** Defaults to the Japanese reference. */
  growthReference?: GrowthReference;
  birthDate: Date;
  sexKey: 'male' | 'female';
  gestationalWeeks: number;
  gestationalDays: number;
  /** 附表1 completed-month [mean, SD] rows for the selected sex. */
  fuhyoHeightTable: ReadonlyArray<readonly [number, number]>;
  weightTable: LMSPoint[];
}

export interface MeasurementEvaluation {
  growthReference: GrowthReference;
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
  /** Achondroplasia (CLARITY) reference only; always false for the Japanese reference. */
  isWeightSDSOutOfRange: boolean;
  /** Achondroplasia (CLARITY) reference only; always false for the Japanese reference. */
  isWeightSDSUnavailable: boolean;
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
  /** Age (years) of the last weight LMS row when the SDS used it as a clamped reference; otherwise null. */
  weightSDSReferenceLimitAge: number | null;
  /** CLARITY weight-for-height SDS from this row's own height and weight; independent of age and gestational holds. */
  weightForHeightSDS: number | undefined;
  weightForHeightStatus: WeightForHeightStatus;
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
  const growthReference = ctx.growthReference ?? DEFAULT_GROWTH_REFERENCE;
  const isAchondroplasia = growthReference === 'achondroplasia-clarity';
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

  if (isAchondroplasia) {
    // CLARITY mean/SD reference. The age limit and the completed-month row come from one resolution step,
    // using the same reference birth date (corrected while correction applies) as the Japanese path.
    // BMI and the Japanese obesity indices are not part of this reference and are not calculated.
    let heightSDS: number | undefined = undefined;
    let weightSDS: number | undefined = undefined;
    let isHeightSDSOutOfRange = false;
    let isHeightSDSUnavailable = false;
    let isWeightSDSOutOfRange = false;
    let isWeightSDSUnavailable = false;
    if (!isStandardEvaluationHeld && (heightVal !== undefined || weightVal !== undefined)) {
      const referenceBirthDate = showCorrected && correctedBirthDate ? correctedBirthDate : birthDate;
      const reference = resolveAchondroplasiaReference(referenceBirthDate, m.date, sexKey);
      if (reference.status === 'ok') {
        if (heightVal !== undefined) {
          heightSDS = calculateAchondroplasiaHeightSDS(heightVal, reference.row) ?? undefined;
          isHeightSDSUnavailable = heightSDS === undefined;
        }
        if (weightVal !== undefined) {
          weightSDS = calculateAchondroplasiaWeightSDS(weightVal, reference.row) ?? undefined;
          isWeightSDSUnavailable = weightSDS === undefined;
        }
      } else if (reference.status === 'out-of-range') {
        isHeightSDSOutOfRange = heightVal !== undefined;
        isWeightSDSOutOfRange = weightVal !== undefined;
      } else {
        isHeightSDSUnavailable = heightVal !== undefined;
        isWeightSDSUnavailable = weightVal !== undefined;
      }
    }
    // Weight-for-height uses only this row's height and weight (selected by sex and height, never by age), so it is
    // not held by the gestational/corrected-age status that holds the age-based SDS.
    let weightForHeightSDS: number | undefined = undefined;
    let weightForHeightStatus: WeightForHeightStatus;
    if (isHeightInvalid || isWeightInvalid) {
      weightForHeightStatus = 'invalid-input';
    } else if (heightVal === undefined || weightVal === undefined) {
      weightForHeightStatus = 'not-entered';
    } else {
      const result = calculateWeightForHeightSDS(heightVal, weightVal, sexKey);
      weightForHeightStatus = result.status;
      if (result.status === 'ok') weightForHeightSDS = result.sds;
    }
    return {
      growthReference,
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
      isWeightSDSOutOfRange,
      isWeightSDSUnavailable,
      isHeightInvalid,
      isWeightInvalid,
      heightInputText: typeof m.height === 'string' ? m.height.trim() : String(m.height),
      weightInputText: typeof m.weight === 'string' ? m.weight.trim() : String(m.weight),
      isStandardWeightUnusable: false,
      isStandardWeightByAgeUnusable: false,
      height: heightVal,
      weight: weightVal,
      heightSDS,
      weightSDS,
      weightSDSReferenceLimitAge: null,
      weightForHeightSDS,
      weightForHeightStatus,
      bmi: undefined,
      obesityIndex: null,
      obesityIndexAge: null,
    };
  }

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
  let weightSDSReferenceLimitAge: number | null = null;
  if (!isStandardEvaluationHeld && weightVal !== undefined) {
    const weightReferenceBirthDate = showCorrected && correctedBirthDate
      ? correctedBirthDate
      : birthDate;
    weightSDS = calculateWeightSDSByCompletedMonths(weightVal, weightReferenceBirthDate, m.date, weightTable) ?? undefined;
    // Display flag only: marks a result that used the table's last LMS row via the existing endpoint clamp.
    if (weightSDS !== undefined && weightTable.length > 0) {
      const lastAge = weightTable[weightTable.length - 1].age;
      if (differenceInMonths(m.date, weightReferenceBirthDate) / 12 > lastAge) {
        weightSDSReferenceLimitAge = lastAge;
      }
    }
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
    growthReference,
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
    isWeightSDSOutOfRange: false,
    isWeightSDSUnavailable: false,
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
    weightForHeightSDS: undefined,
    weightForHeightStatus: 'not-applicable',
    bmi,
    weightSDSReferenceLimitAge,
    obesityIndex,
    obesityIndexAge,
  };
}
