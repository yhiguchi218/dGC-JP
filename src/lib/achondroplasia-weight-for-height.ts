import {
  ACHONDROPLASIA_CLARITY_WFH_BOYS,
  ACHONDROPLASIA_CLARITY_WFH_GIRLS,
  type AchondroplasiaClarityWfhRow,
} from '../data/achondroplasia-clarity-wfh-data';

/**
 * CLARITY weight-for-height SDS (Hoover-Fong et al. 2021, Additional file 3 / Table S2).
 *
 * The reference is selected only by sex and height. Age, completed months, corrected age and gestation are not
 * used. Between the integer-cm nodes the mean, lower SD and upper SD are each interpolated linearly: this is the
 * application's adopted specification, not a method specified by the original authors. Nothing is extrapolated
 * and the nearest endpoint is never substituted outside the valid height range.
 */

const TABLES = {
  male: ACHONDROPLASIA_CLARITY_WFH_BOYS,
  female: ACHONDROPLASIA_CLARITY_WFH_GIRLS,
} as const;

export interface WeightForHeightReference {
  /** Interpolated mean weight (kg). */
  mean: number;
  /** Interpolated SD used for weights at or below the mean (kg). */
  sdLower: number;
  /** Interpolated SD used for weights above the mean (kg). */
  sdUpper: number;
}

export type WeightForHeightReferenceResolution =
  | { status: 'ok'; reference: WeightForHeightReference }
  | { status: 'out-of-range' }
  | { status: 'unavailable' };

export type WeightForHeightSdsResult =
  | { status: 'ok'; sds: number }
  | { status: 'out-of-range' }
  | { status: 'unavailable' };

const isUsableMean = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isUsableSd = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isUsableValue = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Valid height range (cm) of the adopted rows for a sex: boys 50-140, girls 50-134; both endpoints are valid. */
export function getWeightForHeightRange(sexKey: 'male' | 'female'): { min: number; max: number } {
  const table = TABLES[sexKey];
  return { min: table[0][0], max: table[table.length - 1][0] };
}

function rowAt(sexKey: 'male' | 'female', heightCm: number): AchondroplasiaClarityWfhRow | undefined {
  const table = TABLES[sexKey];
  const row = table[heightCm - table[0][0]];
  return row && row[0] === heightCm ? row : undefined;
}

/**
 * Mean, lower SD and upper SD at a height (cm). An integer height uses that row as-is; otherwise the two adjacent
 * rows are interpolated with t = (h - h0) / (h1 - h0). Outside the valid range the result is `out-of-range`.
 * A non-finite or non-positive height, or a missing/unusable row, is `unavailable`.
 */
export function resolveWeightForHeightReference(
  height: number,
  sexKey: 'male' | 'female'
): WeightForHeightReferenceResolution {
  if (!isUsableValue(height) || !TABLES[sexKey]) return { status: 'unavailable' };
  const { min, max } = getWeightForHeightRange(sexKey);
  if (height < min || height > max) return { status: 'out-of-range' };

  const h0 = Math.floor(height);
  const row0 = rowAt(sexKey, h0);
  if (!row0) return { status: 'unavailable' };
  let reference: WeightForHeightReference;
  if (height === h0) {
    reference = { mean: row0[1], sdLower: row0[2], sdUpper: row0[3] };
  } else {
    const row1 = rowAt(sexKey, h0 + 1);
    if (!row1) return { status: 'unavailable' };
    const t = (height - h0) / (row1[0] - row0[0]);
    reference = {
      mean: row0[1] + t * (row1[1] - row0[1]),
      sdLower: row0[2] + t * (row1[2] - row0[2]),
      sdUpper: row0[3] + t * (row1[3] - row0[3]),
    };
  }
  if (!isUsableMean(reference.mean) || !isUsableSd(reference.sdLower) || !isUsableSd(reference.sdUpper)) {
    return { status: 'unavailable' };
  }
  return { status: 'ok', reference };
}

/**
 * Weight-for-height SDS = (weight - mean) / SD with the interpolated reference at the measured height. The upper
 * SD is used when the weight is above the mean and the lower SD when it is at or below the mean (Methods,
 * Analysis); the selected SD is validated first, and a weight equal to the mean is exactly 0.
 */
export function calculateWeightForHeightSDS(
  height: number,
  weight: number,
  sexKey: 'male' | 'female'
): WeightForHeightSdsResult {
  if (!isUsableValue(weight)) return { status: 'unavailable' };
  const resolution = resolveWeightForHeightReference(height, sexKey);
  if (resolution.status !== 'ok') return resolution;
  const { mean, sdLower, sdUpper } = resolution.reference;
  const sd = weight > mean ? sdUpper : sdLower;
  if (!isUsableSd(sd)) return { status: 'unavailable' };
  if (weight === mean) return { status: 'ok', sds: 0 };
  const sds = (weight - mean) / sd;
  return Number.isFinite(sds) ? { status: 'ok', sds } : { status: 'unavailable' };
}

/** Weight at SD score z: upper SD for z > 0, lower SD for z < 0, the mean for z = 0. Null when not finite. */
export function weightForHeightAtZ(z: number, reference: WeightForHeightReference): number | null {
  if (!Number.isFinite(z) || !isUsableMean(reference.mean)) return null;
  if (z === 0) return reference.mean;
  const sd = z > 0 ? reference.sdUpper : reference.sdLower;
  if (!isUsableSd(sd)) return null;
  const value = reference.mean + z * sd;
  return Number.isFinite(value) ? value : null;
}

export interface WeightForHeightLinePoint {
  heightCm: number;
  value: number;
}

/**
 * Background points for one SD line, one per adopted integer-cm row, to be joined with straight lines (the same
 * linear interpolation as the SDS). Rows whose value is not finite are omitted; nothing is added for missing rows.
 */
export function getWeightForHeightSdLine(sexKey: 'male' | 'female', z: number): WeightForHeightLinePoint[] {
  const points: WeightForHeightLinePoint[] = [];
  for (const row of TABLES[sexKey]) {
    const value = weightForHeightAtZ(z, { mean: row[1], sdLower: row[2], sdUpper: row[3] });
    if (value !== null) points.push({ heightCm: row[0], value });
  }
  return points;
}
