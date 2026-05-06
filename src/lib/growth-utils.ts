import { differenceInDays, addDays, format } from 'date-fns';
import { HVReferencePoint } from '../data/suwa-hv-data';

export interface LMSPoint {
  age: number; // in years
  L: number;
  M: number;
  S: number;
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
 * Calculates decimal age in years.
 * (Measurement Date - Birth Date) / 365.25
 * Validates that age is between 0 and 18 years.
 */
export function calculateDecimalAge(birthDate: Date, measurementDate: Date): number {
  const days = differenceInDays(measurementDate, birthDate);
  if (days < 0) return -1; // Indicator for measurement before birth
  
  // Use 4 decimal places for age as requested
  const age = Number((days / 365.25).toFixed(4));
  return age;
}

/**
 * Calculates corrected age for premature infants.
 * Only applicable up to 3 years old.
 */
export function calculateCorrectedAge(birthDate: Date, measurementDate: Date, gestationalWeeks: number, gestationalDays: number = 0): number {
  const age = calculateDecimalAge(birthDate, measurementDate);
  if (age < 0 || age > 3) return age; // Do not apply correction if child is over 3y or age is invalid

  // Clamp gestational age to [22w0d, 44w0d] as requested
  let weeks = gestationalWeeks;
  let days = gestationalDays;
  
  if (weeks < 22) {
    weeks = 22;
    days = 0;
  } else if (weeks >= 44) {
    weeks = 44;
    days = 0;
  }

  const totalGestationalDays = weeks * 7 + days;
  const fullTermDays = 40 * 7; // Standard full term is 40 weeks
  const deficitDays = fullTermDays - totalGestationalDays;

  // Only correct if born before 37 weeks (preterm)
  if (weeks >= 37 || deficitDays <= 0) return age;

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
  
  if (calcAge === table[0].age) {
    return { ...table[0], age }; // Return requested age but values from table[0]
  }
  if (calcAge === table[table.length - 1].age) {
    return { ...table[table.length - 1], age }; // Return requested age but values from last entry
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

  const t = (age - p1.age) / (p2.age - p1.age);
  
  return {
    age,
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
 * Calculates Height Velocity (HV) according to Suwa's method.
 * Returns velocity in cm/year and the midpoint age.
 */
export function calculateHeightVelocity(h1: number, t1: number, h2: number, t2: number): { velocity: number, midpointAge: number } | null {
  const interval = t2 - t1;
  if (interval < 0.99) return null; // Minimum 1 year (approx) as per requirement (365 days)
  
  const velocity = (h2 - h1) / interval;
  const midpointAge = (t1 + t2) / 2;
  
  return { velocity, midpointAge };
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
 * Linear interpolation for HV reference values (Suwa method)
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
 * Calculate Height Velocity SDS (Suwa method)
 */
export function calculateHVSDS(velocity: number, age: number, sex: 'male' | 'female', table: HVReferencePoint[]): number | null {
  const ref = interpolateHV(age, table);
  if (ref.sd === 0) return null;
  return (velocity - ref.mean) / ref.sd;
}
