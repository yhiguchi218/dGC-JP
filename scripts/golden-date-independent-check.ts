/**
 * Independent date / age calculation for src/data/golden-date-cases.ts.
 * Run: npx tsx scripts/golden-date-independent-check.ts           (verify the fixture)
 *      npx tsx scripts/golden-date-independent-check.ts --print   (print computed values for every case)
 *      npx tsx scripts/golden-date-independent-check.ts --probe   (compare month-end rules with date-fns, informational)
 *
 * Uses only integer civil-day arithmetic. It imports no production calculation (growth-utils etc.).
 * Rules (the app's documented policy, restated independently):
 *  - Anniversary of year n = same month/day n years later; Feb 29 falls on Feb 28 in a non-leap year.
 *  - Decimal age = completed years + (days since last anniversary) / (days between last and next anniversary),
 *    rounded half-up to 4 decimals with integer arithmetic (no tie can occur for 365/366-day years).
 *  - Corrected birth date = birth + (280 - (weeks*7 + days)) days, after clamping weeks to 22..44 (days -> 0 when
 *    clamped); not shifted when weeks >= 37 or the deficit is <= 0.
 *  - Corrected age: null before the corrected birth date; chronological age is used when it is above 3.0.
 */
import {
  GOLDEN_DECIMAL_AGE_CASES,
  GOLDEN_CORRECTED_BIRTH_CASES,
  GOLDEN_CORRECTED_AGE_CASES,
  type YMD,
} from '../src/data/golden-date-cases';

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const monthLength = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

// Days since 1970-01-01 (Howard Hinnant's days_from_civil).
function dayNumber([y0, m, d]: YMD): number {
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function fromDayNumber(z0: number): YMD {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}
const anniversary = ([y, m, d]: YMD, n: number): YMD => [y + n, m, Math.min(d, monthLength(y + n, m))];

export function independentAge(birth: YMD, measurement: YMD): { age: number; years: number; days: number; yearLength: number } | null {
  const b = dayNumber(birth);
  const t = dayNumber(measurement);
  if (t < b) return null;
  let years = 0;
  while (dayNumber(anniversary(birth, years + 1)) <= t) years++;
  const last = dayNumber(anniversary(birth, years));
  const yearLength = dayNumber(anniversary(birth, years + 1)) - last;
  const days = t - last;
  const ten4 = Math.floor((2 * 10000 * days + yearLength) / (2 * yearLength)); // round half up of 10000*days/yearLength
  return { age: (years * 10000 + ten4) / 10000, years, days, yearLength };
}

export function independentCorrectedBirth(birth: YMD, weeks: number, days: number): { date: YMD; deficitDays: number } {
  let w = weeks;
  let d = days;
  if (w < 22) { w = 22; d = 0; } else if (w >= 44) { w = 44; d = 0; }
  const deficit = 280 - (w * 7 + d);
  if (w >= 37 || deficit <= 0) return { date: birth, deficitDays: 0 };
  return { date: fromDayNumber(dayNumber(birth) + deficit), deficitDays: deficit };
}

export function independentCorrectedAge(birth: YMD, measurement: YMD, weeks: number, days: number): number | null {
  const chronological = independentAge(birth, measurement);
  if (chronological === null) return null;
  if (chronological.age > 3) return chronological.age;
  const corrected = independentCorrectedBirth(birth, weeks, days);
  if (corrected.deficitDays === 0) return chronological.age;
  return independentAge(corrected.date, measurement)?.age ?? null;
}

const same = (a: YMD, b: YMD) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const fmt = (v: YMD) => `[${v[0]}, ${v[1]}, ${v[2]}]`;
let failures = 0;
const check = (id: string, ok: boolean, detail: string) => {
  if (!ok) { failures++; console.log(`MISMATCH ${id}: ${detail}`); }
};
const printMode = process.argv.includes('--print');

for (const c of GOLDEN_DECIMAL_AGE_CASES) {
  const r = independentAge(c.birth, c.measurement);
  if (printMode) console.log(`${c.id}: age ${r?.age} (years ${r?.years}, ${r?.days}/${r?.yearLength} d)`);
  check(c.id, r?.age === c.expectedAge, `fixture ${c.expectedAge} vs independent ${r?.age}`);
}
for (const c of GOLDEN_CORRECTED_BIRTH_CASES) {
  const r = independentCorrectedBirth(c.birth, c.weeks, c.days);
  if (printMode) console.log(`${c.id}: ${fmt(r.date)} deficit ${r.deficitDays}`);
  check(c.id, same(r.date, c.expectedCorrectedBirth) && r.deficitDays === c.expectedDeficitDays, `fixture ${fmt(c.expectedCorrectedBirth)}/${c.expectedDeficitDays} vs ${fmt(r.date)}/${r.deficitDays}`);
}
for (const c of GOLDEN_CORRECTED_AGE_CASES) {
  const r = independentCorrectedAge(c.birth, c.measurement, c.weeks, c.days);
  if (printMode) console.log(`${c.id}: ${r}`);
  check(c.id, r === c.expectedCorrectedAge, `fixture ${c.expectedCorrectedAge} vs independent ${r}`);
}

if (printMode) {
  // Nearest-to-tie days for the 4-decimal rounding boundary (fraction of 10000*d/yearLength closest to .5).
  for (const yearLength of [365, 366]) {
    const nearest = Array.from({ length: yearLength - 1 }, (_, i) => i + 1)
      .map(d => ({ d, gap: Math.abs((10000 * d) / yearLength - Math.floor((10000 * d) / yearLength) - 0.5) }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 3);
    console.log(`yearLength ${yearLength} nearest-to-tie days:`, nearest.map(n => `${n.d} (gap ${n.gap.toFixed(5)}, ${(10000 * n.d / yearLength).toFixed(5)})`).join('; '));
  }
}

if (process.argv.includes('--probe')) {
  // Informational only: where date-fns differenceInMonths/Years differ from the clamp-to-month-end rule above.
  const { differenceInMonths, differenceInYears } = await import('date-fns');
  const monthsClamp = (b: YMD, t: YMD) => {
    let n = 0;
    const tn = dayNumber(t);
    for (;;) {
      const total = b[1] - 1 + n + 1;
      const annYear = b[0] + Math.floor(total / 12);
      const annMonth = (total % 12) + 1;
      const ann: YMD = [annYear, annMonth, Math.min(b[2], monthLength(annYear, annMonth))];
      if (dayNumber(ann) > tn) return n;
      n++;
    }
  };
  let diffs = 0;
  for (const start of [[2020, 1, 29], [2020, 1, 30], [2020, 1, 31], [2020, 2, 29], [2020, 3, 31], [2020, 5, 31], [2020, 8, 31]] as YMD[]) {
    const s = dayNumber(start);
    for (let k = 0; k <= 800; k++) {
      const t = fromDayNumber(s + k);
      const a = new Date(start[0], start[1] - 1, start[2]);
      const b = new Date(t[0], t[1] - 1, t[2]);
      const m = differenceInMonths(b, a);
      if (m !== monthsClamp(start, t)) {
        diffs++;
        if (diffs <= 12) console.log(`months differ: birth ${fmt(start)} measurement ${fmt(t)} date-fns ${m} clamp ${monthsClamp(start, t)}`);
      }
      const y = differenceInYears(b, a);
      const ind = independentAge(start, t)!.years;
      if (y !== ind) console.log(`years differ: birth ${fmt(start)} measurement ${fmt(t)} date-fns ${y} clamp ${ind}`);
    }
  }
  console.log(`probe: ${diffs} (birth, measurement) pairs where date-fns completed months differ from the clamp rule`);
}

console.log(failures === 0 ? 'OK: all fixture expectations match the independent calculation' : `${failures} mismatch(es)`);
process.exitCode = failures === 0 ? 0 : 1;
