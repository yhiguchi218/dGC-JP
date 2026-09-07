import { differenceInDays, differenceInYears, differenceInMonths, addYears, addDays, format } from 'date-fns';
import { HVReferencePoint } from '../data/suwa-hv-data';
import { CLINICAL_LIMITS } from './constants';

export interface LMSPoint {
  age: number; // in years
  L: number;
  M: number;
  S: number;
  clampedAge?: number;
}

export interface ChildData {
  birthDate: Date;
  measurementDate: Date;
  measurementValue: number;
  sex: 'male' | 'female';
  gestationalWeeks?: number; // for premature correction
  gestationalDays?: number;
}

/**
 * Calculates chronological decimal age from completed years and the fraction of the current age year.
 *
 * Returns `null` when the measurement date precedes the birth date. Birthdays produce exact integer ages;
 * the calculation accounts for the actual length of the age year, including leap years.
 */
export function calculateDecimalAge(birthDate: Date, measurementDate: Date): number | null {
  if (measurementDate < birthDate) return null; // Indicator for measurement before birth
  
  // 1. Calculate completed years
  const years = differenceInYears(measurementDate, birthDate);
  
  // 2. Calculate the birthday of this age year (last birthday)
  const lastBirthday = addYears(birthDate, years);
  
  // 3. Calculate the birthday of next age year (next birthday)
  const nextBirthday = addYears(birthDate, years + 1);
  
  // 4. Calculate total days in this specific age's year (handles leap years)
  const daysInYear = differenceInDays(nextBirthday, lastBirthday);
  
  // 5. Calculate remaining days since last birthday
  const remainingDays = differenceInDays(measurementDate, lastBirthday);
  
  // 6. Calculate decimal part
  const decimalPart = remainingDays / daysInYear;
  
  // Use 4 decimal places for age as requested
  const age = Number((years + decimalPart).toFixed(4));
  return age;
}

/**
 * Checks whether a gestational-day value is acceptable for corrected-age utilities.
 *
 * Only finite integer values from 0 through 6 are accepted. Callers use a failed check to fail closed
 * rather than silently substituting a day value.
 */
export function isValidGestationalDays(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= CLINICAL_LIMITS.GESTATION_DAYS.MIN
    && value <= CLINICAL_LIMITS.GESTATION_DAYS.MAX;
}

/**
 * Calculates corrected age using the current application's preterm-correction policy.
 *
 * Invalid gestational days return `null`. Gestational weeks retain the existing clamping to 22 through
 * 44 weeks; correction is applied only below the preterm threshold and through exactly 3.0 chronological
 * years. Ages after that boundary, or term births, return chronological age unchanged. A corrected age of
 * exactly `0` is a valid result.
 */
export function calculateCorrectedAge(birthDate: Date, measurementDate: Date, gestationalWeeks: number, gestationalDays: number = 0): number | null {
  if (!isValidGestationalDays(gestationalDays)) return null;

  const age = calculateDecimalAge(birthDate, measurementDate);
  if (age === null || age > CLINICAL_LIMITS.AGE.PRETERM_CORRECTION_MAX_YEARS) return age; // Do not apply correction if child is over 3y or age is invalid

  // Clamp gestational age to [22w0d, 44w0d] as requested
  let weeks = gestationalWeeks;
  let days = gestationalDays;
  
  if (weeks < CLINICAL_LIMITS.GESTATION_WEEKS.MIN) {
    weeks = CLINICAL_LIMITS.GESTATION_WEEKS.MIN;
    days = 0;
  } else if (weeks >= CLINICAL_LIMITS.GESTATION_WEEKS.MAX) {
    weeks = CLINICAL_LIMITS.GESTATION_WEEKS.MAX;
    days = 0;
  }

  const totalGestationalDays = weeks * 7 + days;
  const fullTermDays = CLINICAL_LIMITS.GESTATION_WEEKS.FULL_TERM * 7; // Standard full term is 40 weeks
  const deficitDays = fullTermDays - totalGestationalDays;

  // Only correct if born before 37 weeks (preterm)
  if (weeks >= CLINICAL_LIMITS.GESTATION_WEEKS.PRETERM_THRESHOLD || deficitDays <= 0) return age;

  const correctedBirthDate = addDays(birthDate, deficitDays);
  return calculateDecimalAge(correctedBirthDate, measurementDate);
}

/**
 * LMS Calculation for Z-score (SDS)
 */
export function calculateZScore(y: number, lms: LMSPoint): number {
  const { L, M, S } = lms;
  if (L === 0) {
    return Math.log(y / M) / S;
  }
  return (Math.pow(y / M, L) - 1) / (L * S);
}

/**
 * Inverse LMS Calculation to get measurement from Z-score
 */
export function calculateMeasurementFromZ(z: number, lms: LMSPoint): number {
  const { L, M, S } = lms;
  if (L === 0) {
    return M * Math.exp(z * S);
  }
  return M * Math.pow(1 + L * S * z, 1 / L);
}

/**
 * Cubic Spline Interpolation for LMS values
 */
export function interpolateLMS(age: number, table: LMSPoint[]): LMSPoint {
  // Clamp age to table range for calculation
  const calcAge = Math.max(table[0].age, Math.min(table[table.length - 1].age, age));
  const isClamped = calcAge !== age;
  
  if (calcAge === table[0].age) {
    return { ...table[0], age, clampedAge: isClamped ? calcAge : undefined }; // Return requested age but values from table[0]
  }
  if (calcAge === table[table.length - 1].age) {
    return { ...table[table.length - 1], age, clampedAge: isClamped ? calcAge : undefined }; // Return requested age but values from last entry
  }

  // Find the interval [p1, p2]
  let i = 0;
  while (i < table.length - 2 && calcAge > table[i + 1].age) {
    i++;
  }

  const p0 = table[Math.max(0, i - 1)];
  const p1 = table[i];
  const p2 = table[i + 1];
  const p3 = table[Math.min(table.length - 1, i + 2)];

  const t = (calcAge - p1.age) / (p2.age - p1.age);
  
  return {
    age,
    clampedAge: isClamped ? calcAge : undefined,
    L: cubicInterpolate(t, p0.L, p1.L, p2.L, p3.L),
    M: cubicInterpolate(t, p0.M, p1.M, p2.M, p3.M),
    S: cubicInterpolate(t, p0.S, p1.S, p2.S, p3.S),
  };
}

/**
 * Catmull-Rom Spline interpolation
 */
function cubicInterpolate(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  
  const f1 = -0.5 * t3 + t2 - 0.5 * t;
  const f2 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const f4 = 0.5 * t3 - 0.5 * t2;
  
  return p0 * f1 + p1 * f2 + p2 * f3 + p3 * f4;
}

/**
 * Calculates Raw Height Velocity from one pair of measurements.
 *
 * Returns velocity in cm/year and midpoint age when the interval meets the configured raw minimum;
 * otherwise returns `null`. This is the mathematical interval calculation used separately from
 * Suwa-based HV selection and HV-SDS evaluation.
 */
export function calculateHeightVelocity(h1: number, t1: number, h2: number, t2: number): { velocity: number, midpointAge: number } | null {
  const interval = t2 - t1;
  if (interval < CLINICAL_LIMITS.HV.RAW_MIN_INTERVAL_YEARS) return null;
  
  const velocity = (h2 - h1) / interval;
  const midpointAge = (t1 + t2) / 2;
  
  return { velocity, midpointAge };
}

/**
 * Checks whether an interval is eligible for Suwa-based HV evaluation in this application.
 *
 * The inclusive 0.95-1.05 year window is an application-defined tolerance around the one-year target,
 * not a threshold attributed to the original Suwa publication.
 */
export function isSuwaHVInterval(intervalYears: number): boolean {
  return (
    intervalYears >= CLINICAL_LIMITS.HV.SUWA_MIN_INTERVAL_YEARS &&
    intervalYears <= CLINICAL_LIMITS.HV.SUWA_MAX_INTERVAL_YEARS
  );
}

/**
 * Finds the eligible prior measurement whose interval is closest to the one-year Suwa target.
 *
 * Only prior measurements within the application's Suwa interval tolerance are considered. Returns
 * `null` when no eligible prior measurement exists; equal distances retain the first eligible match.
 */
export function findBestSuwaPair(
  currentIndex: number,
  points: Array<{ age: number; height: number }>
): number | null {
  const current = points[currentIndex];
  let bestIndex: number | null = null;
  let bestDistance = Infinity;

  for (let j = 0; j < currentIndex; j++) {
    const previous = points[j];
    const interval = current.age - previous.age;
    if (!isSuwaHVInterval(interval)) continue;

    const distance = Math.abs(interval - CLINICAL_LIMITS.HV.SUWA_TARGET_INTERVAL_YEARS);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = j;
    }
  }

  return bestIndex;
}

export type HeightVelocityPoint = {
  date: Date;
  age: number;
  height: number;
};

type HeightVelocityInterval = {
  startDate: Date;
  endDate: Date;
  midpointAge: number;
  velocity: number;
  intervalDays: number;
  heightDiff: number;
};

export type HeightVelocityResult = {
  currentDate: Date;
  raw: HeightVelocityInterval | null;
  suwa: (HeightVelocityInterval & { sds: number | null }) | null;
};

/**
 * Produces separate Raw and Suwa-based height-velocity results for each measurement after the first.
 *
 * Raw HV uses the immediately preceding measurement. Suwa HV uses the eligible prior pair selected by
 * `findBestSuwaPair` and includes an HV-SDS when its reference standard deviation is nonzero. Results
 * with neither Raw nor Suwa data are omitted so the two concepts remain independently represented.
 */
export function calculateHeightVelocityResults(
  points: HeightVelocityPoint[],
  sex: 'male' | 'female',
  suwaTable: HVReferencePoint[]
): HeightVelocityResult[] {
  return points.slice(1).map((current, offset) => {
    const currentIndex = offset + 1;
    const rawPrevious = points[currentIndex - 1];
    const rawHV = calculateHeightVelocity(rawPrevious.height, rawPrevious.age, current.height, current.age);
    const suwaPreviousIndex = findBestSuwaPair(currentIndex, points);
    const suwaPrevious = suwaPreviousIndex === null ? null : points[suwaPreviousIndex];
    const suwaHV = suwaPrevious && calculateHeightVelocity(suwaPrevious.height, suwaPrevious.age, current.height, current.age);

    const toInterval = (
      previous: HeightVelocityPoint,
      velocity: NonNullable<typeof rawHV>
    ): HeightVelocityInterval => ({
      startDate: previous.date,
      endDate: current.date,
      midpointAge: velocity.midpointAge,
      velocity: velocity.velocity,
      intervalDays: Math.round((current.date.getTime() - previous.date.getTime()) / (1000 * 60 * 60 * 24)),
      heightDiff: current.height - previous.height,
    });

    return {
      currentDate: current.date,
      raw: rawHV ? toInterval(rawPrevious, rawHV) : null,
      suwa: suwaPrevious && suwaHV
        ? {
            ...toInterval(suwaPrevious, suwaHV),
            sds: calculateHVSDS(suwaHV.velocity, suwaHV.midpointAge, sex, suwaTable),
          }
        : null,
    };
  }).filter(result => result.raw !== null || result.suwa !== null);
}

/**
 * Calculate Standard Weight based on height, age, and sex
 * Using formulas provided for Japanese children
 */
export function calculateStandardWeight(height: number, age: number, sex: 'male' | 'female'): number | null {
  const X = height;
  if (sex === 'male') {
    // Boys
    if (age < 6) {
      // Infant (under 6y, 70 <= height < 120)
      if (X >= 70 && X < 120) {
        return 0.00206 * Math.pow(X, 2) - 0.1166 * X + 6.5273;
      }
    } else {
      // School age (6y and over)
      if (X >= 101 && X < 140) {
        return 0.0000303882 * Math.pow(X, 3) - 0.00571495 * Math.pow(X, 2) + 0.508124 * X - 9.17791;
      } else if (X >= 140 && X < 149) {
        return -0.000085013 * Math.pow(X, 3) + 0.0370692 * Math.pow(X, 2) - 4.6558 * X + 191.847;
      } else if (X >= 149 && X < 184) {
        return -0.000310205 * Math.pow(X, 3) + 0.151159 * Math.pow(X, 2) - 23.6303 * X + 1231.04;
      }
    }
  } else {
    // Girls
    if (age < 6) {
      // Infant (under 6y, 70 <= height < 120)
      if (X >= 70 && X < 120) {
        return 0.00249 * Math.pow(X, 2) - 0.1858 * X + 9.0360;
      }
    } else {
      // School age (6y and over)
      if (X >= 101 && X < 140) {
        return 0.000127719 * Math.pow(X, 3) - 0.0414712 * Math.pow(X, 2) + 4.8575 * X - 184.492;
      } else if (X >= 140 && X < 149) {
        return -0.00178766 * Math.pow(X, 3) + 0.803922 * Math.pow(X, 2) - 119.31 * X + 5885.03;
      } else if (X >= 149 && X < 171) {
        return 0.000956401 * Math.pow(X, 3) - 0.462755 * Math.pow(X, 2) + 75.3058 * X - 4068.31;
      }
    }
  }
  return null;
}

/**
 * Calculate Obesity Index (肥満度)
 * (Actual Weight - Standard Weight) / Standard Weight * 100
 */
export function calculateObesityIndex(weight: number, height: number, age: number, sex: 'male' | 'female'): number | null {
  const standardWeight = calculateStandardWeight(height, age, sex);
  if (standardWeight === null) return null;
  return ((weight - standardWeight) / standardWeight) * 100;
}

/**
 * Table 1: Age-Specific Height-Standardized Weight Coefficients (5y to 17y)
 */
const AGE_SPECIFIC_COEFFS = {
  male: {
    5: { a: 0.386, b: 23.699 },
    6: { a: 0.461, b: 32.382 },
    7: { a: 0.513, b: 38.878 },
    8: { a: 0.592, b: 48.804 },
    9: { a: 0.687, b: 61.390 },
    10: { a: 0.752, b: 70.461 },
    11: { a: 0.782, b: 75.106 },
    12: { a: 0.783, b: 75.642 },
    13: { a: 0.815, b: 81.348 },
    14: { a: 0.832, b: 83.695 },
    15: { a: 0.766, b: 70.989 },
    16: { a: 0.656, b: 51.822 },
    17: { a: 0.672, b: 53.642 },
  },
  female: {
    5: { a: 0.377, b: 22.750 },
    6: { a: 0.458, b: 32.079 },
    7: { a: 0.508, b: 38.367 },
    8: { a: 0.561, b: 45.006 },
    9: { a: 0.652, b: 56.992 },
    10: { a: 0.730, b: 68.091 },
    11: { a: 0.803, b: 78.846 },
    12: { a: 0.796, b: 76.934 },
    13: { a: 0.655, b: 54.234 },
    14: { a: 0.594, b: 43.264 },
    15: { a: 0.560, b: 37.002 },
    16: { a: 0.578, b: 39.057 },
    17: { a: 0.598, b: 42.339 },
  }
};

/**
 * Calculates Standard Weight using Age-Specific formula (Table 1)
 */
export function calculateStandardWeightByAge(height: number, age: number, sex: 'male' | 'female'): number | null {
  const floorAge = Math.floor(age);
  if (floorAge < 5 || floorAge > 17) return null;
  
  const coeffs = AGE_SPECIFIC_COEFFS[sex][floorAge as keyof typeof AGE_SPECIFIC_COEFFS.male];
  if (!coeffs) return null;

  return coeffs.a * height - coeffs.b;
}

/**
 * Calculates Obesity Index using Age-Specific Standard Weight
 */
export function calculateObesityIndexByAge(weight: number, height: number, age: number, sex: 'male' | 'female'): number | null {
  const standardWeight = calculateStandardWeightByAge(height, age, sex);
  if (standardWeight === null) return null;
  return ((weight - standardWeight) / standardWeight) * 100;
}

/**
 * Linearly interpolates the supplied Suwa HV reference table at a decimal age.
 *
 * Ages outside the table range use the nearest endpoint's mean and standard deviation.
 */
export function interpolateHV(age: number, table: HVReferencePoint[]): { mean: number, sd: number } {
  if (age <= table[0].age) return { mean: table[0].mean, sd: table[0].sd };
  if (age >= table[table.length - 1].age) return { mean: table[table.length - 1].mean, sd: table[table.length - 1].sd };

  let i = 0;
  while (i < table.length - 1 && age > table[i + 1].age) {
    i++;
  }

  const p1 = table[i];
  const p2 = table[i + 1];
  const t = (age - p1.age) / (p2.age - p1.age);

  return {
    mean: p1.mean + t * (p2.mean - p1.mean),
    sd: p1.sd + t * (p2.sd - p1.sd)
  };
}

/**
 * Calculates HV-SDS from a velocity and the interpolated mean and standard deviation in the supplied
 * Suwa reference table.
 *
 * Returns `null` when the interpolated standard deviation is zero; this function does not apply display
 * or interpretation thresholds.
 */
export function calculateHVSDS(velocity: number, age: number, sex: 'male' | 'female', table: HVReferencePoint[]): number | null {
  const ref = interpolateHV(age, table);
  if (ref.sd === 0) return null;
  return (velocity - ref.mean) / ref.sd;
}

/**
 * Calculates a beautiful string for Japanese 満月齢 (Completed months of age)
 */
export function calculateFullMonthsAge(birthDate: Date, measurementDate: Date): string {
  if (measurementDate < birthDate) return "生誕前";
  
  const totalMonths = differenceInMonths(measurementDate, birthDate);
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  if (totalMonths === 0) {
    return `満0ヶ月`;
  }

  if (years === 0) {
    return `満${remainingMonths}ヶ月`;
  } else {
    return `満${years}歳${remainingMonths}ヶ月`;
  }
}

/**
 * Returns the birth date used for preterm corrected-age and corrected monthly-reference calculations.
 *
 * Invalid gestational days return `null`. Existing gestational-week clamping to 22 through 44 weeks is
 * applied before calculation; term births return the original birth date, while eligible preterm births
 * return a date shifted by the calculated gestational deficit.
 */
export function getCorrectedBirthDate(birthDate: Date, gestationalWeeks: number, gestationalDays: number = 0): Date | null {
  if (!isValidGestationalDays(gestationalDays)) return null;

  let weeks = gestationalWeeks;
  let days = gestationalDays;
  
  if (weeks < CLINICAL_LIMITS.GESTATION_WEEKS.MIN) {
    weeks = CLINICAL_LIMITS.GESTATION_WEEKS.MIN;
    days = 0;
  } else if (weeks >= CLINICAL_LIMITS.GESTATION_WEEKS.MAX) {
    weeks = CLINICAL_LIMITS.GESTATION_WEEKS.MAX;
    days = 0;
  }

  const totalGestationalDays = weeks * 7 + days;
  const fullTermDays = CLINICAL_LIMITS.GESTATION_WEEKS.FULL_TERM * 7;
  const deficitDays = fullTermDays - totalGestationalDays;

  if (weeks >= CLINICAL_LIMITS.GESTATION_WEEKS.PRETERM_THRESHOLD || deficitDays <= 0) return birthDate;

  return addDays(birthDate, deficitDays);
}
