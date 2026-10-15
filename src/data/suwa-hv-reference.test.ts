import { describe, expect, it } from 'vitest';
import { SUWA_HV_BOYS, SUWA_HV_GIRLS } from './suwa-hv-data';
import {
  SUWA_1992_SOURCE,
  SUWA_1992_TABLE3_BOYS_HV,
  SUWA_1992_TABLE4_GIRLS_HV,
} from './suwa-hv-source-fixture';

// Source ages are printed as yr-mo; months are twelfths of a year (13-3 is 13.25, not 13.3).
const yrMoToYears = (yrMo: string): number => {
  const [years, months] = yrMo.split('-').map(Number);
  return years + months / 12;
};

describe('Suwa et al. 1992 age notation', () => {
  it('converts the printed yr-mo ages as years + months / 12', () => {
    expect(yrMoToYears('13-3')).toBe(13.25);
    expect(yrMoToYears('13-6')).toBe(13.5);
    expect(yrMoToYears('13-9')).toBe(13.75);
    expect(yrMoToYears('0-9')).toBe(0.75);
  });
});

describe.each([
  {
    sex: 'boys (Table 3, journal p.10)',
    implementation: SUWA_HV_BOYS,
    source: SUWA_1992_TABLE3_BOYS_HV,
    meta: SUWA_1992_SOURCE.boys,
    // Means printed at 0-6 and 0-9 (their SD cells are dashes).
    meansAtHalfAndThreeQuarterYear: [25.7, 17.7],
    lastRow: { age: 17.5, mean: 0.3, sd: 0.3 },
  },
  {
    sex: 'girls (Table 4, journal p.11)',
    implementation: SUWA_HV_GIRLS,
    source: SUWA_1992_TABLE4_GIRLS_HV,
    meta: SUWA_1992_SOURCE.girls,
    meansAtHalfAndThreeQuarterYear: [25.0, 17.8],
    lastRow: { age: 17.25, mean: 0.1, sd: 0.2 },
  },
])('Suwa HV reference data against the source transcription: $sex', ({
  implementation,
  source,
  meta,
  meansAtHalfAndThreeQuarterYear,
  lastRow,
}) => {
  const byAge = (age: number) => implementation.find(point => point.age === age);

  it('has a source transcription with the documented row count and 0.25-year steps', () => {
    expect(source).toHaveLength(meta.rowCount);
    expect(source[0].ageYrMo).toBe(meta.firstAgeYrMo);
    expect(source[source.length - 1].ageYrMo).toBe(meta.lastAgeYrMo);
    source.forEach((row, index) => {
      expect(yrMoToYears(row.ageYrMo)).toBe(index * 0.25);
    });
  });

  it('prints dashes for the mean at 0-0 and 0-3 and for the SD at 0-0 through 0-9 only', () => {
    expect(source.filter(row => row.mean === null).map(row => row.ageYrMo)).toEqual(['0-0', '0-3']);
    expect(source.filter(row => row.sd === null).map(row => row.ageYrMo)).toEqual(['0-0', '0-3', '0-6', '0-9']);
  });

  it('has the source ages in the same order with no omitted, duplicated, or shifted rows', () => {
    expect(implementation.map(point => point.age)).toEqual(source.map(row => yrMoToYears(row.ageYrMo)));
  });

  it('has the source mean and SD in every row', () => {
    const mismatches = source.flatMap((row, index) => {
      const point = implementation[index];
      if (point !== undefined && point.mean === row.mean && point.sd === row.sd) return [];
      return [{
        ageYrMo: row.ageYrMo,
        source: { mean: row.mean, sd: row.sd },
        implementation: point === undefined ? undefined : { mean: point.mean, sd: point.sd },
      }];
    });

    expect(mismatches).toEqual([]);
  });

  it('represents source dashes as null and keeps the means printed at 0.5 and 0.75 years', () => {
    expect(byAge(0)).toEqual({ age: 0, mean: null, sd: null });
    expect(byAge(0.25)).toEqual({ age: 0.25, mean: null, sd: null });
    expect(byAge(0.5)).toEqual({ age: 0.5, mean: meansAtHalfAndThreeQuarterYear[0], sd: null });
    expect(byAge(0.75)).toEqual({ age: 0.75, mean: meansAtHalfAndThreeQuarterYear[1], sd: null });
  });

  it('never encodes a missing mean or SD as 0', () => {
    expect(implementation.filter(point => point.mean === 0 || point.sd === 0)).toEqual([]);
  });

  it('has a positive SD and a mean from 1.0 years onward', () => {
    implementation.filter(point => point.age >= 1).forEach(point => {
      expect(typeof point.mean).toBe('number');
      expect(point.sd).toBeGreaterThan(0);
    });
  });

  it('ends at the source final row without extending beyond it', () => {
    expect(implementation[implementation.length - 1]).toEqual(lastRow);
  });
});

describe('Suwa HV boys rows around the adolescent peak and the end of the table (Table 3, journal p.10)', () => {
  // Typed directly from the printed Table 3 values (yr-mo 13-0 through 14-3, 15-9 through 16-3, 17-3, 17-6).
  it.each([
    [13.0, 9.9, 1.45],
    [13.25, 9.4, 1.45],
    [13.5, 8.7, 1.23],
    [13.75, 7.6, 1.01],
    [14.0, 6.3, 0.88],
    [14.25, 5.3, 0.8],
    [15.75, 1.9, 0.58],
    [16.0, 1.6, 0.53],
    [16.25, 1.3, 0.49],
    [17.25, 0.5, 0.38],
    [17.5, 0.3, 0.3],
  ])('has mean and SD at %s years of %s and %s cm/year', (age, mean, sd) => {
    expect(SUWA_HV_BOYS.find(point => point.age === age)).toEqual({ age, mean, sd });
  });
});

describe('Suwa HV tables against statements in the source text', () => {
  // Text after Table 3 (journal p.10): HV fell below 1.0 cm/yr at 16 9/12 yr in boys and 14 9/12 yr in girls.
  it.each([
    ['boys', SUWA_HV_BOYS, 16.75],
    ['girls', SUWA_HV_GIRLS, 14.75],
  ])('%s mean HV first falls below 1.0 cm/year at the age the text states', (_sex, table, age) => {
    const first = table.find(point => typeof point.mean === 'number' && point.mean < 1.0);

    expect(first?.age).toBe(age);
  });

  // Journal p.7 and p.12: mean PHV with average growth tempo is 9.9 cm/yr at 13 0/12 yr (boys) and 8.3 cm/yr at 11 0/12 yr (girls).
  it.each([
    ['boys', SUWA_HV_BOYS, 13.0, 9.9],
    ['girls', SUWA_HV_GIRLS, 11.0, 8.3],
  ])('%s adolescent mean HV peaks at the age and value the text states', (_sex, table, peakAge, peakMean) => {
    const adolescent = table.filter(point => point.age >= 8);
    const peak = Math.max(...adolescent.map(point => point.mean));

    expect(peak).toBe(peakMean);
    expect(adolescent.find(point => point.mean === peak)?.age).toBe(peakAge);
  });
});
