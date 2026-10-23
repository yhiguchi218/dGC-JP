import { describe, expect, it } from 'vitest';
import {
  ACHONDROPLASIA_CLARITY_BOYS,
  ACHONDROPLASIA_CLARITY_GIRLS,
  ACHONDROPLASIA_CLARITY_SOURCE,
} from './achondroplasia-clarity-data';
import {
  ACHONDROPLASIA_CLARITY_CSV_ROWS,
  ACHONDROPLASIA_CLARITY_CSV_SHA256,
} from './achondroplasia-clarity-source-fixture';

// The fixture is generated from the original supplementary CSV by
// scripts/achondroplasia-clarity-independent-check.ts (its own parser), so these tests compare the production
// data with the source rows rather than with itself. Mechanical reconciliation only: it does not replace
// a human check that the right file and columns were chosen.

const csvRows = (sex: 0 | 1) => ACHONDROPLASIA_CLARITY_CSV_ROWS.filter(r => r[0] === sex);

describe('CLARITY source fixture', () => {
  it('covers the original CSV: 240 rows (months 0-239) for each sex, sex codes 0 and 1 only', () => {
    expect(ACHONDROPLASIA_CLARITY_CSV_ROWS).toHaveLength(480);
    expect(ACHONDROPLASIA_CLARITY_CSV_ROWS.every(r => r[0] === 0 || r[0] === 1)).toBe(true);
    for (const sex of [0, 1] as const) {
      expect(csvRows(sex).map(r => r[1])).toEqual(Array.from({ length: 240 }, (_, i) => i));
    }
  });

  it('records the same SHA-256 as the data module', () => {
    expect(ACHONDROPLASIA_CLARITY_CSV_SHA256).toBe(ACHONDROPLASIA_CLARITY_SOURCE.sha256);
    expect(ACHONDROPLASIA_CLARITY_SOURCE.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe.each([
  { label: 'boys (CSV sex 0)', sex: 0 as const, table: ACHONDROPLASIA_CLARITY_BOYS },
  { label: 'girls (CSV sex 1)', sex: 1 as const, table: ACHONDROPLASIA_CLARITY_GIRLS },
])('achondroplasia CLARITY data: $label', ({ sex, table }) => {
  it('has exactly one row for each completed month 0 through 216, in order, with no gaps or duplicates', () => {
    expect(table).toHaveLength(217);
    expect(table.map(r => r[0])).toEqual(Array.from({ length: 217 }, (_, i) => i));
  });

  it('has finite values and positive SDs in every used column', () => {
    for (const row of table) {
      expect(row.every(v => Number.isFinite(v))).toBe(true);
      const [, , htSd, , wtSdLower, wtSdUpper] = row;
      expect(htSd).toBeGreaterThan(0);
      expect(wtSdLower).toBeGreaterThan(0);
      expect(wtSdUpper).toBeGreaterThan(0);
    }
  });

  it('matches the original CSV cell by cell for months 0-216 (ht mean, htsd, wt_mean, wt sd lower, wt sd upper)', () => {
    const source = csvRows(sex);
    for (const row of table) {
      const src = source[row[0]];
      expect(src[1]).toBe(row[0]);
      expect(row.slice(1)).toEqual(src.slice(2));
    }
  });

  it('does not include the CSV rows beyond 18.0 years (months 217-239)', () => {
    expect(table.some(r => r[0] > 216)).toBe(false);
  });
});

describe('achondroplasia CLARITY data: fixed first and last rows (read from the CSV text)', () => {
  it('boys month 0 and month 216', () => {
    expect(ACHONDROPLASIA_CLARITY_BOYS[0]).toEqual([0, 52.76956881, 3.23377953, 4.733936651, 1.034708966, 0.787159345]);
    expect(ACHONDROPLASIA_CLARITY_BOYS[216]).toEqual([216, 128.9957039, 6.254672306, 51.10759086, 8.676724559, 16.09777198]);
  });

  it('girls month 0 and month 216', () => {
    expect(ACHONDROPLASIA_CLARITY_GIRLS[0]).toEqual([0, 51.49574815, 3.04069965, 4.251220579, 0.841383088, 0.604473324]);
    expect(ACHONDROPLASIA_CLARITY_GIRLS[216]).toEqual([216, 123.6769228, 5.26498318, 50.73670144, 9.212093836, 13.17195038]);
  });

  it('keeps boys and girls distinct (sex codes were not swapped)', () => {
    expect(ACHONDROPLASIA_CLARITY_BOYS[0][1]).toBeGreaterThan(ACHONDROPLASIA_CLARITY_GIRLS[0][1]);
  });
});
