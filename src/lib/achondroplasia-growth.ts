import { differenceInMonths } from 'date-fns';
import {
  ACHONDROPLASIA_CLARITY_BOYS,
  ACHONDROPLASIA_CLARITY_GIRLS,
  type AchondroplasiaClarityRow,
} from '../data/achondroplasia-clarity-data';
import { calculateDecimalAge } from './growth-utils';
import { CLINICAL_LIMITS } from './constants';

/** Last completed month of the 18.0-year limit (18 * 12). */
export const ACHONDROPLASIA_MAX_COMPLETED_MONTHS = CLINICAL_LIMITS.AGE.MAX * 12;

export type AchondroplasiaReferenceResolution =
  | { status: 'ok'; row: AchondroplasiaClarityRow; completedMonths: number; referenceAge: number }
  | { status: 'out-of-range'; referenceAge: number }
  | { status: 'unavailable' };

const TABLES = {
  male: ACHONDROPLASIA_CLARITY_BOYS,
  female: ACHONDROPLASIA_CLARITY_GIRLS,
} as const;

const isUsableMean = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isUsableSd = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isUsableValue = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Selects the CLARITY reference row for a reference birth date and measurement date.
 *
 * The age limit (reference age 0 through exactly 18.0 years, from the existing decimal-age calculation) is
 * checked separately from the row, which is chosen by completed months (`differenceInMonths`, the same
 * calculation the app uses elsewhere). The last row is never reused beyond the limit and nothing is
 * interpolated within a month. A date before the reference birth date, invalid dates, or a missing row are
 * `unavailable`.
 */
export function resolveAchondroplasiaReference(
  referenceBirthDate: Date,
  measurementDate: Date,
  sexKey: 'male' | 'female'
): AchondroplasiaReferenceResolution {
  if (!Number.isFinite(referenceBirthDate.getTime()) || !Number.isFinite(measurementDate.getTime())) {
    return { status: 'unavailable' };
  }
  const referenceAge = calculateDecimalAge(referenceBirthDate, measurementDate);
  if (referenceAge === null || referenceAge < CLINICAL_LIMITS.AGE.MIN) return { status: 'unavailable' };
  if (referenceAge > CLINICAL_LIMITS.AGE.MAX) return { status: 'out-of-range', referenceAge };

  const completedMonths = differenceInMonths(measurementDate, referenceBirthDate);
  if (!Number.isInteger(completedMonths) || completedMonths < 0) return { status: 'unavailable' };
  const row = TABLES[sexKey]?.[completedMonths];
  if (!row || row[0] !== completedMonths) return { status: 'unavailable' };
  return { status: 'ok', row, completedMonths, referenceAge };
}

/** Height SDS = (height - ht mean) / htsd, with the common SD (the application's adopted specification). */
export function calculateAchondroplasiaHeightSDS(height: number, row: AchondroplasiaClarityRow): number | null {
  if (!isUsableValue(height)) return null;
  const [, mean, sd] = row;
  if (!isUsableMean(mean) || !isUsableSd(sd)) return null;
  const sds = (height - mean) / sd;
  return Number.isFinite(sds) ? sds : null;
}

/**
 * Weight SDS using the upper SD above the mean and the lower SD at or below it (Hoover-Fong et al. 2021,
 * Methods, Analysis). The SD for the side used is validated first; a weight equal to the mean is exactly 0
 * only when that (lower) SD is usable.
 */
export function calculateAchondroplasiaWeightSDS(weight: number, row: AchondroplasiaClarityRow): number | null {
  if (!isUsableValue(weight)) return null;
  const [, , , mean, sdLower, sdUpper] = row;
  if (!isUsableMean(mean)) return null;
  const sd = weight > mean ? sdUpper : sdLower;
  if (!isUsableSd(sd)) return null;
  if (weight === mean) return 0;
  const sds = (weight - mean) / sd;
  return Number.isFinite(sds) ? sds : null;
}

/** Height at SD score z: ht mean + z * htsd. Null when not finite. */
export function achondroplasiaHeightAtZ(z: number, row: AchondroplasiaClarityRow): number | null {
  const [, mean, sd] = row;
  if (!Number.isFinite(z) || !isUsableMean(mean) || !isUsableSd(sd)) return null;
  const value = mean + z * sd;
  return Number.isFinite(value) ? value : null;
}

/** Weight at SD score z: upper SD for z > 0, lower SD for z < 0, the mean for z = 0. Null when not finite. */
export function achondroplasiaWeightAtZ(z: number, row: AchondroplasiaClarityRow): number | null {
  const [, , , mean, sdLower, sdUpper] = row;
  if (!Number.isFinite(z) || !isUsableMean(mean)) return null;
  if (z === 0) return mean;
  const sd = z > 0 ? sdUpper : sdLower;
  if (!isUsableSd(sd)) return null;
  const value = mean + z * sd;
  return Number.isFinite(value) ? value : null;
}

export interface AchondroplasiaLinePoint {
  /** Reference age in years (completed months / 12). */
  age: number;
  value: number;
}

/** Straight-line background points at each completed month for one SD line; non-finite points are omitted. */
export function getAchondroplasiaSdLine(
  sexKey: 'male' | 'female',
  indicator: 'height' | 'weight',
  z: number
): AchondroplasiaLinePoint[] {
  const valueAt = indicator === 'height' ? achondroplasiaHeightAtZ : achondroplasiaWeightAtZ;
  const points: AchondroplasiaLinePoint[] = [];
  for (const row of TABLES[sexKey]) {
    const value = valueAt(z, row);
    if (value !== null) points.push({ age: row[0] / 12, value });
  }
  return points;
}
