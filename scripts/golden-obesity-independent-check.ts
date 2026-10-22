/**
 * Independent calculation of standard weight and obesity index (肥満度) for src/data/golden-obesity-cases.ts.
 * Run: npx tsx scripts/golden-obesity-independent-check.ts           (verify the fixture)
 *      npx tsx scripts/golden-obesity-independent-check.ts --emit    (print the fixture's case list as TypeScript)
 *
 * It imports no production calculation. The coefficients below are a transcription of the coefficients
 * implemented in src/lib/growth-utils.ts at the time of writing. The repository holds no source table for them:
 * their agreement with the original publication was confirmed by the maintainer (not by this script or by the
 * AI), so this is a check of the calculation path against the implemented coefficients, not a source check.
 * Applicability (age / height ranges) is likewise taken from the implemented ranges.
 *
 * Standard weight is evaluated in Horner form; obesity index = (weight - standard) / standard * 100.
 */
import { GOLDEN_OBESITY_CASES, type GoldenObesityCase } from '../src/data/golden-obesity-cases';

type Sex = 'male' | 'female';
type Poly = { min: number; max: number; coef: number[] }; // coef: highest power first; min <= height < max

const INFANT: Record<Sex, Poly> = {
  male: { min: 70, max: 120, coef: [0.00206, -0.1166, 6.5273] },
  female: { min: 70, max: 120, coef: [0.00249, -0.1858, 9.036] },
};
const SCHOOL: Record<Sex, Poly[]> = {
  male: [
    { min: 101, max: 140, coef: [0.0000303882, -0.00571495, 0.508124, -9.17791] },
    { min: 140, max: 149, coef: [-0.000085013, 0.0370692, -4.6558, 191.847] },
    { min: 149, max: 184, coef: [-0.000310205, 0.151159, -23.6303, 1231.04] },
  ],
  female: [
    { min: 101, max: 140, coef: [0.000127719, -0.0414712, 4.8575, -184.492] },
    { min: 140, max: 149, coef: [-0.00178766, 0.803922, -119.31, 5885.03] },
    { min: 149, max: 171, coef: [0.000956401, -0.462755, 75.3058, -4068.31] },
  ],
};
// Age-specific: standard weight = a * height - b, applied for floor(age) 5..17.
const AGE_AB: Record<Sex, Record<number, [number, number]>> = {
  male: { 5: [0.386, 23.699], 6: [0.461, 32.382], 7: [0.513, 38.878], 8: [0.592, 48.804], 9: [0.687, 61.39], 10: [0.752, 70.461], 11: [0.782, 75.106], 12: [0.783, 75.642], 13: [0.815, 81.348], 14: [0.832, 83.695], 15: [0.766, 70.989], 16: [0.656, 51.822], 17: [0.672, 53.642] },
  female: { 5: [0.377, 22.75], 6: [0.458, 32.079], 7: [0.508, 38.367], 8: [0.561, 45.006], 9: [0.652, 56.992], 10: [0.73, 68.091], 11: [0.803, 78.846], 12: [0.796, 76.934], 13: [0.655, 54.234], 14: [0.594, 43.264], 15: [0.56, 37.002], 16: [0.578, 39.057], 17: [0.598, 42.339] },
};

const horner = (coef: number[], x: number) => coef.reduce((acc, c) => acc * x + c, 0);

export function independentStandardWeight(method: 'height' | 'age', sex: Sex, height: number, age: number): number | null {
  if (method === 'age') {
    const a = Math.floor(age);
    if (a < 5 || a > 17) return null;
    const [slope, offset] = AGE_AB[sex][a];
    return slope * height - offset;
  }
  const polys = age < 6 ? [INFANT[sex]] : SCHOOL[sex];
  const hit = polys.find(p => height >= p.min && height < p.max);
  return hit ? horner(hit.coef, height) : null;
}

export function independentObesityIndex(weight: number, standard: number | null): number | null {
  if (standard === null || !(standard > 0)) return null;
  return ((weight - standard) / standard) * 100;
}

const compute = (c: Pick<GoldenObesityCase, 'method' | 'sex' | 'height' | 'age' | 'weight'>) => {
  const standard = independentStandardWeight(c.method, c.sex, c.height, c.age);
  return { standard, index: independentObesityIndex(c.weight, standard) };
};
const num = (v: number | null) => (v === null ? 'null' : Number(v.toFixed(10)).toString());

if (process.argv.includes('--emit')) {
  type Seed = Omit<GoldenObesityCase, 'expectedStandardWeight' | 'expectedIndex'>;
  const seeds: Seed[] = [];
  const add = (id: string, method: 'height' | 'age', sex: Sex, height: number, age: number, weight: number, basis: string) =>
    seeds.push({ id, method, sex, height, age, weight, basis });

  // Hand-checkable infant values: 0.00206*100^2 - 0.1166*100 + 6.5273 = 20.6 - 11.66 + 6.5273 = 15.4673 (boys);
  // 0.00249*100^2 - 0.1858*100 + 9.036 = 24.9 - 18.58 + 9.036 = 15.356 (girls).
  add('height-specific infant boys 100 cm: 18 kg', 'height', 'male', 100, 4, 18, 'infant polynomial; standard 20.6 - 11.66 + 6.5273 = 15.4673');
  add('height-specific infant boys 100 cm: 12 kg (negative index)', 'height', 'male', 100, 4, 12, 'infant polynomial; standard 15.4673');
  add('height-specific infant girls 100 cm: 15.356 kg (index 0)', 'height', 'female', 100, 4, 15.356, 'infant polynomial; standard 24.9 - 18.58 + 9.036 = 15.356');
  add('height-specific infant girls 100 cm: 20 kg', 'height', 'female', 100, 4, 20, 'infant polynomial; standard 15.356');
  for (const sex of ['male', 'female'] as const) {
    const s = sex === 'male' ? 'boys' : 'girls';
    add(`infant range start ${s} 70 cm (inclusive)`, 'height', sex, 70, 1, 8, 'height >= 70 uses the infant polynomial');
    add(`infant range below start ${s} 69.9 cm`, 'height', sex, 69.9, 1, 8, 'height < 70: no standard weight');
    add(`infant range end ${s} 119.9 cm`, 'height', sex, 119.9, 5, 22, 'height < 120 uses the infant polynomial');
    add(`infant range end ${s} 120 cm (age < 6)`, 'height', sex, 120, 5, 22, 'height >= 120 at age < 6: no standard weight');
    add(`age 5.9999 ${s} 110 cm uses the infant polynomial`, 'height', sex, 110, 5.9999, 19, 'age < 6 -> infant');
    add(`age 6.0 ${s} 110 cm uses the school polynomial`, 'height', sex, 110, 6, 19, 'age >= 6 -> school segment 101-140');
    add(`age 5.9999 ${s} 125 cm has no standard weight`, 'height', sex, 125, 5.9999, 25, 'infant range ends at 120');
    add(`age 6.0 ${s} 125 cm has a school standard weight`, 'height', sex, 125, 6, 25, 'school segment 101-140');
    add(`school range below start ${s} 100.9 cm`, 'height', sex, 100.9, 6, 17, 'height < 101 at age >= 6: no standard weight');
    add(`school segment 1 start ${s} 101 cm`, 'height', sex, 101, 6, 17, 'segment 101-140 (inclusive start)');
    add(`school segment 1 end ${s} 139.9 cm`, 'height', sex, 139.9, 10, 35, 'segment 101-140');
    add(`school segment 2 start ${s} 140 cm`, 'height', sex, 140, 10, 35, 'segment 140-149 (inclusive start)');
    add(`school segment 2 end ${s} 148.9 cm`, 'height', sex, 148.9, 12, 40, 'segment 140-149');
    add(`school segment 3 start ${s} 149 cm`, 'height', sex, 149, 12, 40, 'segment 149-upper (inclusive start)');
  }
  add('school segment 3 boys 170 cm', 'height', 'male', 170, 15, 60, 'boys segment 149-184');
  add('school segment 3 boys end 183.9 cm', 'height', 'male', 183.9, 17, 70, 'boys segment 149-184');
  add('school range end boys 184 cm', 'height', 'male', 184, 17, 70, 'boys: height >= 184: no standard weight');
  add('school segment 3 girls 160 cm', 'height', 'female', 160, 14, 50, 'girls segment 149-171');
  add('school segment 3 girls end 170.9 cm', 'height', 'female', 170.9, 17, 58, 'girls segment 149-171');
  add('school range end girls 171 cm', 'height', 'female', 171, 17, 58, 'girls: height >= 171: no standard weight');
  add('girls 175 cm has no standard weight although boys 175 cm has one', 'height', 'female', 175, 17, 58, 'girls range ends at 171');
  add('boys 175 cm', 'height', 'male', 175, 17, 65, 'boys segment 149-184');

  // Hand-checkable age-specific value: boys 10 y: 0.752 * 140 - 70.461 = 105.28 - 70.461 = 34.819.
  add('age-specific boys 10 y 140 cm: 40 kg', 'age', 'male', 140, 10, 40, 'a=0.752, b=70.461: 34.819');
  add('age-specific girls 10 y 140 cm: 35 kg', 'age', 'female', 140, 10, 35, 'a=0.730, b=68.091: 34.109');
  for (const sex of ['male', 'female'] as const) {
    const s = sex === 'male' ? 'boys' : 'girls';
    add(`age-specific ${s} age 4.9999 (below 5)`, 'age', sex, 110, 4.9999, 20, 'floor(age) < 5: not applicable');
    add(`age-specific ${s} age 5.0`, 'age', sex, 110, 5, 20, 'floor 5: first row');
    add(`age-specific ${s} age 5.9999 (row 5)`, 'age', sex, 120, 5.9999, 22, 'floor 5');
    add(`age-specific ${s} age 6.0 (row 6)`, 'age', sex, 120, 6, 22, 'floor 6: the row changes at the integer age');
    add(`age-specific ${s} age 17.9999 (row 17)`, 'age', sex, 165, 17.9999, 55, 'floor 17: last row');
    add(`age-specific ${s} age 18.0 (not applicable)`, 'age', sex, 165, 18, 55, 'floor 18 > 17: not applicable');
    for (let a = 5; a <= 17; a++) {
      add(`age-specific ${s} row ${a}: 150 cm`, 'age', sex, 150, a + 0.5, 50, `standard weight = a * 150 - b (row ${a})`);
      add(`age-specific ${s} row ${a}: 130 cm`, 'age', sex, 130, a + 0.5, 40, `standard weight = a * 130 - b (row ${a}); with the 150 cm row this pins a and b`);
    }
  }

  console.log('export const GOLDEN_OBESITY_CASES: GoldenObesityCase[] = [');
  for (const s of seeds) {
    const r = compute(s);
    console.log(`  { id: ${JSON.stringify(s.id)}, method: '${s.method}', sex: '${s.sex}', height: ${s.height}, age: ${s.age}, weight: ${s.weight}, expectedStandardWeight: ${num(r.standard)}, expectedIndex: ${num(r.index)}, basis: ${JSON.stringify(s.basis)} },`);
  }
  console.log('];');
} else {
  let failures = 0;
  for (const c of GOLDEN_OBESITY_CASES) {
    const r = compute(c);
    const near = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-9);
    if (!near(r.standard, c.expectedStandardWeight) || !near(r.index, c.expectedIndex)) {
      failures++;
      console.log(`MISMATCH ${c.id}: fixture ${c.expectedStandardWeight}/${c.expectedIndex} vs independent ${r.standard}/${r.index}`);
    }
  }
  console.log(failures === 0 ? `OK: ${GOLDEN_OBESITY_CASES.length} fixture cases match the independent calculation` : `${failures} mismatch(es)`);
  process.exitCode = failures === 0 ? 0 : 1;
}
