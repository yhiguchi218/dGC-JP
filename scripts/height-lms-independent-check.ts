/**
 * Independent calculation for the Isojima 2016 height LMS change.
 * Run: npx tsx scripts/height-lms-independent-check.ts
 *
 * Uses only the Table 2 transcription fixture and 附表1 data. It does not import growth-utils or
 * growth-data, so results are not copied from production functions. Prints fixed expected values
 * (used in src/lib/height-background-lms.test.ts) and writes docs/height-lms-fuhyo1-comparison.md.
 * The comparison is a description of the gap between two references; nothing here tunes or
 * converts one reference to the other.
 */
import { writeFileSync } from 'node:fs';
import { ISOJIMA_2016_TABLE2_HEIGHT_ROWS as ROWS } from '../src/data/isojima-height-lms-source-fixture';
import { FUHYO_BOYS_HEIGHT, FUHYO_GIRLS_HEIGHT } from '../src/data/fuhyo-growth-data';

type Lms = { age: number; L: number; M: number; S: number };
const table = (sex: 'male' | 'female'): Lms[] =>
  ROWS.map(r => (sex === 'male'
    ? { age: r[0], L: r[1], M: r[2], S: r[3] }
    : { age: r[0], L: r[4], M: r[5], S: r[6] }));

const inverse = (z: number, { L, M, S }: Lms): number =>
  L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
const toZ = (y: number, { L, M, S }: Lms): number =>
  L === 0 ? Math.log(y / M) / S : (Math.pow(y / M, L) - 1) / (L * S);

// Catmull-Rom between table rows, as the app does between table ages (end segments reuse the end row).
const catmull = (t: number, p0: number, p1: number, p2: number, p3: number): number =>
  0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
function lmsAt(age: number, t: Lms[]): { lms: Lms; onTable: boolean } {
  const exact = t.find(p => p.age === age);
  if (exact) return { lms: exact, onTable: true };
  let i = 0;
  while (i < t.length - 2 && age > t[i + 1].age) i++;
  const [p0, p1, p2, p3] = [t[Math.max(0, i - 1)], t[i], t[i + 1], t[Math.min(t.length - 1, i + 2)]];
  const u = (age - p1.age) / (p2.age - p1.age);
  return {
    onTable: false,
    lms: {
      age,
      L: catmull(u, p0.L, p1.L, p2.L, p3.L),
      M: catmull(u, p0.M, p1.M, p2.M, p3.M),
      S: catmull(u, p0.S, p1.S, p2.S, p3.S),
    },
  };
}

// 1. Fixed expected values at representative table ages.
const zs = [-3, -2.5, -2, -1, 0, 1, 2];
const reps: Array<['male' | 'female', number]> = [
  ['male', 0], ['male', 5.5], ['male', 11], ['male', 14], ['male', 15], ['male', 17.5],
  ['female', 0], ['female', 8], ['female', 12], ['female', 17.5],
];
console.log('// sex, age, z -> height (independent calculation from Table 2 values)');
for (const [sex, age] of reps) {
  const p = table(sex).find(r => r.age === age)!;
  console.log(`${sex} ${age} L=${p.L} M=${p.M} S=${p.S}`);
  console.log('  ' + zs.map(z => `${z}: ${inverse(z, p).toPrecision(12)}`).join(', '));
}

// 2. Comparison with 附表1 (completed months 0-210, age = month / 12).
type Row = { sex: string; month: number; level: string; height: number; sds: number; onTable: boolean };
const all: Row[] = [];
for (const sex of ['male', 'female'] as const) {
  const fuhyo = sex === 'male' ? FUHYO_BOYS_HEIGHT : FUHYO_GIRLS_HEIGHT;
  const t = table(sex);
  for (let month = 0; month <= 210; month++) {
    const [mean, sd] = fuhyo[month];
    const { lms, onTable } = lmsAt(month / 12, t);
    for (const [level, k] of [['-2SD', -2], ['平均', 0], ['+2SD', 2]] as const) {
      const height = mean + k * sd;
      all.push({ sex, month, level, height, sds: toZ(height, lms), onTable });
    }
  }
}
const absMax = (rows: Row[]) => rows.reduce((a, r) => (Math.abs(r.sds - ({ '-2SD': -2, '平均': 0, '+2SD': 2 }[r.level] as number)) >
  Math.abs(a.sds - ({ '-2SD': -2, '平均': 0, '+2SD': 2 }[a.level] as number)) ? r : a));
const dev = (r: Row) => r.sds - ({ '-2SD': -2, '平均': 0, '+2SD': 2 }[r.level] as number);
const fmt = (r: Row) => `${r.sex === 'male' ? '男子' : '女子'} ${r.month}か月 (${(r.month / 12).toFixed(3)}歳) ${r.level} 身長${r.height.toFixed(1)}cm → LMS ${r.sds.toFixed(3)}SD (差 ${dev(r) >= 0 ? '+' : ''}${dev(r).toFixed(3)}SD)`;

const lines: string[] = [
  '# 附表1とIsojima 2016 LMSの比較（身長）',
  '',
  '生成: `npx tsx scripts/height-lms-independent-check.ts`。基準間の差の把握が目的で、係数調整や許容誤差には使わない。',
  '',
  '方法: 満月齢0〜210か月の附表1の平均・平均±2SDの身長を、年齢＝月齢÷12の原著LMS（Table 2転記値）で独立計算したSDに換算。表の年齢点（0.25歳刻み〜2歳、以降0.5歳刻み）は原著値そのもの、それ以外の月齢はアプリと同じCatmull-Rom補間による値。補間は原著が公表した連続曲線ではない。',
  '',
  '| 区分 | 対象 | 最大の差（絶対値） |',
  '|---|---|---|',
];
for (const sex of ['male', 'female'] as const) {
  for (const [label, flag] of [['表の年齢点', true], ['補間が必要な月齢', false]] as const) {
    const rows = all.filter(r => r.sex === sex && r.onTable === flag);
    lines.push(`| ${sex === 'male' ? '男子' : '女子'} / ${label} | ${rows.length / 3}月齢 | ${fmt(absMax(rows))} |`);
  }
}
lines.push('', '平均・+2SD・−2SD別の最大差:', '', '| 性別 | 水準 | 最大の差 |', '|---|---|---|');
for (const sex of ['male', 'female'] as const) {
  for (const level of ['-2SD', '平均', '+2SD']) {
    lines.push(`| ${sex === 'male' ? '男子' : '女子'} | ${level} | ${fmt(absMax(all.filter(r => r.sex === sex && r.level === level)))} |`);
  }
}
const overall = absMax(all);
lines.push('', `全体の最大差: ${fmt(overall)}`, '');
const over = (th: number) => all.filter(r => Math.abs(dev(r)) > th).length;
lines.push(`|差| > 0.1SD の点: ${over(0.1)} / ${all.length}、> 0.2SD: ${over(0.2)}、> 0.5SD: ${over(0.5)}`, '');
writeFileSync('docs/height-lms-fuhyo1-comparison.md', lines.join('\n'));
console.log('\n' + lines.join('\n'));
