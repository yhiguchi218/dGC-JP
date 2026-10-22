/**
 * Independent expectations for src/components/GrowthDashboard.golden.test.tsx.
 * Run: npx tsx scripts/golden-dashboard-independent-check.ts
 * Imports reference data only (no production calculation). Weight SDS is evaluated only at LMS table nodes,
 * where the implemented interpolation returns the node value, so the plain LMS formula is the expectation.
 * Height SDS = (height - mean) / SD from the 附表1 row of the completed month (no interpolation).
 * Obesity coefficients are the implementation coefficients at commit e3ce6e6 (not a source verification).
 */
import { FUHYO_BOYS_HEIGHT, FUHYO_GIRLS_HEIGHT } from '../src/data/fuhyo-growth-data';
import { WEIGHT_BOYS_LMS, WEIGHT_GIRLS_LMS } from '../src/data/growth-data';

const heightSds = (table: [number, number][], month: number, h: number) => {
  const row = table[month];
  return row ? (h - row[0]) / row[1] : null;
};
const weightSdsAtNode = (table: typeof WEIGHT_BOYS_LMS, age: number, w: number) => {
  const p = table.find(r => r.age === age);
  if (!p) return `no node at ${age}`;
  return p.L === 0 ? Math.log(w / p.M) / p.S : (Math.pow(w / p.M, p.L) - 1) / (p.L * p.S);
};

console.log('table sizes', FUHYO_BOYS_HEIGHT.length, FUHYO_GIRLS_HEIGHT.length);

// C1: boy, birth 2010-06-15, measured 2020-06-15 (exactly 10 y, 120 completed months), 140 cm, 40 kg
const h1 = heightSds(FUHYO_BOYS_HEIGHT, 120, 140);
const w1 = weightSdsAtNode(WEIGHT_BOYS_LMS, 10, 40);
const sw1 = -0.000085013 * 140 ** 3 + 0.0370692 * 140 ** 2 - 4.6558 * 140 + 191.847;
const sw1age = 0.752 * 140 - 70.461;
console.log('C1 row120', FUHYO_BOYS_HEIGHT[120], 'heightSDS', h1, 'weightSDS', w1, 'BMI', 40 / 1.4 ** 2);
console.log('C1 height-based std', sw1, 'index', ((40 - sw1) / sw1) * 100, '| age-based std', sw1age, 'index', ((40 - sw1age) / sw1age) * 100);

// C2: girl 210 months (2017-07-15, 17.5 y), 160 cm, 50 kg; 211 months (2017-08-15) height SDS not calculable
console.log('C2 row210', FUHYO_GIRLS_HEIGHT[210], 'heightSDS', heightSds(FUHYO_GIRLS_HEIGHT, 210, 160), 'row211', FUHYO_GIRLS_HEIGHT[211]);
console.log('C2 weightSDS node 17.5', weightSdsAtNode(WEIGHT_GIRLS_LMS, 17.5, 50));

// C3: boy 32w0d, birth 2020-01-01, corrected birth 2020-02-26; month 0 rows use row 0, 2020-03-26 uses row 1
console.log('C3 row0', FUHYO_BOYS_HEIGHT[0], 'SDS(50)', heightSds(FUHYO_BOYS_HEIGHT, 0, 50), 'row1', FUHYO_BOYS_HEIGHT[1], 'SDS(50)', heightSds(FUHYO_BOYS_HEIGHT, 1, 50));
console.log('C3 weightSDS node 0 (3.2 kg)', weightSdsAtNode(WEIGHT_BOYS_LMS, 0, 3.2));

// C4: leap-day birth 2020-02-29 boy 32w0d; 2023-02-28 uses corrected birth 2020-04-25 (34 months); 2023-03-01 actual birth (36 months)
console.log('C4 row34', FUHYO_BOYS_HEIGHT[34], 'SDS(90)', heightSds(FUHYO_BOYS_HEIGHT, 34, 90), 'row36', FUHYO_BOYS_HEIGHT[36], 'SDS(90)', heightSds(FUHYO_BOYS_HEIGHT, 36, 90));
console.log('weight node ages (boys)', WEIGHT_BOYS_LMS.map(r => r.age).filter(a => a === 0 || a === 10 || a === 17.5).join(','));
