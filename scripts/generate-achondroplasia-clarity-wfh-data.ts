/**
 * Generates src/data/achondroplasia-clarity-wfh-data.ts from the original supplementary CSV
 * (Hoover-Fong et al. 2021, Additional file 3 / Table S2, 13023_2021_2141_MOESM3_ESM.csv): weight-for-height.
 *
 * Run: npx tsx scripts/generate-achondroplasia-clarity-wfh-data.ts <path-to-csv> <retrieval-date YYYY-MM-DD>
 *
 * Used columns: sex, ht (cm), wt mean, wt sd lower, wt sd upper. "n" and "htinterval (cm)" are read only to
 * record excluded rows and are not used by the application.
 * Numbers are copied as the CSV text (no re-rounding, no unit change, no manual correction).
 * A row whose mean, lower SD and upper SD are all blank is not adopted and is recorded as excluded.
 * The script fails instead of writing the file when the SHA-256 differs from the expected value, a used cell is
 * partly blank, non-finite or an SD is not positive, a height is duplicated, out of order or has a gap, an
 * excluded row appears before an adopted row, or a sex code is not 0/1. Blank cells are never read as 0.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE_URL = 'https://media.springernature.com/original/springer-static/esm/art%3A10.1186%2Fs13023-021-02141-4/MediaObjects/13023_2021_2141_MOESM3_ESM.csv';
const EXPECTED_SHA256 = '5903d2200360bcd72e6d851c355a9c2b0c428846b23d0bf7d00d56c8d6b2766e';
const OUT = new URL('../src/data/achondroplasia-clarity-wfh-data.ts', import.meta.url);

const [csvPath, retrievalDate] = process.argv.slice(2);
if (!csvPath || !/^\d{4}-\d{2}-\d{2}$/.test(retrievalDate ?? '')) {
  throw new Error('usage: generate-achondroplasia-clarity-wfh-data.ts <csv> <YYYY-MM-DD>');
}

const bytes = readFileSync(csvPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== EXPECTED_SHA256) {
  throw new Error(`SHA-256 mismatch: expected ${EXPECTED_SHA256}, got ${sha256}. Investigate; do not update the expected value silently.`);
}
const text = bytes.toString('utf8');

function parseCsv(t: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

const rows = parseCsv(text);
const header = rows[0].map(h => h.trim());
const col = (name: string): number => {
  const matches = header.flatMap((h, i) => (h === name ? [i] : []));
  if (matches.length !== 1) throw new Error(`column "${name}" found ${matches.length} times`);
  return matches[0];
};
const C = {
  sex: col('Sex (M=0, F = 1)'),
  ht: col('ht (cm)'),
  interval: col('htinterval (cm)'),
  n: col('n'),
  wtMean: col('wt mean'),
  wtSdLower: col('wt sd lower'),
  wtSdUpper: col('wt sd upper'),
};

type SexCode = '0' | '1';
const adopted: Record<SexCode, string[]> = { '0': [], '1': [] };
const excluded: Record<SexCode, string[]> = { '0': [], '1': [] };
const lastHeight: Record<string, number> = { '0': 49, '1': 49 };
for (const r of rows.slice(1)) {
  const sex = r[C.sex].trim();
  if (sex !== '0' && sex !== '1') throw new Error(`unexpected sex code "${sex}"`);
  const heightText = r[C.ht].trim();
  const height = Number(heightText);
  if (heightText === '' || !Number.isInteger(height)) throw new Error(`bad height "${r[C.ht]}"`);
  if (height <= lastHeight[sex]) throw new Error(`heights not strictly ascending for sex ${sex} at ${height}`);
  if (height > lastHeight[sex] + 1) throw new Error(`gap before height ${height} for sex ${sex}`);
  lastHeight[sex] = height;

  const nText = r[C.n].trim();
  if (nText === '' || !Number.isInteger(Number(nText)) || Number(nText) < 0) throw new Error(`bad n "${nText}" at sex ${sex} height ${height}`);
  const texts = [C.wtMean, C.wtSdLower, C.wtSdUpper].map(i => r[i].trim());
  const blanks = texts.filter(t => t === '').length;
  if (blanks === texts.length) {
    // Never convert a blank to 0: the row is excluded and recorded.
    excluded[sex].push(`  [${sex}, ${height}, ${nText}],`);
    continue;
  }
  if (blanks > 0) throw new Error(`partly blank reference cells at sex ${sex} height ${height}`);
  if (excluded[sex].length > 0) throw new Error(`adopted row after an excluded row at sex ${sex} height ${height}`);
  texts.forEach((t, k) => {
    if (!Number.isFinite(Number(t))) throw new Error(`bad value "${t}" at sex ${sex} height ${height} (${k})`);
  });
  if (!(Number(texts[1]) > 0) || !(Number(texts[2]) > 0)) throw new Error(`non-positive SD at sex ${sex} height ${height}`);
  adopted[sex].push(`  [${height}, ${texts.join(', ')}],`);
}
const EXPECTED_ROWS: Record<SexCode, { adopted: number; excluded: number }> = {
  '0': { adopted: 91, excluded: 0 },
  '1': { adopted: 85, excluded: 6 },
};
for (const sex of ['0', '1'] as const) {
  if (adopted[sex].length !== EXPECTED_ROWS[sex].adopted || excluded[sex].length !== EXPECTED_ROWS[sex].excluded) {
    throw new Error(`sex ${sex}: adopted ${adopted[sex].length} / excluded ${excluded[sex].length}, expected ${JSON.stringify(EXPECTED_ROWS[sex])}`);
  }
}

const out = `/**
 * Achondroplasia growth reference (CLARITY, US cohort): weight-for-height, mean and standard deviation by
 * integer height (length) in cm.
 *
 * GENERATED by scripts/generate-achondroplasia-clarity-wfh-data.ts. Do not edit by hand or re-round.
 *
 * Source: Hoover-Fong JE, Schulze KJ, Alade AY, et al. Growth in achondroplasia including stature, weight,
 *   weight-for-height and head circumference from CLARITY: achondroplasia natural history study - a
 *   multi-center retrospective cohort study of achondroplasia in the US.
 *   Orphanet J Rare Dis. 2021;16:522. DOI: 10.1186/s13023-021-02141-4 (CC BY 4.0).
 * File:   Additional file 3 (Table S2), 13023_2021_2141_MOESM3_ESM.csv
 * URL:    ${SOURCE_URL}
 * Retrieved: ${retrievalDate}
 * SHA-256 of the original file: ${sha256}
 *
 * Columns used from the CSV: "Sex (M=0, F = 1)", "ht (cm)", "wt mean", "wt sd lower", "wt sd upper".
 * Not used by the application: "n" (read only to record the excluded rows below) and "htinterval (cm)" (the
 * source labels each row as the interval [h, h+1); the application treats the integer cm as the node height
 * and interpolates linearly between nodes, which is the application's specification, not the source's).
 * Boys: all 91 rows (50-140 cm) are adopted. Girls: rows 50-134 cm (85 rows) are adopted; rows 135-140 cm have
 * blank mean and SDs in the source and are NOT adopted (never read as 0). Non-monotonic means in the source
 * (girls, 131 -> 132 -> 133 -> 134 cm) are kept as published.
 * This is a mean/SD reference. It is not an LMS table and no LMS values are derived from it.
 *
 * Row layout: [heightCm, weightMean (kg), weightSdLower (kg), weightSdUpper (kg)].
 */
export type AchondroplasiaClarityWfhRow = readonly [
  heightCm: number,
  weightMean: number,
  weightSdLower: number,
  weightSdUpper: number,
];

export const ACHONDROPLASIA_CLARITY_WFH_SOURCE = {
  url: '${SOURCE_URL}',
  retrievedOn: '${retrievalDate}',
  sha256: '${sha256}',
} as const;

/** Heights 50 through 140 cm, boys (CSV sex code 0). */
export const ACHONDROPLASIA_CLARITY_WFH_BOYS: ReadonlyArray<AchondroplasiaClarityWfhRow> = [
${adopted['0'].join('\n')}
];

/** Heights 50 through 134 cm, girls (CSV sex code 1). */
export const ACHONDROPLASIA_CLARITY_WFH_GIRLS: ReadonlyArray<AchondroplasiaClarityWfhRow> = [
${adopted['1'].join('\n')}
];

/**
 * Source rows that are not adopted because mean, lower SD and upper SD are blank in the CSV.
 * Row layout: [CSV sex code, heightCm, n in the source]. The n values are kept for source verification only.
 */
export const ACHONDROPLASIA_CLARITY_WFH_EXCLUDED_ROWS: ReadonlyArray<readonly [sex: number, heightCm: number, n: number]> = [
${excluded['0'].concat(excluded['1']).join('\n')}
];
`;
writeFileSync(OUT, out);
console.log(`wrote ${OUT.pathname} (sha256 ${sha256}); adopted rows: boys ${adopted['0'].length}, girls ${adopted['1'].length}; excluded: ${excluded['0'].length + excluded['1'].length}`);
