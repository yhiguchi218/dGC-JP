/**
 * Clinical and Application Constants for Growth Chart
 * Standardized reference ranges and constraints according to Japanese pediatric clinical practice.
 */

export const CLINICAL_LIMITS = {
  // Height range in centimeters
  HEIGHT: {
    MIN: 30,
    MAX: 190,
    RECOMMENDED_MIN: 50,
    RECOMMENDED_MAX: 200,
  },
  // Weight range in kilograms
  WEIGHT: {
    MIN: 0.1,
    MAX: 130,
    RECOMMENDED_MIN: 2,
    RECOMMENDED_MAX: 100,
  },
  // Gestational age limits
  GESTATION_WEEKS: {
    MIN: 22,
    MAX: 44,
    PRETERM_THRESHOLD: 37, // Preterm if < 37 weeks
    FULL_TERM: 40,
    DEFAULT: 40,
  },
  GESTATION_DAYS: {
    MIN: 0,
    MAX: 6,
    DEFAULT: 0,
  },
  // Age limits in years
  AGE: {
    MIN: 0,
    MAX: 18,
    PRETERM_CORRECTION_MAX_YEARS: 3, // Corrected age applies up to 3 years old
    INFANT_MAX_YEARS: 6, // Under 6y for infant standard weight formula
    SCHOOL_AGE_MIN_YEARS: 5, // 5y to 17y for school-age formula
    SCHOOL_AGE_MAX_YEARS: 17,
  },
  // Standard Deviation threshold for outlier warnings
  SD_OUTLIER_THRESHOLD: 5, // ±5SD
  // Height Velocity clinical evaluation criteria
  HV: {
    RAW_MIN_INTERVAL_YEARS: 0.5, // Simple mathematical height velocity minimum interval
    SUWA_TARGET_INTERVAL_YEARS: 1.0, // Suwa standard 1-year target
    SUWA_MIN_INTERVAL_YEARS: 0.95, // Practical clinical tolerance lower bound (~11.4 months)
    SUWA_MAX_INTERVAL_YEARS: 1.05, // Practical clinical tolerance upper bound (~12.6 months)
  },
} as const;

export const FILE_LIMITS = {
  // Maximum allowed file size for JSON import
  MAX_JSON_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
} as const;

export interface ValidationIssue {
  field: string;
  message: string;
  rowIndex?: number;
  severity: 'error' | 'warning';
}

export interface DetailedValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
