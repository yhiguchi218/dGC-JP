/**
 * Independent check of the CLARITY achondroplasia reference data and SDS arithmetic.
 *
 * Run: npx tsx scripts/achondroplasia-clarity-independent-check.ts <path-to-original-csv> [--write-fixture]
 *
 * - Parses the original supplementary CSV (Hoover-Fong et al. 2021, Table S1) with its own parser, separate
 *   from scripts/generate-achondroplasia-clarity-data.ts, and does not import any calculation from src/lib.
 * - Checks CSV structure (sex codes, month order, gaps, duplicates, finiteness, positive SD columns).
 * - Reconciles every used cell of src/data/achondroplasia-clarity-data.ts with the CSV (months 0-216).
 * - With --write-fixture, writes src/data/achondroplasia-clarity-source-fixture.ts (all CSV rows, used columns).
 * - Prints fixed expected SDS values from plain arithmetic on CSV cells; they are pasted into
 *   src/lib/achondroplasia-growth.test.ts. Nothing here is tuned to production output.
 *
 * Exit code 1 when any reconciliation or structure check fails.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  ACHONDROPLASIA_CLARITY_BOYS,
  ACHONDROPLASIA_CLARITY_GIRLS,
  ACHONDROPLASIA_CLARITY_SOURCE,
} from '../src/data/achondroplasia-clarity-data';

const csvPath = process.argv[2];
const writeFixture = process.argv.includes('--write-fixture');
if (!csvPath) throw new Error('usage: achondroplasia-clarity-independent-check.ts <csv> [--write-fixture]');

const bytes = readFileSync(csvPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const text = bytes.toString('utf8');

// Minimal CSV reader: quoted fields may contain commas (the "[0,1)" interval column).
const records: string[][] = text.split(/\r?\n/).filter(l => l.length > 0).map(line => {
  const cells: string[] = [];
  let cur = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ',' && !inQuote) { cells.push(cur); cur = ''; } else cur += ch;
  }
  cells.push(cur);
  return cells;
});

const header = records[0].map(h => h.trim());
const idx = (name: string): number => {
  const hits = header.map((h, i) => (h === name ? i : -1)).filter(i => i >= 0);
  if (hits.length !== 1) throw new Error(`column "${name}" found ${hits.length} times`);
  return hits[0];
};
const C = {
  sex: idx('Sex (M=0, F = 1)'), month: idx('age (months)'), htMean: idx('ht mean'), htSd: idx('htsd'),
  wtMean: idx('wt_mean'), wtLower: idx('wt sd lower'), wtUpper: idx('wt sd upper'),
};

type Cells = [sex: 0 | 1, month: number, htMean: number, htSd: number, wtMean: number, wtLower: number, wtUpper: number];
const failures: string[] = [];
const fail = (msg: string) => { failures.push(msg); };

const csvRows: Cells[] = [];
for (const r of records.slice(1)) {
  const nums = [C.sex, C.month, C.htMean, C.htSd, C.wtMean, C.wtLower, C.wtUpper].map(i => (r[i] ?? '').trim());
  if (nums.some(t => t === '' || !Number.isFinite(Number(t)))) { fail(`empty or non-finite used cell in row ${JSON.stringify(r.slice(0, 3))}`); continue; }
  csvRows.push(nums.map(Number) as Cells);
}

// 1. CSV structure.
const bySex: Record<0 | 1, Cells[]> = { 0: [], 1: [] };
for (const row of csvRows) {
  if (row[0] !== 0 && row[0] !== 1) { fail(`unexpected sex code ${row[0]}`); continue; }
  bySex[row[0]].push(row);
}
for (const sex of [0, 1] as const) {
  const rows = bySex[sex];
  rows.forEach((row, i) => {
    if (row[1] !== i) fail(`sex ${sex}: expected month ${i} at position ${i}, got ${row[1]} (gap, duplicate or disorder)`);
    if (!(row[3] > 0) || !(row[5] > 0) || !(row[6] > 0)) fail(`sex ${sex} month ${row[1]}: non-positive SD`);
  });
  console.log(`sex ${sex}: ${rows.length} rows, months ${rows[0]?.[1]}..${rows[rows.length - 1]?.[1]}`);
}

// 2. Production data module vs CSV (months 0-216).
if (ACHONDROPLASIA_CLARITY_SOURCE.sha256 !== sha256) fail(`sha256 mismatch: data module ${ACHONDROPLASIA_CLARITY_SOURCE.sha256} vs csv ${sha256}`);
let cellsCompared = 0;
for (const [sex, table] of [[0, ACHONDROPLASIA_CLARITY_BOYS], [1, ACHONDROPLASIA_CLARITY_GIRLS]] as const) {
  if (table.length !== 217) fail(`sex ${sex}: production rows ${table.length}, expected 217`);
  table.forEach(prod => {
    const src = bySex[sex][prod[0]];
    if (!src) { fail(`sex ${sex}: no CSV row for month ${prod[0]}`); return; }
    for (let k = 1; k <= 5; k++) {
      cellsCompared++;
      if (prod[k] !== src[k + 1]) fail(`sex ${sex} month ${prod[0]} column ${k}: production ${prod[k]} vs csv ${src[k + 1]}`);
    }
  });
}
console.log(`reconciled ${cellsCompared} production cells against the CSV (sha256 ${sha256})`);

// 3. Optional fixture of the original rows (months 0-239) for the unit tests.
if (writeFixture) {
  const body = csvRows.map(r => `  [${r.join(', ')}],`).join('\n');
  const out = `/**
 * Source fixture: the used columns of the original CLARITY supplementary CSV (Hoover-Fong et al. 2021,
 * Table S1, 13023_2021_2141_MOESM2_ESM.csv; CC BY 4.0 article), all ${csvRows.length} rows (months 0-239).
 *
 * GENERATED by scripts/achondroplasia-clarity-independent-check.ts from the original file
 * (SHA-256 ${sha256}). Do not edit by hand.
 * It exists so tests can compare src/data/achondroplasia-clarity-data.ts with the source rather than with itself.
 *
 * Row layout: [sex (M=0, F=1), month, ht mean, htsd, wt_mean, wt sd lower, wt sd upper].
 */
export const ACHONDROPLASIA_CLARITY_CSV_SHA256 = '${sha256}';

export const ACHONDROPLASIA_CLARITY_CSV_ROWS: ReadonlyArray<
  readonly [sex: number, month: number, htMean: number, htSd: number, wtMean: number, wtSdLower: number, wtSdUpper: number]
> = [
${body}
];
`;
  writeFileSync(new URL('../src/data/achondroplasia-clarity-source-fixture.ts', import.meta.url), out);
  console.log('wrote src/data/achondroplasia-clarity-source-fixture.ts');
}

// 4. Fixed expected values from plain arithmetic on CSV cells.
const sig = (v: number) => Number(v.toPrecision(15));
const picks: Array<[0 | 1, number]> = [[0, 0], [0, 12], [0, 216], [1, 0], [1, 60], [1, 216]];
console.log('\n// sex month | height mean, htsd | wt mean, lower, upper | derived SDS (independent arithmetic)');
for (const [sex, month] of picks) {
  const r = bySex[sex][month];
  const [, , htMean, htSd, wtMean, wtLower, wtUpper] = r;
  const hSample = Math.round(htMean * 100) / 100 + 10; // arbitrary measurement above the mean
  const wBelow = Math.round((wtMean - 0.5 * wtLower) * 100) / 100;
  const wAbove = Math.round((wtMean + 1.5 * wtUpper) * 100) / 100;
  console.log(`${sex === 0 ? 'male' : 'female'} month ${month}: htMean=${htMean} htSd=${htSd} wtMean=${wtMean} wtLower=${wtLower} wtUpper=${wtUpper}`);
  console.log(`  height ${hSample} -> ${sig((hSample - htMean) / htSd)}`);
  console.log(`  weight ${wBelow} (below mean) -> ${sig((wBelow - wtMean) / wtLower)}`);
  console.log(`  weight ${wAbove} (above mean) -> ${sig((wAbove - wtMean) / wtUpper)}`);
  console.log(`  lines: height -3/-2.5/-2/-1/+1/+2 = ${[-3, -2.5, -2, -1, 1, 2].map(z => sig(htMean + z * htSd)).join(', ')}`);
  console.log(`  lines: weight -3/-2.5/-2/-1 (lower) = ${[-3, -2.5, -2, -1].map(z => sig(wtMean + z * wtLower)).join(', ')}; +1/+2 (upper) = ${[1, 2].map(z => sig(wtMean + z * wtUpper)).join(', ')}`);
}

if (failures.length > 0) {
  console.error(`\nFAILED (${failures.length}):`);
  failures.slice(0, 20).forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log('\nOK: CSV structure and production-data reconciliation passed.');
