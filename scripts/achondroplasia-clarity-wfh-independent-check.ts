/**
 * Independent check of the CLARITY weight-for-height reference data (Table S2) and SDS arithmetic.
 *
 * Run: npx tsx scripts/achondroplasia-clarity-wfh-independent-check.ts <path-to-original-csv> [--write-fixture]
 *
 * - Parses the original supplementary CSV (Hoover-Fong et al. 2021, Additional file 3 / Table S2) with its own
 *   parser, separate from scripts/generate-achondroplasia-clarity-wfh-data.ts, and does not import any
 *   calculation from src/lib.
 * - Checks CSV structure (sex codes, height order, gaps, duplicates, which rows are blank, positive SDs).
 * - Reconciles every adopted cell of src/data/achondroplasia-clarity-wfh-data.ts with the CSV and checks that
 *   exactly the blank rows are the excluded ones.
 * - With --write-fixture, writes src/data/achondroplasia-clarity-wfh-source-fixture.ts (all CSV rows; blanks as null).
 * - Prints fixed expected values (interpolated mean/SDs, SDS, SD-line values) from plain arithmetic on CSV cells,
 *   using the weighted-average form (v0*(h1-h) + v1*(h-h0)) / (h1-h0). They are pasted into the unit tests.
 *   Nothing here is tuned to production output.
 *
 * Exit code 1 when any reconciliation or structure check fails.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  ACHONDROPLASIA_CLARITY_WFH_BOYS,
  ACHONDROPLASIA_CLARITY_WFH_EXCLUDED_ROWS,
  ACHONDROPLASIA_CLARITY_WFH_GIRLS,
  ACHONDROPLASIA_CLARITY_WFH_SOURCE,
} from '../src/data/achondroplasia-clarity-wfh-data';

const csvPath = process.argv[2];
const writeFixture = process.argv.includes('--write-fixture');
if (!csvPath) throw new Error('usage: achondroplasia-clarity-wfh-independent-check.ts <csv> [--write-fixture]');

const bytes = readFileSync(csvPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const text = bytes.toString('utf8');

// Minimal CSV reader: quoted fields may contain commas (the "[50,51)" interval column).
const records: string[][] = text.split(/\r?\n/).filter(l => l.trim().length > 0).map(line => {
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
  sex: idx('Sex (M=0, F = 1)'), ht: idx('ht (cm)'), interval: idx('htinterval (cm)'), n: idx('n'),
  mean: idx('wt mean'), lower: idx('wt sd lower'), upper: idx('wt sd upper'),
};

interface SourceRow { sex: number; ht: number; interval: string; n: number; mean: number | null; lower: number | null; upper: number | null }
const failures: string[] = [];
const fail = (msg: string) => { failures.push(msg); };

const num = (t: string): number | null => (t.trim() === '' ? null : Number(t.trim()));
const csvRows: SourceRow[] = records.slice(1).map(r => ({
  sex: Number(r[C.sex].trim()),
  ht: Number(r[C.ht].trim()),
  interval: r[C.interval].trim(),
  n: Number(r[C.n].trim()),
  mean: num(r[C.mean]),
  lower: num(r[C.lower]),
  upper: num(r[C.upper]),
}));

// 1. CSV structure.
const bySex: Record<0 | 1, SourceRow[]> = { 0: [], 1: [] };
for (const row of csvRows) {
  if (row.sex !== 0 && row.sex !== 1) { fail(`unexpected sex code ${row.sex}`); continue; }
  if (!Number.isFinite(row.ht) || !Number.isFinite(row.n)) fail(`non-numeric height or n at sex ${row.sex}`);
  if (row.interval !== `[${row.ht},${row.ht + 1})`) fail(`sex ${row.sex} height ${row.ht}: unexpected interval ${row.interval}`);
  bySex[row.sex].push(row);
}
const blankHeights: Record<0 | 1, number[]> = { 0: [], 1: [] };
for (const sex of [0, 1] as const) {
  const rows = bySex[sex];
  rows.forEach((row, i) => {
    if (row.ht !== 50 + i) fail(`sex ${sex}: expected height ${50 + i} at position ${i}, got ${row.ht} (gap, duplicate or disorder)`);
    const blanks = [row.mean, row.lower, row.upper].filter(v => v === null).length;
    if (blanks === 3) blankHeights[sex].push(row.ht);
    else if (blanks > 0) fail(`sex ${sex} height ${row.ht}: partly blank reference cells`);
    else if (!Number.isFinite(row.mean) || !((row.lower as number) > 0) || !((row.upper as number) > 0)) fail(`sex ${sex} height ${row.ht}: non-finite mean or non-positive SD`);
  });
  console.log(`sex ${sex}: ${rows.length} rows, heights ${rows[0]?.ht}..${rows[rows.length - 1]?.ht}, blank-reference heights: ${blankHeights[sex].join(',') || 'none'}`);
}

// 2. Production data module vs CSV.
if (ACHONDROPLASIA_CLARITY_WFH_SOURCE.sha256 !== sha256) fail(`sha256 mismatch: data module ${ACHONDROPLASIA_CLARITY_WFH_SOURCE.sha256} vs csv ${sha256}`);
let cellsCompared = 0;
for (const [sex, table] of [[0, ACHONDROPLASIA_CLARITY_WFH_BOYS], [1, ACHONDROPLASIA_CLARITY_WFH_GIRLS]] as const) {
  const expectedAdopted = bySex[sex].filter(r => !blankHeights[sex].includes(r.ht));
  if (table.length !== expectedAdopted.length) fail(`sex ${sex}: production rows ${table.length}, CSV non-blank rows ${expectedAdopted.length}`);
  table.forEach(prod => {
    const src = bySex[sex].find(r => r.ht === prod[0]);
    if (!src) { fail(`sex ${sex}: no CSV row for height ${prod[0]}`); return; }
    const srcCells = [src.ht, src.mean, src.lower, src.upper];
    for (let k = 0; k < 4; k++) {
      cellsCompared++;
      if (prod[k] !== srcCells[k]) fail(`sex ${sex} height ${prod[0]} column ${k}: production ${prod[k]} vs csv ${srcCells[k]}`);
    }
  });
}
const excludedFromCsv = ([0, 1] as const).flatMap(sex => blankHeights[sex].map(h => {
  const row = bySex[sex].find(r => r.ht === h)!;
  return [sex, h, row.n];
}));
if (JSON.stringify(excludedFromCsv) !== JSON.stringify(ACHONDROPLASIA_CLARITY_WFH_EXCLUDED_ROWS)) {
  fail(`excluded rows differ: production ${JSON.stringify(ACHONDROPLASIA_CLARITY_WFH_EXCLUDED_ROWS)} vs csv ${JSON.stringify(excludedFromCsv)}`);
}
console.log(`reconciled ${cellsCompared} production cells against the CSV (sha256 ${sha256}); excluded rows (sex, ht, n): ${JSON.stringify(excludedFromCsv)}`);

// 3. Optional fixture of all original rows (blank cells as null).
if (writeFixture) {
  const cell = (v: number | null) => (v === null ? 'null' : String(v));
  const body = csvRows.map(r => `  [${r.sex}, ${r.ht}, '${r.interval}', ${r.n}, ${cell(r.mean)}, ${cell(r.lower)}, ${cell(r.upper)}],`).join('\n');
  const out = `/**
 * Source fixture: the used columns of the original CLARITY supplementary CSV (Hoover-Fong et al. 2021,
 * Table S2, 13023_2021_2141_MOESM3_ESM.csv; CC BY 4.0 article), all ${csvRows.length} rows (50-140 cm per sex).
 *
 * GENERATED by scripts/achondroplasia-clarity-wfh-independent-check.ts from the original file
 * (SHA-256 ${sha256}). Do not edit by hand.
 * It exists so tests can compare src/data/achondroplasia-clarity-wfh-data.ts with the source rather than with itself.
 * Blank source cells are null (never 0).
 *
 * Row layout: [sex (M=0, F=1), ht (cm), htinterval, n, wt mean, wt sd lower, wt sd upper].
 */
export const ACHONDROPLASIA_CLARITY_WFH_CSV_SHA256 = '${sha256}';

export const ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS: ReadonlyArray<
  readonly [sex: number, ht: number, htInterval: string, n: number, wtMean: number | null, wtSdLower: number | null, wtSdUpper: number | null]
> = [
${body}
];
`;
  writeFileSync(new URL('../src/data/achondroplasia-clarity-wfh-source-fixture.ts', import.meta.url), out);
  console.log('wrote src/data/achondroplasia-clarity-wfh-source-fixture.ts');
}

// 4. Fixed expected values from plain arithmetic on CSV cells (weighted-average form of the linear interpolation).
const sig = (v: number) => Number(v.toPrecision(15));
const interp = (sex: 0 | 1, h: number) => {
  const h0 = Math.floor(h);
  const a = bySex[sex].find(r => r.ht === h0)!;
  if (h === h0) return { mean: a.mean as number, lower: a.lower as number, upper: a.upper as number };
  const b = bySex[sex].find(r => r.ht === h0 + 1)!;
  const w = (x: number | null, y: number | null) => ((x as number) * (h0 + 1 - h) + (y as number) * (h - h0));
  return { mean: w(a.mean, b.mean), lower: w(a.lower, b.lower), upper: w(a.upper, b.upper) };
};
const picks: Array<[0 | 1, number]> = [
  [0, 50], [0, 75.5], [0, 95], [0, 95.25], [0, 139.5], [0, 140],
  [1, 50], [1, 100.5], [1, 131.5], [1, 132.5], [1, 133.5], [1, 134],
];
console.log('\n// sex height | interpolated mean, lower, upper | weights and SDS (independent arithmetic)');
for (const [sex, h] of picks) {
  const { mean, lower, upper } = interp(sex, h);
  const wBelow = Math.round((mean - 0.5 * lower) * 100) / 100;
  const wAbove = Math.round((mean + 1.5 * upper) * 100) / 100;
  console.log(`${sex === 0 ? 'male' : 'female'} height ${h}: mean=${sig(mean)} lower=${sig(lower)} upper=${sig(upper)}`);
  console.log(`  weight ${wBelow} (below mean) -> ${sig((wBelow - mean) / lower)}`);
  console.log(`  weight ${wAbove} (above mean) -> ${sig((wAbove - mean) / upper)}`);
  console.log(`  lines -3/-2.5/-2/-1 (lower) = ${[-3, -2.5, -2, -1].map(z => sig(mean + z * lower)).join(', ')}; +1/+2 (upper) = ${[1, 2].map(z => sig(mean + z * upper)).join(', ')}`);
}

// 5. Value range of all SD lines (-3 ... +2) over the valid nodes, for choosing the fixed chart axes.
console.log('\n// SD-line range over valid nodes (z = -3 ... +2)');
for (const sex of [0, 1] as const) {
  const rows = bySex[sex].filter(r => !blankHeights[sex].includes(r.ht));
  const vals = rows.flatMap(r => [-3, -2.5, -2, -1, 0, 1, 2].map(z => (z === 0 ? r.mean : (r.mean as number) + z * ((z > 0 ? r.upper : r.lower) as number)) as number));
  console.log(`${sex === 0 ? 'male' : 'female'}: min ${Math.min(...vals)} max ${Math.max(...vals)}; mean max ${Math.max(...rows.map(r => r.mean as number))} at ${rows.find(r => r.mean === Math.max(...rows.map(x => x.mean as number)))?.ht} cm`);
}

if (failures.length > 0) {
  console.error(`\nFAILED (${failures.length}):`);
  failures.slice(0, 20).forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log('\nOK: CSV structure and production-data reconciliation passed.');
