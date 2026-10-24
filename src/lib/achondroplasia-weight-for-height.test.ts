import { describe, expect, it } from 'vitest';
import {
  calculateWeightForHeightSDS,
  getWeightForHeightRange,
  getWeightForHeightSdLine,
  resolveWeightForHeightReference,
  weightForHeightAtZ,
} from './achondroplasia-weight-for-height';
import { ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS } from '../data/achondroplasia-clarity-wfh-source-fixture';

// Expected values come from the original CSV cells (via the source fixture) and plain arithmetic, or are fixed
// numbers printed by scripts/achondroplasia-clarity-wfh-independent-check.ts (weighted-average interpolation form,
// computed without importing this module). Nothing below is taken from the production functions' own output.

const SEX_CODE = { male: 0, female: 1 } as const;
const csv = (sexKey: 'male' | 'female', height: number) => {
  const row = ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS.find(r => r[0] === SEX_CODE[sexKey] && r[1] === height);
  if (!row || row[4] === null || row[5] === null || row[6] === null) throw new Error(`no usable CSV row for ${sexKey} ${height}`);
  return { mean: row[4], lower: row[5], upper: row[6] };
};
const Z_LEVELS = [-3, -2.5, -2, -1, 0, 1, 2] as const;

describe('getWeightForHeightRange', () => {
  it('is 50-140 cm for boys and 50-134 cm for girls', () => {
    expect(getWeightForHeightRange('male')).toEqual({ min: 50, max: 140 });
    expect(getWeightForHeightRange('female')).toEqual({ min: 50, max: 134 });
  });
});

describe('weight-for-height reference resolution: applicable height range', () => {
  it.each([
    ['male', 50], ['male', 140], ['male', 50.0001], ['male', 139.9999],
    ['female', 50], ['female', 134], ['female', 133.9999],
  ] as const)('resolves %s %s cm (endpoints are valid)', (sexKey, height) => {
    expect(resolveWeightForHeightReference(height, sexKey).status).toBe('ok');
  });

  it.each([
    ['male', 49.9999], ['male', 49], ['male', 140.0001], ['male', 141], ['male', 200],
    ['female', 49.9999], ['female', 134.0001], ['female', 135], ['female', 140],
  ] as const)('does not resolve %s %s cm (no extrapolation, no clamp to an endpoint, no other-sex table)', (sexKey, height) => {
    expect(resolveWeightForHeightReference(height, sexKey)).toEqual({ status: 'out-of-range' });
    expect(calculateWeightForHeightSDS(height, 20, sexKey)).toEqual({ status: 'out-of-range' });
  });

  it('keeps the girls 135-140 cm source rows (blank in the CSV) out of range rather than as zero or boys values', () => {
    expect(calculateWeightForHeightSDS(135, 0.001, 'female')).toEqual({ status: 'out-of-range' });
    expect(calculateWeightForHeightSDS(135, 60, 'female')).toEqual({ status: 'out-of-range' });
    expect(calculateWeightForHeightSDS(135, 60, 'male').status).toBe('ok');
  });
});

describe('weight-for-height reference resolution: integer nodes and linear interpolation', () => {
  it.each([['male', 50], ['male', 95], ['male', 140], ['female', 50], ['female', 100], ['female', 134]] as const)(
    'uses the CSV row as-is at the integer height (%s %s cm)',
    (sexKey, height) => {
      const resolution = resolveWeightForHeightReference(height, sexKey);
      expect(resolution.status).toBe('ok');
      if (resolution.status !== 'ok') return;
      const src = csv(sexKey, height);
      expect(resolution.reference).toEqual({ mean: src.mean, sdLower: src.lower, sdUpper: src.upper });
    },
  );

  // Fixed values: independent arithmetic on the CSV cells, v0*(h1-h)/(h1-h0) + v1*(h-h0)/(h1-h0).
  it.each([
    ['male', 75.5, 11.470255075, 1.1614438635, 1.3386111225],
    ['male', 95.25, 18.8699934925, 1.703548124, 3.12020531425],
    ['male', 139.5, 59.12191893, 8.576923883, 9.4720476005],
    ['female', 100.5, 22.266474585, 2.4437438735, 2.4437438735],
    ['female', 131.5, 60.860492445, 12.308339515, 12.308339515],
    ['female', 132.5, 60.757618405, 12.406967365, 12.406967365],
    ['female', 133.5, 60.12512268, 12.2334253, 12.2334253],
  ] as const)('interpolates mean, lower SD and upper SD at %s %s cm', (sexKey, height, mean, sdLower, sdUpper) => {
    const resolution = resolveWeightForHeightReference(height, sexKey);
    expect(resolution.status).toBe('ok');
    if (resolution.status !== 'ok') return;
    expect(resolution.reference.mean).toBeCloseTo(mean, 9);
    expect(resolution.reference.sdLower).toBeCloseTo(sdLower, 9);
    expect(resolution.reference.sdUpper).toBeCloseTo(sdUpper, 9);
  });

  it('does not round or floor the measured height (95.25 cm is not the 95 cm row)', () => {
    const at95 = resolveWeightForHeightReference(95, 'male');
    const at9525 = resolveWeightForHeightReference(95.25, 'male');
    const at96 = resolveWeightForHeightReference(96, 'male');
    if (at95.status !== 'ok' || at9525.status !== 'ok' || at96.status !== 'ok') throw new Error('expected ok');
    expect(at9525.reference.mean).toBeGreaterThan(at95.reference.mean);
    expect(at9525.reference.mean).toBeLessThan(at96.reference.mean);
  });

  it('follows the source across the girls 132 -> 133 -> 134 cm drops without forcing monotonicity', () => {
    const mean = (h: number) => {
      const r = resolveWeightForHeightReference(h, 'female');
      if (r.status !== 'ok') throw new Error('expected ok');
      return r.reference.mean;
    };
    expect(mean(132.5)).toBeGreaterThan(mean(133.5));
    expect(mean(133.5)).toBeGreaterThan(mean(134));
    // Midpoint of the two source nodes, by plain arithmetic.
    expect(mean(132.5)).toBeCloseTo((csv('female', 132).mean + csv('female', 133).mean) / 2, 12);
    expect(mean(133.5)).toBeCloseTo((csv('female', 133).mean + csv('female', 134).mean) / 2, 12);
  });
});

describe('weight-for-height SDS', () => {
  // [sex, height, weight, SDS]: weights are chosen about 0.5 SD below and 1.5 SD above the interpolated mean and the
  // SDS values are independent arithmetic (weight - mean) / SD of the interpolated reference.
  it.each([
    ['male', 50, 3.46, -0.500801646559246],
    ['male', 50, 4.67, 1.49574453278668],
    ['male', 75.5, 10.89, -0.499598037611053],
    ['male', 75.5, 13.48, 1.50136577473418],
    ['male', 95, 17.9, -0.502348794862338],
    ['male', 95, 23.33, 1.49843233548101],
    ['male', 95.25, 18.02, -0.498954787672321],
    ['male', 95.25, 23.55, 1.49990338332108],
    ['male', 139.5, 54.83, -0.500403056917277],
    ['male', 139.5, 73.33, 1.50000102081941],
    ['male', 140, 55.2, -0.499930165950863],
    ['male', 140, 72.63, 1.50009113493949],
    ['female', 50, 3.62, -0.494403817364733],
    ['female', 50, 4.85, 1.49937632774006],
    ['female', 100.5, 21.04, -0.501883441345844],
    ['female', 100.5, 25.93, 1.49914459314961],
    ['female', 131.5, 54.71, -0.499701234070159],
    ['female', 131.5, 79.32, 1.49975612327753],
    ['female', 132.5, 54.55, -0.500333258110412],
    ['female', 133.5, 78.48, 1.50038741152897],
    ['female', 134, 53.63, -0.500196926257958],
    ['female', 134, 77.77, 1.49975253317998],
  ] as const)('%s %s cm %s kg -> %s SDS', (sexKey, height, weight, sds) => {
    const result = calculateWeightForHeightSDS(height, weight, sexKey);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.sds).toBeCloseTo(sds, 9);
  });

  it('is exactly 0 when the weight equals the mean of an integer-height row', () => {
    for (const [sexKey, height] of [['male', 95], ['male', 50], ['female', 134], ['female', 100]] as const) {
      const result = calculateWeightForHeightSDS(height, csv(sexKey, height).mean, sexKey);
      expect(result).toEqual({ status: 'ok', sds: 0 });
      if (result.status === 'ok') expect(Object.is(result.sds, 0)).toBe(true);
    }
  });

  it('uses the upper SD above the mean and the lower SD at or below the mean (boys 95 cm: lower 1.69, upper 3.06)', () => {
    const { mean, lower, upper } = csv('male', 95);
    expect(lower).not.toBe(upper);
    const delta = 1;
    const above = calculateWeightForHeightSDS(95, mean + delta, 'male');
    const below = calculateWeightForHeightSDS(95, mean - delta, 'male');
    expect(above.status === 'ok' && above.sds).toBeCloseTo(delta / upper, 12);
    expect(below.status === 'ok' && below.sds).toBeCloseTo(-delta / lower, 12);
    // Immediately on either side of the mean the sign follows the side and the magnitude switches SD.
    const justAbove = calculateWeightForHeightSDS(95, mean + 1e-6, 'male');
    const justBelow = calculateWeightForHeightSDS(95, mean - 1e-6, 'male');
    expect(justAbove.status === 'ok' && justAbove.sds).toBeGreaterThan(0);
    expect(justBelow.status === 'ok' && justBelow.sds).toBeLessThan(0);
  });

  it('does not depend on the age-based tables: the same height, weight and sex always give the same result', () => {
    expect(calculateWeightForHeightSDS(95, 23.33, 'male')).toEqual(calculateWeightForHeightSDS(95, 23.33, 'male'));
  });

  it.each([
    [Number.NaN], [Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY], [0], [-1],
  ])('is not calculable for the invalid weight %s (never converted to a plausible value)', (weight) => {
    expect(calculateWeightForHeightSDS(95, weight, 'male')).toEqual({ status: 'unavailable' });
  });

  it.each([
    [Number.NaN], [Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY], [0], [-1],
  ])('is not calculable for the invalid height %s', (height) => {
    expect(calculateWeightForHeightSDS(height, 20, 'male')).toEqual({ status: 'unavailable' });
    expect(calculateWeightForHeightSDS(height, 20, 'female')).toEqual({ status: 'unavailable' });
  });
});

describe('weightForHeightAtZ (reference defects fail closed)', () => {
  it('uses the upper SD above 0, the lower SD below 0 and the mean at 0', () => {
    const reference = { mean: 20, sdLower: 2, sdUpper: 3 };
    expect(weightForHeightAtZ(0, reference)).toBe(20);
    expect(weightForHeightAtZ(1, reference)).toBe(23);
    expect(weightForHeightAtZ(-1, reference)).toBe(18);
    expect(weightForHeightAtZ(-2.5, reference)).toBe(15);
  });

  it('returns null for a non-finite mean, a non-positive SD on the selected side, or a non-finite z', () => {
    expect(weightForHeightAtZ(1, { mean: Number.NaN, sdLower: 2, sdUpper: 3 })).toBeNull();
    expect(weightForHeightAtZ(1, { mean: 20, sdLower: 2, sdUpper: 0 })).toBeNull();
    expect(weightForHeightAtZ(-1, { mean: 20, sdLower: -2, sdUpper: 3 })).toBeNull();
    expect(weightForHeightAtZ(Number.NaN, { mean: 20, sdLower: 2, sdUpper: 3 })).toBeNull();
    // The unused side may be defective without affecting the other side.
    expect(weightForHeightAtZ(1, { mean: 20, sdLower: 0, sdUpper: 3 })).toBe(23);
  });
});

describe('weight-for-height SD lines', () => {
  it('has one point per adopted integer height: boys 50-140 and girls 50-134, none for girls 135-140', () => {
    for (const z of Z_LEVELS) {
      expect(getWeightForHeightSdLine('male', z).map(p => p.heightCm)).toEqual(Array.from({ length: 91 }, (_, i) => 50 + i));
      expect(getWeightForHeightSdLine('female', z).map(p => p.heightCm)).toEqual(Array.from({ length: 85 }, (_, i) => 50 + i));
    }
  });

  it('puts every line value at mean + z x SD of the source row (upper SD for z > 0, lower SD for z < 0)', () => {
    for (const sexKey of ['male', 'female'] as const) {
      for (const z of Z_LEVELS) {
        for (const p of getWeightForHeightSdLine(sexKey, z)) {
          const { mean, lower, upper } = csv(sexKey, p.heightCm);
          const expected = z === 0 ? mean : mean + z * (z > 0 ? upper : lower);
          expect(p.value).toBeCloseTo(expected, 12);
        }
      }
    }
  });

  it('maps every line value back to its SD score through the SDS calculation', () => {
    for (const sexKey of ['male', 'female'] as const) {
      for (const z of Z_LEVELS) {
        for (const p of getWeightForHeightSdLine(sexKey, z)) {
          const result = calculateWeightForHeightSDS(p.heightCm, p.value, sexKey);
          expect(result.status).toBe('ok');
          if (result.status === 'ok') expect(result.sds).toBeCloseTo(z, 9);
        }
      }
    }
  });

  // Fixed line values at interpolated heights (independent arithmetic from the CSV cells).
  it.each([
    ['male', 95.25, [13.7593491205, 14.6111231825, 15.4628972445, 17.1664453685], [21.99019880675, 25.110404121]],
    ['female', 131.5, [23.9354739, 30.0896436575, 36.243813415, 48.55215293], [73.16883196, 85.477171475]],
  ] as const)('draws the %s %s cm background values -3/-2.5/-2/-1 and +1/+2 SD as published by the source rows', (sexKey, height, lowerValues, upperValues) => {
    const resolution = resolveWeightForHeightReference(height, sexKey);
    if (resolution.status !== 'ok') throw new Error('expected ok');
    [-3, -2.5, -2, -1].forEach((z, i) => expect(weightForHeightAtZ(z, resolution.reference)).toBeCloseTo(lowerValues[i], 9));
    [1, 2].forEach((z, i) => expect(weightForHeightAtZ(z, resolution.reference)).toBeCloseTo(upperValues[i], 9));
  });
});
