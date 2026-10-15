/**
 * @file suwa-hv-source-fixture.ts
 * @description Test-only transcription of the height-velocity (HV) columns of Suwa et al. 1992.
 *
 * Transcribed from page images of the source PDF, NOT copied from `suwa-hv-data.ts`, so that the
 * implementation table can be compared against it row by row. Nothing in the application imports
 * this file.
 *
 * - Source: Suwa S, Tachibana K, Maesaka H, Tanaka T, Yokoya S. Longitudinal Standards for Height and
 *   Height Velocity for Japanese Children from Birth to Maturity. Clin Pediatr Endocrinol 1992;1(1):5-13.
 *   DOI 10.1297/cpe.1.5
 * - Boys: Table 3, journal p.10 (PDF page 6). Girls: Table 4, journal p.11 (PDF page 7).
 * - Columns read: `height velocity (cm/yr)` -> `mean` and `SD`. The adjacent `height (cm)` columns are not used.
 * - Unit: cm/year.
 * - Age: the printed `yr-mo` column, kept as printed (`13-3` = 13 years 3 months = 13.25 years).
 * - Missing values: the source prints "—"; they are `null` here. A missing value is not 0.
 *
 * Transcription was done by an AI agent and self-reviewed; it is not an independent human double entry.
 * See docs/suwa-hv-reference-audit.md for the review procedure and the cells a human should confirm.
 */

export interface SuwaSourceRow {
  /** Age as printed in the source `yr-mo` column. */
  ageYrMo: string;
  /** HV mean (cm/year); `null` where the source prints "—". */
  mean: number | null;
  /** HV SD (cm/year); `null` where the source prints "—". */
  sd: number | null;
}

export const SUWA_1992_SOURCE = {
  doi: '10.1297/cpe.1.5',
  unit: 'cm/year',
  missingMarker: '—',
  boys: { table: 'Table 3', journalPage: 10, pdfPage: 6, rowCount: 71, firstAgeYrMo: '0-0', lastAgeYrMo: '17-6' },
  girls: { table: 'Table 4', journalPage: 11, pdfPage: 7, rowCount: 70, firstAgeYrMo: '0-0', lastAgeYrMo: '17-3' },
} as const;

/** Table 3 (boys), journal p.10. */
export const SUWA_1992_TABLE3_BOYS_HV: readonly SuwaSourceRow[] = [
  { ageYrMo: '0-0', mean: null, sd: null },
  { ageYrMo: '0-3', mean: null, sd: null },
  { ageYrMo: '0-6', mean: 25.7, sd: null },
  { ageYrMo: '0-9', mean: 17.7, sd: null },
  { ageYrMo: '1-0', mean: 13.9, sd: 1.55 },
  { ageYrMo: '1-3', mean: 11.7, sd: 1.18 },
  { ageYrMo: '1-6', mean: 10.3, sd: 0.93 },
  { ageYrMo: '1-9', mean: 9.5, sd: 0.81 },
  { ageYrMo: '2-0', mean: 8.8, sd: 0.77 },
  { ageYrMo: '2-3', mean: 8.3, sd: 0.70 },
  { ageYrMo: '2-6', mean: 8.0, sd: 0.70 },
  { ageYrMo: '2-9', mean: 7.7, sd: 0.71 },
  { ageYrMo: '3-0', mean: 7.5, sd: 0.71 },
  { ageYrMo: '3-3', mean: 7.3, sd: 0.73 },
  { ageYrMo: '3-6', mean: 7.1, sd: 0.74 },
  { ageYrMo: '3-9', mean: 7.0, sd: 0.75 },
  { ageYrMo: '4-0', mean: 6.9, sd: 0.75 },
  { ageYrMo: '4-3', mean: 6.7, sd: 0.77 },
  { ageYrMo: '4-6', mean: 6.6, sd: 0.78 },
  { ageYrMo: '4-9', mean: 6.5, sd: 0.78 },
  { ageYrMo: '5-0', mean: 6.3, sd: 0.79 },
  { ageYrMo: '5-3', mean: 6.2, sd: 0.80 },
  { ageYrMo: '5-6', mean: 6.1, sd: 0.83 },
  { ageYrMo: '5-9', mean: 6.0, sd: 0.84 },
  { ageYrMo: '6-0', mean: 5.9, sd: 0.84 },
  { ageYrMo: '6-3', mean: 5.8, sd: 0.84 },
  { ageYrMo: '6-6', mean: 5.8, sd: 0.84 },
  { ageYrMo: '6-9', mean: 5.8, sd: 0.83 },
  { ageYrMo: '7-0', mean: 5.8, sd: 0.81 },
  { ageYrMo: '7-3', mean: 5.8, sd: 0.80 },
  { ageYrMo: '7-6', mean: 5.7, sd: 0.78 },
  { ageYrMo: '7-9', mean: 5.6, sd: 0.78 },
  { ageYrMo: '8-0', mean: 5.5, sd: 0.74 },
  { ageYrMo: '8-3', mean: 5.4, sd: 0.70 },
  { ageYrMo: '8-6', mean: 5.3, sd: 0.68 },
  { ageYrMo: '8-9', mean: 5.2, sd: 0.68 },
  { ageYrMo: '9-0', mean: 5.1, sd: 0.65 },
  { ageYrMo: '9-3', mean: 5.1, sd: 0.65 },
  { ageYrMo: '9-6', mean: 5.0, sd: 0.65 },
  { ageYrMo: '9-9', mean: 5.0, sd: 0.65 },
  { ageYrMo: '10-0', mean: 4.9, sd: 0.68 },
  { ageYrMo: '10-3', mean: 4.9, sd: 0.66 },
  { ageYrMo: '10-6', mean: 5.0, sd: 0.66 },
  { ageYrMo: '10-9', mean: 5.0, sd: 0.66 },
  { ageYrMo: '11-0', mean: 5.1, sd: 0.70 },
  { ageYrMo: '11-3', mean: 5.3, sd: 0.72 },
  { ageYrMo: '11-6', mean: 5.6, sd: 0.72 },
  { ageYrMo: '11-9', mean: 6.1, sd: 0.75 },
  { ageYrMo: '12-0', mean: 6.7, sd: 0.80 },
  { ageYrMo: '12-3', mean: 7.4, sd: 0.90 },
  { ageYrMo: '12-6', mean: 8.6, sd: 1.15 },
  { ageYrMo: '12-9', mean: 9.5, sd: 1.40 },
  { ageYrMo: '13-0', mean: 9.9, sd: 1.45 },
  { ageYrMo: '13-3', mean: 9.4, sd: 1.45 },
  { ageYrMo: '13-6', mean: 8.7, sd: 1.23 },
  { ageYrMo: '13-9', mean: 7.6, sd: 1.01 },
  { ageYrMo: '14-0', mean: 6.3, sd: 0.88 },
  { ageYrMo: '14-3', mean: 5.3, sd: 0.80 },
  { ageYrMo: '14-6', mean: 4.5, sd: 0.78 },
  { ageYrMo: '14-9', mean: 3.9, sd: 0.71 },
  { ageYrMo: '15-0', mean: 3.3, sd: 0.69 },
  { ageYrMo: '15-3', mean: 2.8, sd: 0.68 },
  { ageYrMo: '15-6', mean: 2.3, sd: 0.63 },
  { ageYrMo: '15-9', mean: 1.9, sd: 0.58 },
  { ageYrMo: '16-0', mean: 1.6, sd: 0.53 },
  { ageYrMo: '16-3', mean: 1.3, sd: 0.49 },
  { ageYrMo: '16-6', mean: 1.0, sd: 0.44 },
  { ageYrMo: '16-9', mean: 0.8, sd: 0.39 },
  { ageYrMo: '17-0', mean: 0.6, sd: 0.39 },
  { ageYrMo: '17-3', mean: 0.5, sd: 0.38 },
  { ageYrMo: '17-6', mean: 0.3, sd: 0.30 },
];

/** Table 4 (girls), journal p.11. */
export const SUWA_1992_TABLE4_GIRLS_HV: readonly SuwaSourceRow[] = [
  { ageYrMo: '0-0', mean: null, sd: null },
  { ageYrMo: '0-3', mean: null, sd: null },
  { ageYrMo: '0-6', mean: 25.0, sd: null },
  { ageYrMo: '0-9', mean: 17.8, sd: null },
  { ageYrMo: '1-0', mean: 13.4, sd: 1.4 },
  { ageYrMo: '1-3', mean: 11.6, sd: 1.1 },
  { ageYrMo: '1-6', mean: 10.3, sd: 1.0 },
  { ageYrMo: '1-9', mean: 9.4, sd: 0.9 },
  { ageYrMo: '2-0', mean: 8.8, sd: 0.8 },
  { ageYrMo: '2-3', mean: 8.4, sd: 0.8 },
  { ageYrMo: '2-6', mean: 8.0, sd: 0.8 },
  { ageYrMo: '2-9', mean: 7.7, sd: 0.8 },
  { ageYrMo: '3-0', mean: 7.4, sd: 0.8 },
  { ageYrMo: '3-3', mean: 7.2, sd: 0.8 },
  { ageYrMo: '3-6', mean: 7.1, sd: 0.7 },
  { ageYrMo: '3-9', mean: 7.0, sd: 0.7 },
  { ageYrMo: '4-0', mean: 6.9, sd: 0.7 },
  { ageYrMo: '4-3', mean: 6.8, sd: 0.7 },
  { ageYrMo: '4-6', mean: 6.7, sd: 0.7 },
  { ageYrMo: '4-9', mean: 6.6, sd: 0.7 },
  { ageYrMo: '5-0', mean: 6.5, sd: 0.7 },
  { ageYrMo: '5-3', mean: 6.4, sd: 0.7 },
  { ageYrMo: '5-6', mean: 6.3, sd: 0.7 },
  { ageYrMo: '5-9', mean: 6.3, sd: 0.7 },
  { ageYrMo: '6-0', mean: 6.1, sd: 0.7 },
  { ageYrMo: '6-3', mean: 6.1, sd: 0.7 },
  { ageYrMo: '6-6', mean: 5.9, sd: 0.7 },
  { ageYrMo: '6-9', mean: 5.8, sd: 0.7 },
  { ageYrMo: '7-0', mean: 5.7, sd: 0.7 },
  { ageYrMo: '7-3', mean: 5.6, sd: 0.7 },
  { ageYrMo: '7-6', mean: 5.5, sd: 0.7 },
  { ageYrMo: '7-9', mean: 5.4, sd: 0.8 },
  { ageYrMo: '8-0', mean: 5.4, sd: 0.8 },
  { ageYrMo: '8-3', mean: 5.3, sd: 0.8 },
  { ageYrMo: '8-6', mean: 5.3, sd: 0.8 },
  { ageYrMo: '8-9', mean: 5.3, sd: 0.8 },
  { ageYrMo: '9-0', mean: 5.4, sd: 0.8 },
  { ageYrMo: '9-3', mean: 5.4, sd: 0.8 },
  { ageYrMo: '9-6', mean: 5.6, sd: 0.8 },
  { ageYrMo: '9-9', mean: 5.9, sd: 0.8 },
  { ageYrMo: '10-0', mean: 6.3, sd: 0.8 },
  { ageYrMo: '10-3', mean: 6.7, sd: 0.8 },
  { ageYrMo: '10-6', mean: 7.3, sd: 0.9 },
  { ageYrMo: '10-9', mean: 7.9, sd: 1.0 },
  { ageYrMo: '11-0', mean: 8.3, sd: 1.1 },
  { ageYrMo: '11-3', mean: 8.0, sd: 1.0 },
  { ageYrMo: '11-6', mean: 7.4, sd: 0.9 },
  { ageYrMo: '11-9', mean: 6.7, sd: 0.8 },
  { ageYrMo: '12-0', mean: 5.8, sd: 0.8 },
  { ageYrMo: '12-3', mean: 5.0, sd: 0.9 },
  { ageYrMo: '12-6', mean: 4.2, sd: 0.9 },
  { ageYrMo: '12-9', mean: 3.5, sd: 0.9 },
  { ageYrMo: '13-0', mean: 3.0, sd: 0.9 },
  { ageYrMo: '13-3', mean: 2.5, sd: 0.8 },
  { ageYrMo: '13-6', mean: 2.2, sd: 0.7 },
  { ageYrMo: '13-9', mean: 1.8, sd: 0.7 },
  { ageYrMo: '14-0', mean: 1.5, sd: 0.6 },
  { ageYrMo: '14-3', mean: 1.3, sd: 0.6 },
  { ageYrMo: '14-6', mean: 1.1, sd: 0.5 },
  { ageYrMo: '14-9', mean: 0.9, sd: 0.5 },
  { ageYrMo: '15-0', mean: 0.8, sd: 0.4 },
  { ageYrMo: '15-3', mean: 0.7, sd: 0.4 },
  { ageYrMo: '15-6', mean: 0.5, sd: 0.4 },
  { ageYrMo: '15-9', mean: 0.4, sd: 0.4 },
  { ageYrMo: '16-0', mean: 0.4, sd: 0.4 },
  { ageYrMo: '16-3', mean: 0.3, sd: 0.4 },
  { ageYrMo: '16-6', mean: 0.2, sd: 0.3 },
  { ageYrMo: '16-9', mean: 0.2, sd: 0.3 },
  { ageYrMo: '17-0', mean: 0.1, sd: 0.2 },
  { ageYrMo: '17-3', mean: 0.1, sd: 0.2 },
];
