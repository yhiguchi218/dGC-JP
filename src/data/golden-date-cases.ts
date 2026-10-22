/**
 * Fixed date / age expectations (calendar dates written as [year, month, day]).
 *
 * Expected values come from scripts/golden-date-independent-check.ts (integer civil-day arithmetic; no
 * production calculation and no date-fns) and from the hand arithmetic written in `basis`. They verify the
 * calculation path of the current application policy; they are not a check of any reference data.
 * Anniversary rule: Feb 29 falls on Feb 28 in a non-leap year. Age = completed years + days since the last
 * anniversary / days in that age year, rounded to 4 decimals.
 */
export type YMD = readonly [number, number, number];

export interface GoldenDecimalAgeCase {
  id: string;
  birth: YMD;
  measurement: YMD;
  expectedAge: number;
  basis: string;
}

export interface GoldenCorrectedBirthCase {
  id: string;
  birth: YMD;
  weeks: number;
  days: number;
  expectedCorrectedBirth: YMD;
  expectedDeficitDays: number;
  basis: string;
}

export interface GoldenCorrectedAgeCase {
  id: string;
  birth: YMD;
  measurement: YMD;
  weeks: number;
  days: number;
  /** null = before the corrected 40w0d-equivalent date (no corrected age). */
  expectedCorrectedAge: number | null;
  basis: string;
}

export const GOLDEN_DECIMAL_AGE_CASES: GoldenDecimalAgeCase[] = [
  { id: 'leap-born: day before 1st anniversary', birth: [2020, 2, 29], measurement: [2021, 2, 27], expectedAge: 0.9973, basis: '364/365 (2020-02-29 -> 2021-02-28 is 365 days)' },
  { id: 'leap-born: 1st anniversary is Feb 28', birth: [2020, 2, 29], measurement: [2021, 2, 28], expectedAge: 1, basis: 'anniversary day, 0/365' },
  { id: 'leap-born: Mar 1 after 1st anniversary', birth: [2020, 2, 29], measurement: [2021, 3, 1], expectedAge: 1.0027, basis: '1 + 1/365 = 1.00274' },
  { id: 'leap-born: Feb 28 of the 4th year', birth: [2020, 2, 29], measurement: [2024, 2, 28], expectedAge: 3.9973, basis: '3 + 365/366 (2023-02-28 -> 2024-02-29 is 366 days) = 3.99727' },
  { id: 'leap-born: 4th anniversary is Feb 29', birth: [2020, 2, 29], measurement: [2024, 2, 29], expectedAge: 4, basis: 'anniversary day' },
  { id: 'leap-born: Mar 1 after 4th anniversary', birth: [2020, 2, 29], measurement: [2024, 3, 1], expectedAge: 4.0027, basis: '4 + 1/365 (2024-02-29 -> 2025-02-28 is 365 days)' },
  { id: 'Feb 28 birth: day before 1st anniversary', birth: [2023, 2, 28], measurement: [2024, 2, 27], expectedAge: 0.9973, basis: '364/365 (2023-02-28 -> 2024-02-28 is 365 days)' },
  { id: 'Feb 28 birth: 1st anniversary', birth: [2023, 2, 28], measurement: [2024, 2, 28], expectedAge: 1, basis: 'anniversary day' },
  { id: 'Feb 28 birth: Feb 29 after 1st anniversary', birth: [2023, 2, 28], measurement: [2024, 2, 29], expectedAge: 1.0027, basis: '1 + 1/366 (2024-02-28 -> 2025-02-28 is 366 days) = 1.00273' },
  { id: 'age year containing Feb 29: day before anniversary', birth: [2019, 7, 1], measurement: [2020, 6, 30], expectedAge: 0.9973, basis: '365/366 (2019-07-01 -> 2020-07-01 is 366 days)' },
  { id: 'age year containing Feb 29: anniversary', birth: [2019, 7, 1], measurement: [2020, 7, 1], expectedAge: 1, basis: 'anniversary day' },
  { id: 'age year without Feb 29: day before anniversary', birth: [2019, 7, 1], measurement: [2021, 6, 30], expectedAge: 1.9973, basis: '1 + 364/365' },
  { id: 'month-end birth: day before 1st anniversary', birth: [2020, 1, 31], measurement: [2021, 1, 30], expectedAge: 0.9973, basis: '365/366 (2020-01-31 -> 2021-01-31 is 366 days)' },
  { id: 'month-end birth: 1st anniversary', birth: [2020, 1, 31], measurement: [2021, 1, 31], expectedAge: 1, basis: 'anniversary day' },
  { id: 'leap year: last day before anniversary', birth: [2020, 1, 1], measurement: [2020, 12, 31], expectedAge: 0.9973, basis: '365/366' },
  { id: 'non-leap year: last day before anniversary', birth: [2021, 1, 1], measurement: [2021, 12, 31], expectedAge: 0.9973, basis: '364/365' },
  { id: 'rounding: 39/365 = 0.106849 (rounds down, 1068.49 / 10000)', birth: [2021, 1, 1], measurement: [2021, 2, 9], expectedAge: 0.1068, basis: '10000 * 39 / 365 = 1068.493 -> 1068' },
  { id: 'rounding: 107/365 = 0.293150 (rounds up, 2931.51 / 10000)', birth: [2021, 1, 1], measurement: [2021, 4, 18], expectedAge: 0.2932, basis: '10000 * 107 / 365 = 2931.507 -> 2932' },
  { id: 'rounding: 76/366 = 0.207650 (rounds up, 2076.50 / 10000)', birth: [2020, 1, 1], measurement: [2020, 3, 17], expectedAge: 0.2077, basis: '10000 * 76 / 366 = 2076.503 -> 2077' },
  { id: 'rounding: 107/366 = 0.292349 (rounds down, 2923.50 / 10000)', birth: [2020, 1, 1], measurement: [2020, 4, 17], expectedAge: 0.2923, basis: '10000 * 107 / 366 = 2923.497 -> 2923' },
  { id: 'rounding with completed years', birth: [2018, 1, 1], measurement: [2021, 2, 9], expectedAge: 3.1068, basis: '3 + 39/365 (2021-01-01 -> 2022-01-01 is 365 days)' },
];

export const GOLDEN_CORRECTED_BIRTH_CASES: GoldenCorrectedBirthCase[] = [
  { id: '22w0d', birth: [2019, 12, 20], weeks: 22, days: 0, expectedCorrectedBirth: [2020, 4, 24], expectedDeficitDays: 126, basis: '280 - 154 = 126 days; 2019-12-20 + 126' },
  { id: '22w6d', birth: [2019, 12, 20], weeks: 22, days: 6, expectedCorrectedBirth: [2020, 4, 18], expectedDeficitDays: 120, basis: '280 - 160 = 120 days' },
  { id: '35w6d', birth: [2019, 12, 20], weeks: 35, days: 6, expectedCorrectedBirth: [2020, 1, 18], expectedDeficitDays: 29, basis: '280 - 251 = 29 days' },
  { id: '36w0d', birth: [2019, 12, 20], weeks: 36, days: 0, expectedCorrectedBirth: [2020, 1, 17], expectedDeficitDays: 28, basis: '280 - 252 = 28 days' },
  { id: '36w6d', birth: [2019, 12, 20], weeks: 36, days: 6, expectedCorrectedBirth: [2020, 1, 11], expectedDeficitDays: 22, basis: '280 - 258 = 22 days' },
  { id: '37w0d is not preterm', birth: [2019, 12, 20], weeks: 37, days: 0, expectedCorrectedBirth: [2019, 12, 20], expectedDeficitDays: 0, basis: 'weeks >= 37: birth date unchanged' },
  { id: '40w0d', birth: [2019, 12, 20], weeks: 40, days: 0, expectedCorrectedBirth: [2019, 12, 20], expectedDeficitDays: 0, basis: 'deficit 0' },
  { id: '41w3d (beyond 40w)', birth: [2019, 12, 20], weeks: 41, days: 3, expectedCorrectedBirth: [2019, 12, 20], expectedDeficitDays: 0, basis: 'deficit negative: unchanged' },
  { id: '20w3d clamps to 22w0d', birth: [2019, 12, 20], weeks: 20, days: 3, expectedCorrectedBirth: [2020, 4, 24], expectedDeficitDays: 126, basis: 'weeks < 22 -> 22w0d (days dropped)' },
  { id: '21w6d clamps to 22w0d', birth: [2019, 12, 20], weeks: 21, days: 6, expectedCorrectedBirth: [2020, 4, 24], expectedDeficitDays: 126, basis: 'weeks < 22 -> 22w0d' },
  { id: '45w clamps to 44w0d', birth: [2019, 12, 20], weeks: 45, days: 0, expectedCorrectedBirth: [2019, 12, 20], expectedDeficitDays: 0, basis: 'weeks >= 44 -> 44w0d, not preterm' },
  { id: 'leap-day birth 32w0d', birth: [2020, 2, 29], weeks: 32, days: 0, expectedCorrectedBirth: [2020, 4, 25], expectedDeficitDays: 56, basis: '280 - 224 = 56; 2020-02-29 + 31 = 03-31, + 25 = 04-25' },
  { id: 'leap-day birth 28w3d', birth: [2020, 2, 29], weeks: 28, days: 3, expectedCorrectedBirth: [2020, 5, 20], expectedDeficitDays: 81, basis: '280 - 199 = 81; 2020-02-29 + 31 = 03-31, + 30 = 04-30, + 20 = 05-20' },
  { id: 'year-end birth 24w0d', birth: [2023, 12, 31], weeks: 24, days: 0, expectedCorrectedBirth: [2024, 4, 21], expectedDeficitDays: 112, basis: '280 - 168 = 112; crosses Feb 29 2024' },
];

export const GOLDEN_CORRECTED_AGE_CASES: GoldenCorrectedAgeCase[] = [
  { id: '32w0d day before term-equivalent', birth: [2020, 1, 1], measurement: [2020, 2, 25], weeks: 32, days: 0, expectedCorrectedAge: null, basis: 'corrected birth 2020-02-26 (+56); measurement is 1 day earlier' },
  { id: '32w0d term-equivalent day', birth: [2020, 1, 1], measurement: [2020, 2, 26], weeks: 32, days: 0, expectedCorrectedAge: 0, basis: 'same day as the corrected birth date: exactly 0 (valid)' },
  { id: '32w0d day after term-equivalent', birth: [2020, 1, 1], measurement: [2020, 2, 27], weeks: 32, days: 0, expectedCorrectedAge: 0.0027, basis: '1/366 (2020-02-26 -> 2021-02-26 is 366 days)' },
  { id: '32w0d corrected age positive, corrected month still 0', birth: [2020, 1, 1], measurement: [2020, 3, 25], weeks: 32, days: 0, expectedCorrectedAge: 0.0765, basis: '28/366 = 0.07650 (2020-02-26 -> 03-25 is 28 days); corrected completed months 0' },
  { id: '32w0d corrected month turns 1', birth: [2020, 1, 1], measurement: [2020, 3, 26], weeks: 32, days: 0, expectedCorrectedAge: 0.0792, basis: '29/366 = 0.07923; corrected completed months 1' },
  { id: '22w0d day before term-equivalent', birth: [2020, 1, 1], measurement: [2020, 5, 5], weeks: 22, days: 0, expectedCorrectedAge: null, basis: 'corrected birth 2020-05-06 (+126)' },
  { id: '22w0d term-equivalent day', birth: [2020, 1, 1], measurement: [2020, 5, 6], weeks: 22, days: 0, expectedCorrectedAge: 0, basis: 'exactly 0' },
  { id: '21w0d clamps to 22w0d', birth: [2020, 1, 1], measurement: [2020, 5, 6], weeks: 21, days: 0, expectedCorrectedAge: 0, basis: 'clamped to 22w0d' },
  { id: '37w0d is not corrected', birth: [2020, 1, 1], measurement: [2020, 3, 25], weeks: 37, days: 0, expectedCorrectedAge: 0.2295, basis: 'chronological 84/366 = 0.22951' },
  { id: '40w0d is not corrected', birth: [2020, 1, 1],   measurement: [2020, 3, 25], weeks: 40, days: 0, expectedCorrectedAge: 0.2295, basis: 'chronological 84/366 = 0.22951' },
    { id: '32w0d day before 3rd birthday', birth: [2020, 1, 1], measurement: [2022, 12, 31], weeks: 32, days: 0, expectedCorrectedAge: 2.8438, basis: 'chronological 2.9973; corrected birth 2020-02-26: 2 + 308/365 (2022-02-26 -> 2022-12-31)' },
    { id: '32w0d 3rd birthday (3.0 included)', birth: [2020, 1, 1], measurement: [2023, 1, 1], weeks: 32, days: 0, expectedCorrectedAge: 2.8466, basis: 'chronological 3.0000 <= 3: corrected birth 2020-02-26: 2 + 309/365' },
  { id: '32w0d day after 3rd birthday (chronological)', birth: [2020, 1, 1], measurement: [2023, 1, 2], weeks: 32, days: 0, expectedCorrectedAge: 3.0027, basis: 'chronological 3 + 1/365 > 3: not corrected' },
  { id: 'leap-born 32w0d: day before 3rd birthday', birth: [2020, 2, 29], measurement: [2023, 2, 27], weeks: 32, days: 0,   expectedCorrectedAge: 2.8438, basis: 'chronological 2.9973; corrected birth 2020-04-25: 2 + 308/365 (2022-04-25 -> 2023-02-27)' },
    { id: 'leap-born 32w0d: 3rd birthday is Feb 28 (3.0 included)', birth: [2020, 2, 29], measurement: [2023, 2, 28], weeks: 32, days: 0, expectedCorrectedAge: 2.8466, basis: 'chronological 3.0000 <= 3: corrected birth 2020-04-25: 2 + 309/365 (2022-04-25 -> 2023-02-28)' },
  { id: 'leap-born 32w0d: Mar 1 (chronological)', birth: [2020, 2, 29], measurement: [2023, 3, 1], weeks: 32, days: 0, expectedCorrectedAge: 3.0027, basis: 'chronological 3 + 1/365 > 3: not corrected' },
];
