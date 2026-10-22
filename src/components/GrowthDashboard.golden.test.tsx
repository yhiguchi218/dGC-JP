// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthDashboard from './GrowthDashboard';

expect.extend(matchers);

// Golden wiring tests: the real calculation path runs; only GrowthChart (props capture), ThemeToggle and GrowthForm are replaced.
// Expected values come from scripts/golden-dashboard-independent-check.ts (reference-data rows, plain LMS at table nodes,
// implementation obesity coefficients at e3ce6e6) and from src/data/golden-date-cases.ts. The chart props carry no measurement date.
// jsdom has no print layout: nothing here verifies print output. Both the table and the cards are in the jsdom DOM.
type ChartPoint = { age: number; value: number; zScore?: number; isCorrected?: boolean };
const harness = vi.hoisted(() => ({
  data: null as unknown,
  height: [] as unknown[],
  weight: [] as unknown[],
}));

vi.mock('./GrowthChart', () => ({
  default: ({ heightPoints, weightPoints }: { heightPoints: unknown[]; weightPoints: unknown[] }) => {
    harness.height = heightPoints;
    harness.weight = weightPoints;
    return null;
  },
  CHART_PRESETS: [{ id: 'preset-1', name: 'Preset 1' }, { id: 'preset-2', name: 'Preset 2' }, { id: 'preset-3', name: 'Preset 3' }],
}));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('./GrowthForm', () => ({
  default: ({ onDataChange }: { onDataChange: (data: unknown) => void }) =>
    React.createElement('button', { type: 'button', onClick: () => onDataChange(harness.data) }, 'データ読込'),
}));

type Row = { date: Date; height: number; weight: number };
const load = (sex: '男子' | '女子', birthDate: Date, gestationalWeeks: number, rows: Row[]) => {
  harness.data = {
    childId: 'golden',
    birthDate,
    sex,
    gestationalWeeks,
    gestationalDays: 0,
    measurements: rows.map((r, i) => ({ id: String(i), ...r })),
  };
  render(React.createElement(GrowthDashboard));
  fireEvent.click(screen.getByRole('button', { name: 'データ読込' }));
};

const tableRow = (date: string) =>
  within(screen.getByRole('table')).getByRole('cell', { name: date }).closest('tr') as HTMLElement;
const tableCells = (date: string) => Array.from(tableRow(date).querySelectorAll('td'));
const card = (date: string) => screen.getByLabelText(`測定日 ${date} の成長評価結果`);
const cardCells = (date: string) => Array.from(card(date).querySelectorAll('dd'));
const points = (list: unknown[]) => list as ChartPoint[];

describe('GrowthDashboard golden wiring (real calculation path)', () => {
  it('C1 term boy exactly 10 y, 140 cm, 40 kg: table and card agree on SDS / BMI / obesity; chart receives the same values', () => {
    load('男子', new Date(2010, 5, 15), 40, [{ date: new Date(2020, 5, 15), height: 140, weight: 40 }]);
    // 120 completed months: 附表1 row [136.4, 5.9] -> 0.6102; weight LMS node age 10 -> 1.1127; BMI 40 / 1.4^2 = 20.408
    const t = tableCells('2020/06/15');
    expect(t[2]).toHaveTextContent(/140cm\s*\(0\.61SD\)/);
    expect(t[3]).toHaveTextContent(/40kg\s*\(1\.11SD\)/);
    expect(t[4]).toHaveTextContent('20.4');
    // height-based: school polynomial 140-149 -> standard 33.3156 kg -> index 20.0637 %
    expect(t[5]).toHaveTextContent('20.1%');
    const c = cardCells('2020/06/15');
    expect(c[0]).toHaveTextContent(/140cm\s*0\.61SD/);
    expect(c[1]).toHaveTextContent(/40kg\s*1\.11SD/);
    expect(c[2]).toHaveTextContent('20.4');
    expect(c[3]).toHaveTextContent('20.1%');

    fireEvent.click(screen.getByRole('button', { name: '性別年齢別' }));
    // age-based: 0.752 * 140 - 70.461 = 34.819 -> index 14.8798 %
    expect(tableCells('2020/06/15')[5]).toHaveTextContent('14.9%');
    expect(cardCells('2020/06/15')[3]).toHaveTextContent('14.9%');

    expect(points(harness.height)).toHaveLength(1);
    expect(points(harness.height)[0]).toMatchObject({ age: 10, value: 140, isCorrected: false });
    expect(points(harness.height)[0].zScore).toBeCloseTo(0.6101694915, 9);
    expect(points(harness.weight)[0]).toMatchObject({ age: 10, value: 40, isCorrected: false });
    expect(points(harness.weight)[0].zScore).toBeCloseTo(1.1127047263, 9);
  });

  it('C2 girl at 210 vs 211 completed months: height SDS only through 210; the raw value and chart point stay at 211', () => {
    load('女子', new Date(2000, 0, 15), 40, [
      { date: new Date(2017, 6, 15), height: 160, weight: 50 },
      { date: new Date(2017, 7, 15), height: 160, weight: 50 },
    ]);
    // 210 months: 附表1 row [158.1, 5.3] -> 0.3585; 211 months: no row
    expect(tableCells('2017/07/15')[2]).toHaveTextContent(/160cm\s*\(0\.36SD\)/);
    expect(cardCells('2017/07/15')[0]).toHaveTextContent(/160cm\s*0\.36SD/);
    for (const [container, heightCell] of [
      [tableRow('2017/08/15'), tableCells('2017/08/15')[2]],
      [card('2017/08/15'), cardCells('2017/08/15')[0]],
    ] as const) {
      expect(heightCell).toHaveTextContent('160cm');
      expect(heightCell).not.toHaveTextContent(/\d\.\d{2}SD/);
      expect(container).toHaveTextContent('身長SDS算出不可（附表1の対象月齢外）');
    }
    const h = points(harness.height);
    expect(h).toHaveLength(2);
    expect(h[0].zScore).toBeCloseTo(0.3584905660, 9);
    expect(h[1]).toMatchObject({ value: 160, isCorrected: false });
    expect(h[1].zScore).toBeUndefined();
    // weight SDS stays available at 211 months (value not pinned: above the LMS table end the current policy applies)
    expect(Number.isFinite(points(harness.weight)[1].zScore)).toBe(true);
    expect(points(harness.weight)[0].zScore).toBeCloseTo(-0.3452508809, 9);
  });

  it('C3 boy 32w0d (birth 2020-01-01): held row keeps raw values but no chart points; corrected age 0 and corrected month 0 vs 1', () => {
    load('男子', new Date(2020, 0, 1), 32, [
      { date: new Date(2020, 1, 25), height: 45, weight: 2.2 },
      { date: new Date(2020, 1, 26), height: 50, weight: 3.2 },
      { date: new Date(2020, 2, 25), height: 50, weight: 3.2 },
      { date: new Date(2020, 2, 26), height: 50, weight: 3.2 },
    ]);
    // day before the 40w0d-equivalent date: SDS held; raw height / weight and BMI (2.2 / 0.45^2 = 10.86) remain
    expect(tableCells('2020/02/25')[2]).toHaveTextContent('45cm');
    expect(tableCells('2020/02/25')[3]).toHaveTextContent('2.2kg');
    expect(tableCells('2020/02/25')[4]).toHaveTextContent('10.9');
    for (const text of [tableRow('2020/02/25'), card('2020/02/25')]) {
      expect(text).toHaveTextContent('SDS算出対象外（40週0日相当前）');
      expect(text).not.toHaveTextContent(/\d\.\d{2}SD/);
    }
    expect(cardCells('2020/02/25')[2]).toHaveTextContent('10.9');

    // corrected month 0: row 0 [49, 2.1] -> 0.4762; corrected month 1 (2020-03-26): row 1 [53.5, 2.2] -> -1.5909
    expect(tableCells('2020/02/26')[2]).toHaveTextContent(/50cm\s*\(0\.48SD\)/);
    expect(tableCells('2020/03/25')[2]).toHaveTextContent(/50cm\s*\(0\.48SD\)/);
    expect(tableCells('2020/03/26')[2]).toHaveTextContent(/50cm\s*\(-1\.59SD\)/);
    expect(cardCells('2020/02/26')[0]).toHaveTextContent(/50cm\s*0\.48SD/);
    expect(cardCells('2020/03/25')[0]).toHaveTextContent(/50cm\s*0\.48SD/);
    expect(cardCells('2020/03/26')[0]).toHaveTextContent(/50cm\s*-1\.59SD/);
    expect(cardCells('2020/02/26')[1]).toHaveTextContent(/3\.2kg\s*0\.44SD/);

    // chart: held row absent; each remaining row gives a chronological and a corrected-age point
    // ages (golden-date-cases): 56/366 = 0.1530 with corrected 0 (exactly 0 kept), 84/366 = 0.2295 / 0.0765, 85/366 = 0.2322 / 0.0792
    const h = points(harness.height);
    expect(h.map(p => [p.age, p.isCorrected])).toEqual([
      [0.153, false], [0, true],
      [0.2295, false], [0.0765, true],
      [0.2322, false], [0.0792, true],
    ]);
    expect(h.every(p => p.value === 50)).toBe(true);
    expect(h[1].age).toBe(0);
    expect(h[0].zScore).toBeCloseTo(0.4761904762, 9);
    expect(h[3].zScore).toBeCloseTo(0.4761904762, 9);
    expect(h[5].zScore).toBeCloseTo(-1.5909090909, 9);
    const w = points(harness.weight);
    expect(w).toHaveLength(6);
    expect(w[0].zScore).toBeCloseTo(0.4441452378, 9); // corrected month 0 -> LMS node age 0
    expect(w.every(p => p.value === 3.2)).toBe(true);
  });

  it('C4 leap-day boy 32w0d: reference birth switches from corrected (34 months) to actual (36 months) at the 3.0-year boundary', () => {
    load('男子', new Date(2020, 1, 29), 32, [
      { date: new Date(2023, 1, 28), height: 90, weight: 13 },
      { date: new Date(2023, 2, 1), height: 90, weight: 13 },
    ]);
    // 2023-02-28: chronological 3.0 -> still corrected; corrected birth 2020-04-25 -> 34 months row [92.1, 3.4] -> -0.6176
    // 2023-03-01: chronological 3.0027 -> not corrected; 36 months row [93.3, 3.5] -> -0.9429
    expect(tableCells('2023/02/28')[2]).toHaveTextContent(/90cm\s*\(-0\.62SD\)/);
    expect(cardCells('2023/02/28')[0]).toHaveTextContent(/90cm\s*-0\.62SD/);
    expect(tableCells('2023/03/01')[2]).toHaveTextContent(/90cm\s*\(-0\.94SD\)/);
    expect(cardCells('2023/03/01')[0]).toHaveTextContent(/90cm\s*-0\.94SD/);

    const h = points(harness.height);
    expect(h.map(p => [p.age, p.isCorrected])).toEqual([[3, false], [2.8466, true], [3.0027, false]]);
    expect(h[0].zScore).toBeCloseTo(-0.6176470588, 9);
    expect(h[1].zScore).toBeCloseTo(-0.6176470588, 9);
    expect(h[2].zScore).toBeCloseTo(-0.9428571429, 9);
    expect(points(harness.weight)).toHaveLength(3);
    expect(points(harness.weight).every(p => Number.isFinite(p.zScore))).toBe(true);
  });
});
