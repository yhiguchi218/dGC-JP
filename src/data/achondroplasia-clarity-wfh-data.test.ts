import { describe, expect, it } from 'vitest';
import {
  ACHONDROPLASIA_CLARITY_WFH_BOYS,
  ACHONDROPLASIA_CLARITY_WFH_EXCLUDED_ROWS,
  ACHONDROPLASIA_CLARITY_WFH_GIRLS,
  ACHONDROPLASIA_CLARITY_WFH_SOURCE,
} from './achondroplasia-clarity-wfh-data';
import {
  ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS,
  ACHONDROPLASIA_CLARITY_WFH_CSV_SHA256,
} from './achondroplasia-clarity-wfh-source-fixture';

// The fixture is generated from the original supplementary CSV (Table S2) by
// scripts/achondroplasia-clarity-wfh-independent-check.ts (its own parser), so these tests compare the production
// data with the source rows rather than with itself. Mechanical reconciliation only: it does not replace
// a human check that the right file and columns were chosen.

const csvRows = (sex: 0 | 1) => ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS.filter(r => r[0] === sex);
const isBlankReference = (r: ReturnType<typeof csvRows>[number]) => r[4] === null && r[5] === null && r[6] === null;

describe('CLARITY weight-for-height source fixture', () => {
  it('covers the original CSV: 91 rows (50-140 cm) for each sex, sex codes 0 and 1 only', () => {
    expect(ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS).toHaveLength(182);
    expect(ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS.every(r => r[0] === 0 || r[0] === 1)).toBe(true);
    for (const sex of [0, 1] as const) {
      expect(csvRows(sex).map(r => r[1])).toEqual(Array.from({ length: 91 }, (_, i) => 50 + i));
    }
  });

  it('labels each source row as the interval [h, h+1), which the application does not use as its node definition', () => {
    for (const r of ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS) expect(r[2]).toBe(`[${r[1]},${r[1] + 1})`);
  });

  it('records the same SHA-256 as the data module', () => {
    expect(ACHONDROPLASIA_CLARITY_WFH_CSV_SHA256).toBe(ACHONDROPLASIA_CLARITY_WFH_SOURCE.sha256);
    expect(ACHONDROPLASIA_CLARITY_WFH_SOURCE.sha256).toBe('5903d2200360bcd72e6d851c355a9c2b0c428846b23d0bf7d00d56c8d6b2766e');
  });

  it('has blank reference cells (null, never 0) in exactly the girls rows 135-140 cm and nowhere else', () => {
    expect(csvRows(0).filter(isBlankReference)).toEqual([]);
    expect(csvRows(1).filter(isBlankReference).map(r => r[1])).toEqual([135, 136, 137, 138, 139, 140]);
    for (const r of ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS) {
      const blanks = [r[4], r[5], r[6]].filter(v => v === null).length;
      expect([0, 3]).toContain(blanks);
    }
  });
});

describe.each([
  { label: 'boys (CSV sex 0)', sex: 0 as const, table: ACHONDROPLASIA_CLARITY_WFH_BOYS, first: 50, last: 140, count: 91 },
  { label: 'girls (CSV sex 1)', sex: 1 as const, table: ACHONDROPLASIA_CLARITY_WFH_GIRLS, first: 50, last: 134, count: 85 },
])('achondroplasia CLARITY weight-for-height data: $label', ({ sex, table, first, last, count }) => {
  it('has exactly one row for each integer cm in the adopted range, in order, with no gaps or duplicates', () => {
    expect(table).toHaveLength(count);
    expect(table.map(r => r[0])).toEqual(Array.from({ length: last - first + 1 }, (_, i) => first + i));
  });

  it('has finite means and positive finite SDs in every adopted row', () => {
    for (const row of table) {
      expect(row.every(v => Number.isFinite(v))).toBe(true);
      const [, mean, sdLower, sdUpper] = row;
      expect(mean).toBeGreaterThan(0);
      expect(sdLower).toBeGreaterThan(0);
      expect(sdUpper).toBeGreaterThan(0);
    }
  });

  it('matches the original CSV cell by cell (ht, wt mean, wt sd lower, wt sd upper)', () => {
    const source = csvRows(sex);
    for (const row of table) {
      const src = source.find(r => r[1] === row[0]);
      expect(src).toBeDefined();
      expect([row[0], row[1], row[2], row[3]]).toEqual([src![1], src![4], src![5], src![6]]);
    }
  });
});

describe('CLARITY weight-for-height excluded rows', () => {
  it('records the girls 135-140 cm rows (blank in the source) as excluded with their source n', () => {
    expect(ACHONDROPLASIA_CLARITY_WFH_EXCLUDED_ROWS).toEqual([
      [1, 135, 7], [1, 136, 7], [1, 137, 4], [1, 138, 2], [1, 139, 1], [1, 140, 0],
    ]);
    const fromSource = csvRows(1).filter(isBlankReference).map(r => [r[0], r[1], r[3]]);
    expect(ACHONDROPLASIA_CLARITY_WFH_EXCLUDED_ROWS.map(r => [...r])).toEqual(fromSource);
  });

  it('does not adopt any excluded height, and no excluded row is read as a zero reference', () => {
    for (const [, heightCm] of ACHONDROPLASIA_CLARITY_WFH_EXCLUDED_ROWS) {
      expect(ACHONDROPLASIA_CLARITY_WFH_GIRLS.some(r => r[0] === heightCm)).toBe(false);
    }
    expect(ACHONDROPLASIA_CLARITY_WFH_GIRLS.some(r => r.slice(1).some(v => v === 0))).toBe(false);
  });

  it('keeps the non-monotonic girls means of the source (131 -> 132 -> 133 -> 134 cm) as published', () => {
    const meanAt = (h: number) => csvRows(1).find(r => r[1] === h)![4] as number;
    const productionMeanAt = (h: number) => ACHONDROPLASIA_CLARITY_WFH_GIRLS.find(r => r[0] === h)![1];
    for (const h of [131, 132, 133, 134]) expect(productionMeanAt(h)).toBe(meanAt(h));
    expect(productionMeanAt(133)).toBeLessThan(productionMeanAt(132));
    expect(productionMeanAt(134)).toBeLessThan(productionMeanAt(133));
  });
});
