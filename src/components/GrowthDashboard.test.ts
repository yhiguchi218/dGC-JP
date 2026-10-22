// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthDashboard, { getSuwaHVSDSClass } from './GrowthDashboard';
import * as growthUtils from '../lib/growth-utils';

expect.extend(matchers);

// Lets a test substitute an invalid boys 附表1 table; production data stays untouched.
const fuhyoOverride = vi.hoisted(() => ({ boys: null as [number, number][] | null }));
vi.mock('../data/fuhyo-growth-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/fuhyo-growth-data')>();
  return {
    ...actual,
    get FUHYO_BOYS_HEIGHT() { return fuhyoOverride.boys ?? actual.FUHYO_BOYS_HEIGHT; },
  };
});

vi.mock('./GrowthChart', () => ({
  default: ({ heightPoints, weightPoints }: { heightPoints: Array<unknown>; weightPoints: Array<unknown> }) => React.createElement('div', {
    'data-testid': 'growth-chart',
    'data-height-points': heightPoints.length,
    'data-weight-points': weightPoints.length,
    'data-weight-point-values': JSON.stringify(weightPoints),
  }),
  CHART_PRESETS: [
    { id: 'preset-1', name: 'Preset 1' },
    { id: 'preset-2', name: 'Preset 2' },
    { id: 'preset-3', name: 'Preset 3' },
  ],
}));

vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));

const obesityMockState = vi.hoisted(() => ({ mode: null as null | 'infant' | 'rounding-school' }));

vi.mock('../lib/growth-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/growth-utils')>();
  return {
    ...actual,
    calculateObesityIndex: vi.fn((weight: number, height: number, age: number, sex: 'male' | 'female') => {
      if (obesityMockState.mode === 'infant') {
        if (weight === 9.5 && height === 75 && sex === 'male') {
          return 12.34;
        }
      }
      if (obesityMockState.mode === 'rounding-school') {
        if (weight === 25 && height === 140 && sex === 'male') {
          return 19.96;
        }
      }
      return actual.calculateObesityIndex(weight, height, age, sex);
    }),
    calculateObesityIndexByAge: vi.fn((weight: number, height: number, age: number, sex: 'male' | 'female') => {
      if (obesityMockState.mode === 'rounding-school') {
        if (weight === 25 && height === 140 && sex === 'male') {
          return -19.96;
        }
      }
      return actual.calculateObesityIndexByAge(weight, height, age, sex);
    }),
  };
});

vi.mock('./GrowthForm', () => ({
  default: ({ onDataChange }: { onDataChange: (data: unknown) => void }) => (
    React.createElement(React.Fragment, null,
      React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: 0,
          measurements: [
            { id: '1', date: new Date(2020, 0, 1), height: 45, weight: 2.2 },
            { id: '2', date: new Date(2021, 0, 1), height: 74, weight: 9.2 },
          ],
        }),
      }, '早産児データを表示'),
      React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'corrected-age-zero',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 34,
          gestationalDays: 0,
          measurements: [{ id: '1', date: new Date(2020, 1, 12), height: 54, weight: 4.2 }],
        }),
      }, '修正年齢0のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm-before-term-equivalent',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 32,
          gestationalDays: 0,
          measurements: [
            { id: '1', date: new Date(2020, 0, 29), height: 45, weight: 2.2 },
            { id: '2', date: new Date(2020, 1, 26), height: 50, weight: 3.0 },
          ],
        }),
      }, '40週相当前後のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm-valid-days-six',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: 6,
          measurements: [],
        }),
      }, '35週6日のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm-invalid-days-seven',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: 7,
          measurements: [{ id: 'invalid-days', date: new Date(2021, 0, 1), height: 74, weight: 9.2 }],
        }),
      }, '35週7日のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm-invalid-days-nan',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: Number.NaN,
          measurements: [{ id: 'invalid-days-nan', date: new Date(2021, 0, 1), height: 74, weight: 9.2 }],
        }),
      }, '35週NaN日のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'invalid-weeks',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: Number.NaN,
          gestationalDays: 0,
          measurements: [{ id: 'invalid-weeks-row', date: new Date(2021, 0, 1), height: 75, weight: 9.5 }],
        }),
      }, '在胎週数不正のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'valid-weeks-after-invalid',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 35,
          gestationalDays: 0,
          measurements: [{ id: 'valid-weeks-row', date: new Date(2021, 0, 1), height: 75, weight: 9.5 }],
        }),
      }, '35週確定後のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'invalid-weeks-at-three',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: Number.NaN,
          gestationalDays: 0,
          measurements: [{ id: 'invalid-weeks-at-three-row', date: new Date(2023, 0, 1), height: 95, weight: 14 }],
        }),
      }, '在胎週数不正で3歳ちょうどのデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'invalid-weeks-after-three',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: Number.NaN,
          gestationalDays: 0,
          measurements: [{ id: 'invalid-weeks-after-three-row', date: new Date(2023, 0, 2), height: 95.1, weight: 14.1 }],
        }),
      }, '在胎週数不正で3歳超のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'term-invalid-days',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 7,
          measurements: [{ id: 'term-invalid-days-row', date: new Date(2021, 0, 1), height: 75, weight: 9.5 }],
        }),
      }, '満期児で在胎日数不正のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'hv-reference-sd-missing',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            { id: '1', date: new Date(2020, 3, 20), height: 65, weight: 7.5 },
            { id: '2', date: new Date(2021, 3, 20), height: 80, weight: 10.5 },
          ],
        }),
      }, 'HV-SDSの基準SDがない年齢のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'hv-no-suwa-pair',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            { id: '1', date: new Date(2020, 0, 1), height: 50, weight: 3.3 },
            { id: '2', date: new Date(2020, 8, 1), height: 70, weight: 8.5 },
          ],
        }),
      }, 'Suwa測定組がないデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'monthly-height-sds-ages',
          birthDate: new Date(2000, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            // boys 144 months: mean 149.1, SD 7.6 -> (141.5 - 149.1) / 7.6 = -1.00
            { id: 'school', date: new Date(2012, 0, 1), height: 141.5, weight: 35 },
            // boys 210 months: mean 170.8, SD 5.8 -> (176.6 - 170.8) / 5.8 = +1.00
            { id: 'last-month-end', date: new Date(2017, 6, 31), height: 176.6, weight: 60 },
            // 211 months: height SDS not calculable
            { id: 'beyond', date: new Date(2017, 7, 1), height: 171, weight: 61 },
          ],
        }),
      }, '附表1の月齢範囲境界のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm-monthly-height-sds',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: 0,
          measurements: [
            // corrected birth date 2020-02-05 -> 34 corrected months: mean 90.9, SD 3.3 -> (94.2 - 90.9) / 3.3 = +1.00
            { id: 'at-three', date: new Date(2023, 0, 1), height: 94.2, weight: 13 },
            // age > 3.0: actual birth date -> 36 months: mean 92.2, SD 3.4 -> (95.6 - 92.2) / 3.4 = +1.00
            { id: 'after-three', date: new Date(2023, 0, 2), height: 95.6, weight: 13 },
          ],
        }),
      }, '早産児の3歳境界のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'monthly-weight-sds-boundary',
          birthDate: new Date(2024, 5, 7),
          sex: '女子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            { id: 'before-month', date: new Date(2026, 5, 6), height: 100, weight: 11.1 },
            { id: 'month-start', date: new Date(2026, 5, 7), height: 100, weight: 11.1 },
            { id: 'month-zero', date: new Date(2026, 5, 20), height: 100, weight: 11.0 },
            { id: 'same-month-end', date: new Date(2026, 5, 30), height: 100, weight: 11.1 },
            { id: 'next-month', date: new Date(2026, 6, 7), height: 100, weight: 11.1 },
          ],
        }),
      }, '体重SDSの満月齢境界データを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'invalid-height-hv',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            { id: 'hv-a', date: new Date(2020, 0, 1), height: 75, weight: 9 },
            { id: 'hv-b', date: new Date(2020, 6, 1), height: '0', weight: 9.5 },
            { id: 'hv-c', date: new Date(2021, 0, 1), height: 85, weight: 10 },
          ],
        }),
      }, '不正な身長を含むHVデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'invalid-height-fixed',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            { id: 'hv-a', date: new Date(2020, 0, 1), height: 75, weight: 9 },
            { id: 'hv-b', date: new Date(2020, 6, 1), height: '80', weight: 9.5 },
            { id: 'hv-c', date: new Date(2021, 0, 1), height: 85, weight: 10 },
          ],
        }),
      }, '不正な身長を修正したデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'missing-height-hv',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            { id: 'hv-a', date: new Date(2020, 0, 1), height: 75, weight: 9 },
            { id: 'hv-b', date: new Date(2020, 6, 1), height: '', weight: 9.5 },
            { id: 'hv-c', date: new Date(2021, 0, 1), height: 85, weight: 10 },
          ],
        }),
      }, '身長未入力を含むHVデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'invalid-best-suwa-candidate',
          birthDate: new Date(2019, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            { id: 'c-a', date: new Date(2024, 0, 1), height: 120, weight: 20 },
            { id: 'c-b', date: new Date(2024, 0, 16), height: 0, weight: 20.1 },
            { id: 'c-c', date: new Date(2025, 0, 16), height: 126, weight: 22 },
          ],
        }),
      }, '最良候補の身長が不正なHVデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'invalid-height-kinds',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [
            { id: 'k-nan', date: new Date(2021, 0, 1), height: Number.NaN, weight: 9.5 },
            { id: 'k-inf', date: new Date(2021, 1, 1), height: Infinity, weight: 9.6 },
            { id: 'k-zero', date: new Date(2021, 2, 1), height: 0, weight: 9.7 },
            { id: 'k-neg', date: new Date(2021, 3, 1), height: -5, weight: 9.8 },
            { id: 'k-dot', date: new Date(2021, 4, 1), height: '.', weight: 9.9 },
            { id: 'k-unit', date: new Date(2021, 5, 1), height: '12abc', weight: 10 },
            { id: 'k-empty', date: new Date(2021, 6, 1), height: '', weight: 10.1 },
          ],
        }),
      }, '不正な身長の種類別データを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'unusable-standard-weight',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [{ id: 'sw', date: new Date(2025, 5, 1), height: 50, weight: 20 }],
        }),
      }, '標準体重が算出できないデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'age-mode-valid',
          birthDate: new Date(2010, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [{ id: 'age10', date: new Date(2020, 0, 1), height: 140, weight: 40 }],
        }),
      }, '年齢別肥満度が算出できるデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'pending-gestation-hv',
          birthDate: new Date(2020, 0, 1),
          sex: '男子',
          gestationalWeeks: Number.NaN,
          gestationalDays: 0,
          measurements: [
            { id: 'p1', date: new Date(2020, 0, 1), height: 50, weight: 3.3 },
            { id: 'p2', date: new Date(2021, 0, 1), height: 75, weight: 9.5 },
          ],
        }),
      }, '在胎情報保留中のHVデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'infant-obesity-classification',
          birthDate: new Date(2024, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [{ id: 'infant', date: new Date(2024, 6, 1), height: 75, weight: 9.5 }],
        }),
      }, '乳児肥満度の区分データを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'school-age-obesity-classification',
          birthDate: new Date(2010, 0, 1),
          sex: '男子',
          gestationalWeeks: 40,
          gestationalDays: 0,
          measurements: [{ id: 'school-age', date: new Date(2020, 0, 1), height: 140, weight: 25 }],
        }),
      }, '肥満度区分の学童データを表示')
    )
  ),
}));

describe('Suwa HV-SDS display styling', () => {
  it('emphasizes values beyond the abnormal threshold', () => {
    expect(getSuwaHVSDSClass(2.1, '男子')).toBe('text-orange-500 dark:text-orange-400 font-bold');
    expect(getSuwaHVSDSClass(-2.1, '女子')).toBe('text-orange-500 dark:text-orange-400 font-bold');
  });

  it('uses the sex-specific normal style at the inclusive threshold', () => {
    expect(getSuwaHVSDSClass(2.0, '男子')).toBe('text-blue-500 dark:text-blue-400 font-medium');
    expect(getSuwaHVSDSClass(-2.0, '女子')).toBe('text-pink-500 dark:text-pink-400 font-medium');
  });
});

describe('GrowthDashboard responsive results content', () => {
  const cardCells = (card: HTMLElement) => Array.from(card.querySelectorAll('dd'));
  const tableRow = (date: string) => screen.getByRole('cell', { name: date }).closest('tr') as HTMLElement;
  const tableObesityCell = (row: HTMLElement) => row.querySelectorAll('td')[5] as HTMLElement;
  const expectObesityBasis = (card: HTMLElement, basis: '身長値ベース' | '年齢別ベース') => {
    expect(within(card).getByText(`肥満度（${basis}）`, { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: new RegExp(basis) })).toBeInTheDocument();
  };

  afterEach(() => {
    obesityMockState.mode = null;
    vi.restoreAllMocks();
    vi.mocked(growthUtils.calculateObesityIndex).mockClear();
    vi.mocked(growthUtils.calculateObesityIndexByAge).mockClear();
  });

  it('provides an accessible link to the clinician guide', () => {
    render(React.createElement(GrowthDashboard));

    const helpLink = screen.getByRole('link', { name: 'ヘルプ' });
    expect(helpLink).toHaveAttribute('href', 'https://github.com/yhiguchi218/dGC-JP/blob/main/USER_GUIDE.md');
    expect(helpLink).toHaveAttribute('target', '_blank');
    expect(helpLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(helpLink).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('provides four accessible quick-navigation anchors for page sections', () => {
    render(React.createElement(GrowthDashboard));

    const navigation = screen.getByRole('navigation', { name: '画面内ナビゲーション' });
    expect(navigation).toHaveTextContent('入力');
    expect(navigation).toHaveTextContent('成長曲線');
    expect(navigation).toHaveTextContent('評価結果');
    expect(navigation).toHaveTextContent('HV');

    expect(screen.getByRole('link', { name: '入力' })).toHaveAttribute('href', '#input-section');
    expect(screen.getByRole('link', { name: '成長曲線' })).toHaveAttribute('href', '#chart-section');
    expect(screen.getByRole('link', { name: '評価結果' })).toHaveAttribute('href', '#results-section');
    expect(screen.getByRole('link', { name: 'HV' })).toHaveAttribute('href', '#hv-section');

    ['input-section', 'chart-section', 'results-section', 'hv-section'].forEach((id) => {
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
    });
  });

  it('hides the HV navigation link when no height-velocity results exist', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '35週6日のデータを表示' }));

    expect(screen.queryByRole('link', { name: 'HV' })).toBeNull();
    expect(document.querySelector('#hv-section')).toBeNull();
  });

  it.each([
    ['早産児データを表示', '35週0日', true],
    ['35週6日のデータを表示', '35週6日', true],
  ])('displays valid gestational days and preterm correction status: %s', (buttonName, gestationalAge, expected) => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    expect(screen.getByText(gestationalAge)).toBeInTheDocument();
    expect(screen.queryByText('(早産期修正)')).toBe(expected ? screen.getByText('(早産期修正)') : null);
  });

  it.each([
    ['35週7日のデータを表示', '35週7日'],
    ['35週NaN日のデータを表示', 'NaN'],
  ])('does not print invalid gestational days: %s', (buttonName, invalidValue) => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    const gestationalAge = screen.getByText('在胎期間').parentElement;
    expect(gestationalAge).toHaveTextContent('35週（在胎日数要確認）');
    expect(gestationalAge).not.toHaveTextContent(invalidValue);
    expect(gestationalAge).not.toHaveTextContent('(早産期修正)');
  });

  it.each([
    ['35週7日のデータを表示', '74cm'],
    ['35週NaN日のデータを表示', '74cm'],
    ['在胎週数不正のデータを表示', '75cm'],
  ])('retains raw measurements but withholds SDS and chart points when correction is unknown: %s', (buttonName, rawHeight) => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    const measurement = screen.getByLabelText('測定日 2021/01/01 の成長評価結果');
    expect(measurement).toHaveTextContent(rawHeight);
    expect(measurement).toHaveTextContent('在胎情報要確認：SDS未評価');
    expect(measurement).not.toHaveTextContent(/\d+\.\d{2}SD/);
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '0');
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-weight-points', '0');
  });

  it('holds evaluation at exactly 3.0 years for invalid weeks, but uses chronological evaluation after 3.0', () => {
    render(React.createElement(GrowthDashboard));

    fireEvent.click(screen.getByRole('button', { name: '在胎週数不正で3歳ちょうどのデータを表示' }));
    const atThree = screen.getByLabelText('測定日 2023/01/01 の成長評価結果');
    expect(atThree).toHaveTextContent('在胎情報要確認：SDS未評価');
    expect(atThree).not.toHaveTextContent(/\d+\.\d{2}SD/);
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '0');

    fireEvent.click(screen.getByRole('button', { name: '在胎週数不正で3歳超のデータを表示' }));
    const afterThree = screen.getByLabelText('測定日 2023/01/02 の成長評価結果');
    expect(afterThree).not.toHaveTextContent('在胎情報要確認：SDS未評価');
    expect(afterThree).toHaveTextContent(/\d+\.\d{2}SD/);
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '1');
  });

  it('keeps chronological SDS and chart points for a term child with invalid gestational days', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '満期児で在胎日数不正のデータを表示' }));

    const measurement = screen.getByLabelText('測定日 2021/01/01 の成長評価結果');
    expect(measurement).not.toHaveTextContent('在胎情報要確認：SDS未評価');
    expect(measurement).toHaveTextContent(/\d+\.\d{2}SD/);
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '1');
  });

  it('resumes corrected-age evaluation after gestational weeks are confirmed', () => {
    render(React.createElement(GrowthDashboard));

    fireEvent.click(screen.getByRole('button', { name: '在胎週数不正のデータを表示' }));
    expect(screen.getByLabelText('測定日 2021/01/01 の成長評価結果')).toHaveTextContent('在胎情報要確認：SDS未評価');
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '0');

    fireEvent.click(screen.getByRole('button', { name: '35週確定後のデータを表示' }));
    const measurement = screen.getByLabelText('測定日 2021/01/01 の成長評価結果');
    expect(measurement).not.toHaveTextContent('在胎情報要確認：SDS未評価');
    expect(measurement).toHaveTextContent(/修正 \d+\.\d{4}歳/);
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '2');
  });

  it('does not display preterm correction status for term births', () => {
    render(React.createElement(GrowthDashboard));

    expect(screen.queryByText('(早産期修正)')).toBeNull();
  });

  it('renders separate Raw and Suwa HV cards using the existing calculated results', () => {
    render(React.createElement(GrowthDashboard));

    const rawHVRegions = screen.getAllByRole('region', { name: '直近HV' });
    const suwaHVRegions = screen.getAllByRole('region', { name: '12か月HV（Suwa基準）' });

    expect(rawHVRegions).not.toHaveLength(0);
    expect(suwaHVRegions).toHaveLength(rawHVRegions.length);
    expect(rawHVRegions).not.toContain(suwaHVRegions[0]);
    expect(rawHVRegions[0]).toHaveTextContent(/cm\/年/);
    expect(suwaHVRegions[0]).toHaveTextContent(/cm\/年/);
  });

  it('keeps valid Suwa HV-SDS values and labels a missing reference SD instead of showing a number', () => {
    render(React.createElement(GrowthDashboard));

    const suwaHVRegions = screen.getAllByRole('region', { name: '12か月HV（Suwa基準）' });
    expect(suwaHVRegions).toHaveLength(3);

    // Midpoint 0.5 years: the source has no SD there.
    expect(suwaHVRegions[0]).toHaveTextContent('25.00 cm/年');
    expect(suwaHVRegions[0]).toHaveTextContent('HV-SDS: 算出不可（基準SDなし）');
    expect(suwaHVRegions[0]).not.toHaveTextContent(/HV-SDS: -?\d/);

    // Midpoints 1.5 and 2.5 years: (11 - 10.3) / 0.93 and (9 - 8.0) / 0.70.
    expect(suwaHVRegions[1]).toHaveTextContent('HV-SDS: 0.75');
    expect(suwaHVRegions[2]).toHaveTextContent('HV-SDS: 1.43');
  });

  it('retains Raw and Suwa HV but shows no extreme HV-SDS when the reference SD is missing', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: 'HV-SDSの基準SDがない年齢のデータを表示' }));

    const rawRegion = screen.getByRole('region', { name: '直近HV' });
    const suwaRegion = screen.getByRole('region', { name: '12か月HV（Suwa基準）' });

    expect(rawRegion).toHaveTextContent('15.03 cm/年');
    expect(suwaRegion).toHaveTextContent('15.03 cm/年');
    expect(suwaRegion).toHaveTextContent('HV-SDS: 算出不可（基準SDなし）');
    expect(suwaRegion).not.toHaveTextContent(/HV-SDS: -?\d/);
    expect(suwaRegion).not.toHaveTextContent('Suwa法によるHV-SDSは約12か月間隔の測定値で算出します');
  });

  it('distinguishes a missing Suwa measurement pair from a missing reference SD', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: 'Suwa測定組がないデータを表示' }));

    const suwaRegion = screen.getByRole('region', { name: '12か月HV（Suwa基準）' });

    expect(screen.getByRole('region', { name: '直近HV' })).toHaveTextContent(/cm\/年/);
    expect(suwaRegion).toHaveTextContent('HV-SDS: —');
    expect(suwaRegion).toHaveTextContent('Suwa法によるHV-SDSは約12か月間隔の測定値で算出します');
    expect(suwaRegion).not.toHaveTextContent('算出不可（基準SDなし）');
  });

  it('retains chronological and corrected decimal and full-month ages in measurement cards', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '早産児データを表示' }));

    const measurementCard = screen.getByLabelText('測定日 2021/01/01 の成長評価結果');
    expect(measurementCard).toHaveTextContent(/\d+\.\d{4}歳/);
    expect(measurementCard).toHaveTextContent(/満(?:\d+歳)?\d+ヶ月/);
    expect(measurementCard).toHaveTextContent(/修正 \d+\.\d{4}歳/);
    expect(measurementCard).toHaveTextContent(/修正 満(?:\d+歳)?\d+ヶ月/);
  });

  it('preserves a corrected age of zero in the dashboard display', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '修正年齢0のデータを表示' }));

    expect(screen.getByLabelText('測定日 2020/02/12 の成長評価結果')).toHaveTextContent('修正 0.0000歳');
  });

  it('excludes preterm measurements before term-equivalent from SDS and chart points', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '40週相当前後のデータを表示' }));

    const beforeTermEquivalent = screen.getByLabelText('測定日 2020/01/29 の成長評価結果');
    expect(beforeTermEquivalent).toHaveTextContent('45cm');
    expect(beforeTermEquivalent).toHaveTextContent('2.2kg');
    expect(beforeTermEquivalent).toHaveTextContent('SDS算出対象外（40週0日相当前）');
    expect(beforeTermEquivalent).not.toHaveTextContent(/\d+\.\d{2}SD/);

    const atTermEquivalent = screen.getByLabelText('測定日 2020/02/26 の成長評価結果');
    expect(atTermEquivalent).toHaveTextContent('修正 0.0000歳');
    const sdMatches = atTermEquivalent.textContent?.match(/\d+\.\d{2}SD/g) ?? [];
    expect(sdMatches).toHaveLength(2);

    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '2');
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-weight-points', '2');
  });

  it('announces and displays the selected obesity calculation basis', () => {
    render(React.createElement(GrowthDashboard));

    const heightButton = screen.getByRole('button', { name: '性別身長別' });
    const ageButton = screen.getByRole('button', { name: '性別年齢別' });
    const measurementCard = screen.getByLabelText('測定日 2020/01/01 の成長評価結果');

    expect(heightButton).toHaveAttribute('aria-pressed', 'true');
    expect(ageButton).toHaveAttribute('aria-pressed', 'false');
    expect(measurementCard).toHaveTextContent('肥満度（身長値ベース）');

    fireEvent.click(ageButton);

    expect(heightButton).toHaveAttribute('aria-pressed', 'false');
    expect(ageButton).toHaveAttribute('aria-pressed', 'true');
    expect(measurementCard).toHaveTextContent('肥満度（年齢別ベース）');
  });

  it('shows an infant note with a calculable value but no classification label or obesity-color classes', () => {
    obesityMockState.mode = 'infant';
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '乳児肥満度の区分データを表示' }));

    const card = screen.getByLabelText('測定日 2024/07/01 の成長評価結果');
    const table = tableRow('2024/07/01');

    expect(cardCells(card)[3]).toHaveTextContent('12.3%');
    expect(cardCells(card)[3]).toHaveTextContent('参考値・乳児の肥満判定には用いません');
    expect(cardCells(card)[3]).not.toHaveTextContent('太り');
    expect(cardCells(card)[3].querySelector('.text-red-600, .text-orange-500, .text-yellow-600, .text-blue-500, .text-blue-700')).toBeNull();

    expect(table).toHaveTextContent('12.3%');
    expect(table).toHaveTextContent('参考値・乳児の肥満判定には用いません');
    expect(table).not.toHaveTextContent('太り');
    expect(table.querySelector('.text-red-600, .text-orange-500, .text-yellow-600, .text-blue-500, .text-blue-700')).toBeNull();
  });

  it('shows underweight classification only in age-based mode for school-age data in both table and card', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '肥満度区分の学童データを表示' }));

    const card = screen.getByLabelText('測定日 2020/01/01 の成長評価結果');
    const table = tableRow('2020/01/01');

    expectObesityBasis(card, '身長値ベース');
    expect(cardCells(card)[3]).toHaveTextContent('-25.0%');
    expect(cardCells(card)[3]).not.toHaveTextContent('やせ');
    expect(tableObesityCell(table)).toHaveTextContent('-25.0%');
    expect(tableObesityCell(table)).not.toHaveTextContent('やせ');

    fireEvent.click(screen.getByRole('button', { name: '性別年齢別' }));

    expectObesityBasis(card, '年齢別ベース');
    expect(cardCells(card)[3]).toHaveTextContent('-28.2%');
    expect(cardCells(card)[3]).toHaveTextContent('軽度やせ');
    expect(cardCells(card)[3].querySelector('.text-blue-500, .text-blue-700')).not.toBeNull();
    expect(tableObesityCell(table)).toHaveTextContent('-28.2%');
    expect(tableObesityCell(table)).toHaveTextContent('軽度やせ');
    expect(tableObesityCell(table).querySelector('.text-blue-500, .text-blue-700')).not.toBeNull();
  });

  it('keeps classification on raw values, not rounded display values, for table and card', () => {
    obesityMockState.mode = 'rounding-school';
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '肥満度区分の学童データを表示' }));

    const card = screen.getByLabelText('測定日 2020/01/01 の成長評価結果');
    const table = tableRow('2020/01/01');

    expectObesityBasis(card, '身長値ベース');
    expect(cardCells(card)[3]).toHaveTextContent('20.0%');
    expect(cardCells(card)[3]).not.toHaveTextContent('軽度肥満');
    expect(cardCells(card)[3].querySelector('.text-yellow-700, .text-orange-600, .text-red-700')).toBeNull();
    expect(tableObesityCell(table)).toHaveTextContent('20.0%');
    expect(tableObesityCell(table)).not.toHaveTextContent('軽度肥満');
    expect(tableObesityCell(table).querySelector('.text-yellow-700, .text-orange-600, .text-red-700')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '性別年齢別' }));

    expectObesityBasis(card, '年齢別ベース');
    expect(cardCells(card)[3]).toHaveTextContent('-20.0%');
    expect(cardCells(card)[3]).not.toHaveTextContent('軽度やせ');
    expect(cardCells(card)[3].querySelector('.text-blue-500, .text-blue-700')).toBeNull();
    expect(tableObesityCell(table)).toHaveTextContent('-20.0%');
    expect(tableObesityCell(table)).not.toHaveTextContent('軽度やせ');
    expect(tableObesityCell(table).querySelector('.text-blue-500, .text-blue-700')).toBeNull();
  });

  it('calculates height SDS from the 附表1 monthly mean and SD at school age and at 210 months', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '附表1の月齢範囲境界のデータを表示' }));

    const school = screen.getByLabelText('測定日 2012/01/01 の成長評価結果');
    expect(school).toHaveTextContent('141.5cm');
    expect(school).toHaveTextContent('-1.00SD');

    const lastMonth = screen.getByLabelText('測定日 2017/07/31 の成長評価結果');
    expect(lastMonth).toHaveTextContent('176.6cm');
    expect(lastMonth).toHaveTextContent('1.00SD');
    expect(lastMonth).not.toHaveTextContent('算出不可（附表1の対象月齢外）');
  });

  it('keeps raw values, weight SDS and the chart point at 211 months while showing why height SDS is unavailable', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '附表1の月齢範囲境界のデータを表示' }));

    const beyond = screen.getByLabelText('測定日 2017/08/01 の成長評価結果');
    expect(beyond).toHaveTextContent('171cm');
    expect(beyond).toHaveTextContent('61kg');
    expect(beyond).toHaveTextContent('身長SDS算出不可（附表1の対象月齢外）');
    expect(beyond).not.toHaveTextContent('在胎情報要確認');
    expect(beyond).not.toHaveTextContent('40週0日相当前');
    // The only SD shown is the LMS-based weight SDS; height SDS is not shown as 0.
    expect(beyond.textContent?.match(/-?\d+\.\d{2}SD/g) ?? []).toHaveLength(1);
    expect(beyond).not.toHaveTextContent(/身長.*0\.00SD/);
    expect(beyond).toHaveTextContent('BMI');
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '3');
    expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-weight-points', '3');
  });

  it('describes the height SDS basis and the LMS background in the visible notes', () => {
    render(React.createElement(GrowthDashboard));

    expect(screen.getByText(/身長SDSは附表1の満月齢別平均・標準偏差（満月齢0〜210か月）で算出し/)).toBeInTheDocument();
    expect(screen.getByText(/背景曲線はIsojima 2016のLMS基準によるため、表示SDSと曲線上の位置は一致しない場合があります/)).toBeInTheDocument();
    expect(screen.getByText(/−2\.5SD・−3SD線もLMS基準による計算線です/)).toBeInTheDocument();
  });

  it('keeps preterm correction through exactly 3.0 years for the monthly reference, and uses the actual birth date afterwards', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '早産児の3歳境界のデータを表示' }));

    const atThree = screen.getByLabelText('測定日 2023/01/01 の成長評価結果');
    expect(atThree).toHaveTextContent(/修正 \d+\.\d{4}歳/);
    expect(atThree).toHaveTextContent('94.2cm');
    expect(atThree).toHaveTextContent('1.00SD');
    expect(atThree).toHaveTextContent('13kg');
    expect(atThree).toHaveTextContent('0.15SD');

    const afterThree = screen.getByLabelText('測定日 2023/01/02 の成長評価結果');
    expect(afterThree).not.toHaveTextContent(/修正 \d+\.\d{4}歳/);
    expect(afterThree).toHaveTextContent('95.6cm');
    expect(afterThree).toHaveTextContent('1.00SD');
    expect(afterThree).toHaveTextContent('13kg');
    expect(afterThree).toHaveTextContent('-0.07SD');
  });

  it('uses corrected month 0 for a corrected age of zero: girls mean 48.4, SD 2.1 -> (54 - 48.4) / 2.1 = 2.67', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '修正年齢0のデータを表示' }));

    const card = screen.getByLabelText('測定日 2020/02/12 の成長評価結果');
    expect(card).toHaveTextContent('修正 0.0000歳');
    expect(card).toHaveTextContent('2.67SD');
    expect(card).toHaveTextContent('4.2kg');
    expect(card).toHaveTextContent('2.77SD');
  });

  it('uses completed-month weight SDS in the result views and chart while preserving decimal-age coordinates', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '体重SDSの満月齢境界データを表示' }));

    const beforeMonth = screen.getByLabelText('測定日 2026/06/06 の成長評価結果');
    const monthStart = screen.getByLabelText('測定日 2026/06/07 の成長評価結果');
    const zeroSDS = screen.getByLabelText('測定日 2026/06/20 の成長評価結果');
    const sameMonthEnd = screen.getByLabelText('測定日 2026/06/30 の成長評価結果');
    const nextMonth = screen.getByLabelText('測定日 2026/07/07 の成長評価結果');
    expect(beforeMonth).toHaveTextContent('11.1kg');
    expect(beforeMonth).toHaveTextContent('0.29SD');
    expect(monthStart).toHaveTextContent('11.1kg');
    expect(monthStart).toHaveTextContent('0.09SD');
    expect(zeroSDS).toHaveTextContent('11kg');
    expect(zeroSDS).toHaveTextContent('0.00SD');
    expect(zeroSDS).not.toHaveTextContent('算出不可');
    expect(sameMonthEnd).toHaveTextContent('11.1kg');
    expect(sameMonthEnd).toHaveTextContent('0.09SD');
    expect(nextMonth).toHaveTextContent('11.1kg');
    expect(nextMonth).toHaveTextContent('-0.05SD');

    const chartPoints = JSON.parse(screen.getByTestId('growth-chart').getAttribute('data-weight-point-values') ?? '[]');
    expect(chartPoints).toHaveLength(5);
    expect(chartPoints[0].value).toBe(11.1);
    expect(chartPoints[0].zScore).toBeCloseTo(0.2933063975354676, 12);
    expect(chartPoints[1].value).toBe(11.1);
    expect(chartPoints[1].zScore).toBeCloseTo(0.08595455685908822, 12);
    expect(chartPoints[2].zScore).toBe(0);
    expect(chartPoints[3].zScore).toBe(chartPoints[1].zScore);
    expect(chartPoints[4].zScore).toBeCloseTo(-0.04734361593447061, 12);
    expect(chartPoints[1].age).toBe(2);
    expect(chartPoints[3].age).toBeCloseTo(2 + 23 / 365, 4);
    expect(chartPoints[4].age).toBeCloseTo(2 + 30 / 365, 4);
  });

  describe('height SDS unavailable reasons', () => {
    afterEach(() => {
      fuhyoOverride.boys = null;
    });

    // Default data: boys, born 2020/01/01, 2021/01/01 = 12 months, height 75 cm (mean 75.0, SD 2.6).
    const firstHeightCell = (card: HTMLElement) => card.querySelectorAll('dd')[0];

    it('keeps an exact 0 SDS as a number, not as unavailable', () => {
      render(React.createElement(GrowthDashboard));

      const height = firstHeightCell(screen.getByLabelText('測定日 2021/01/01 の成長評価結果'));
      expect(height).toHaveTextContent('0.00SD');
      expect(height).not.toHaveTextContent('算出不可');
    });

    it('labels 211 months and later as outside the 附表1 range', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '附表1の月齢範囲境界のデータを表示' }));

      const height = firstHeightCell(screen.getByLabelText('測定日 2017/08/01 の成長評価結果'));
      expect(height).toHaveTextContent('身長SDS算出不可（附表1の対象月齢外）');
      expect(height).not.toHaveTextContent('入力値・基準値要確認');
    });

    it.each([
      ['an SD of 0', (table: [number, number][]) => table.map((row, i) => (i === 12 ? [75.0, 0] as [number, number] : row))],
      ['a NaN mean', (table: [number, number][]) => table.map((row, i) => (i === 12 ? [Number.NaN, 2.6] as [number, number] : row))],
      ['a missing row', (table: [number, number][]) => table.slice(0, 12)],
    ])('does not call an in-range month "outside the range" when the reference has %s', async (_label, mutate) => {
      const actual = await vi.importActual<typeof import('../data/fuhyo-growth-data')>('../data/fuhyo-growth-data');
      fuhyoOverride.boys = mutate(actual.FUHYO_BOYS_HEIGHT);
      render(React.createElement(GrowthDashboard));

      const height = firstHeightCell(screen.getByLabelText('測定日 2021/01/01 の成長評価結果'));
      expect(height).toHaveTextContent('75cm');
      expect(height).toHaveTextContent('身長SDS算出不可（入力値・基準値要確認）');
      expect(height).not.toHaveTextContent('附表1の対象月齢外');
      expect(height).not.toHaveTextContent(/-?\d+\.\d{2}SD/);
      expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '4');
    });
  });

  it('distinguishes out-of-range height SDS from pending gestational information', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '在胎週数不正のデータを表示' }));

    const pending = screen.getByLabelText('測定日 2021/01/01 の成長評価結果');
    expect(pending).toHaveTextContent('在胎情報要確認：SDS未評価');
    expect(pending).not.toHaveTextContent('附表1の対象月齢外');
  });

  it('includes the infant reference note in the table used for print rendering', () => {
    obesityMockState.mode = 'infant';
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '乳児肥満度の区分データを表示' }));

    const printTable = document.querySelector('div.hidden.overflow-x-auto.md\\:block.print\\:block table');
    expect(printTable).not.toBeNull();
    expect(within(printTable as HTMLElement).getByText('参考値・乳児の肥満判定には用いません')).toBeInTheDocument();
  });

  describe('invalid and unusable inputs', () => {
    const tableRow = (dateText: string) => Array.from(document.querySelectorAll('tbody tr'))
      .find(row => row.textContent?.includes(dateText)) as HTMLElement;

    it('withholds height-dependent evaluations for an invalid height in both views, and keeps the independent weight SDS', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '不正な身長を含むHVデータを表示' }));

      const card = screen.getByLabelText('測定日 2020/07/01 の成長評価結果');
      const row = tableRow('2020/07/01');
      [card, row].forEach((view) => {
        expect(view).toHaveTextContent('身長入力が不正です（入力値: 0）');
        expect(view).not.toHaveTextContent('在胎情報要確認');
        // The only SD shown is the weight SDS.
        expect(view.textContent?.match(/-?\d+\.\d{2}SD/g) ?? []).toHaveLength(1);
        expect(view).toHaveTextContent('9.5kg');
      });
      expect(cardCells(card)[2]).toHaveTextContent('-');
      expect(cardCells(card)[3]).toHaveTextContent('算出不可');
      expect(cardCells(card)[3]).not.toHaveTextContent('%');
      expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '2');
      expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-weight-points', '3');
    });

    it('disables the HV pair that uses the invalid height without bridging the valid rows as raw HV', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '不正な身長を含むHVデータを表示' }));

      // Only the 2021/01/01 result remains; the 2020/07/01 row (invalid current height) has no HV result.
      expect(screen.getAllByRole('region', { name: '直近HV' })).toHaveLength(1);
      const raw = screen.getByRole('region', { name: '直近HV' });
      expect(raw).toHaveTextContent('算出可能な測定間隔がありません');
      expect(raw).not.toHaveTextContent('cm/年');
      // The one-year pair of valid measurements that does not use the invalid row is kept.
      expect(screen.getByRole('region', { name: '12か月HV（Suwa基準）' })).toHaveTextContent('10.00 cm/年');
    });

    it('resumes the evaluations, chart point and raw HV when the invalid height is corrected', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '不正な身長を含むHVデータを表示' }));
      expect(screen.getAllByText(/身長入力が不正です/).length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole('button', { name: '不正な身長を修正したデータを表示' }));
      expect(screen.queryByText(/身長入力が不正です/)).toBeNull();
      expect(screen.getByLabelText('測定日 2020/07/01 の成長評価結果')).toHaveTextContent(/\d+\.\d{2}SD/);
      expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '3');
      expect(screen.getByRole('region', { name: '直近HV' })).toHaveTextContent('cm/年');
    });

    it('says why Suwa HV is unavailable when the best candidate height is invalid, without falling back to the next candidate', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '最良候補の身長が不正なHVデータを表示' }));

      const suwa = screen.getByRole('region', { name: '12か月HV（Suwa基準）' });
      expect(suwa).toHaveTextContent('測定の身長入力が不正なため、Suwa HVを算出しません');
      expect(suwa).not.toHaveTextContent('cm/年');
      expect(suwa).not.toHaveTextContent('基準SDなし');
      expect(suwa).not.toHaveTextContent('約12か月間隔');
      // Raw HV is unchanged: its adjacent measurement is the invalid row.
      expect(screen.getByRole('region', { name: '直近HV' })).toHaveTextContent('算出可能な測定間隔がありません');
    });

    it('keeps the earlier raw HV across a not-entered height, unlike an invalid height', () => {
      render(React.createElement(GrowthDashboard));

      fireEvent.click(screen.getByRole('button', { name: '身長未入力を含むHVデータを表示' }));
      // Not entered: the row is skipped as before, so the A-C pair (one year, 10 cm) is the raw HV.
      expect(screen.getByRole('region', { name: '直近HV' })).toHaveTextContent('10.00 cm/年');
      expect(screen.getByLabelText('測定日 2020/07/01 の成長評価結果')).not.toHaveTextContent('不正');

      fireEvent.click(screen.getByRole('button', { name: '不正な身長を含むHVデータを表示' }));
      expect(screen.getByRole('region', { name: '直近HV' })).not.toHaveTextContent('cm/年');
      expect(screen.getByRole('region', { name: '12か月HV（Suwa基準）' })).toHaveTextContent('10.00 cm/年');
    });

    it('treats NaN, Infinity, 0, negative, a lone dot and unit-suffixed heights as invalid, but an empty height as not entered', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '不正な身長の種類別データを表示' }));

      // Six invalid rows, shown in both the table and the cards.
      expect(document.querySelectorAll('[role="status"]')).toHaveLength(12);
      const notEntered = screen.getByLabelText('測定日 2021/07/01 の成長評価結果');
      expect(notEntered).not.toHaveTextContent('不正');
      expect(notEntered).toHaveTextContent(/\d+\.\d{2}SD/);
      expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-height-points', '0');
      expect(screen.getByTestId('growth-chart')).toHaveAttribute('data-weight-points', '7');
    });

    it('keeps BMI and the obesity index and HV when gestational information holds the SDS evaluation', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '在胎週数不正のデータを表示' }));

      const card = screen.getByLabelText('測定日 2021/01/01 の成長評価結果');
      expect(card).toHaveTextContent('在胎情報要確認：SDS未評価');
      // 9.5 / 0.75^2 = 16.9; height-based standard weight at 75 cm is 9.37 kg -> +1.4%.
      expect(cardCells(card)[2]).toHaveTextContent('16.9');
      expect(cardCells(card)[3]).toHaveTextContent('1.4%');

      fireEvent.click(screen.getByRole('button', { name: '在胎情報保留中のHVデータを表示' }));
      expect(screen.getByRole('region', { name: '直近HV' })).toHaveTextContent('25.00 cm/年');
      expect(screen.getByRole('region', { name: '12か月HV（Suwa基準）' })).toHaveTextContent('25.00 cm/年');
    });

    it('stops the obesity index and says why when the standard weight is 0 or less, in both views', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '標準体重が算出できないデータを表示' }));

      const card = screen.getByLabelText('測定日 2025/06/01 の成長評価結果');
      // Height-based mode: 50 cm is outside the existing application range (unchanged plain "not calculable").
      expect(cardCells(card)[3]).toHaveTextContent('算出不可');
      expect(cardCells(card)[3]).not.toHaveTextContent('標準体重を算出できません');

      fireEvent.click(screen.getByRole('button', { name: '性別年齢別' }));
      expect(screen.getAllByText(/肥満度算出不可（標準体重を算出できません）/)).toHaveLength(2);
      expect(cardCells(card)[3]).not.toHaveTextContent('%');
      expect(cardCells(card)[3].querySelector('.text-orange-500, .text-blue-500')).toBeNull();
      expect(tableRow('2025/06/01')).not.toHaveTextContent('%');
      // The valid inputs and other indices are retained.
      expect(cardCells(card)[2]).toHaveTextContent('80.0');
      expect(card).toHaveTextContent('50cm');
      expect(card).toHaveTextContent('20kg');
    });

    it('keeps the existing age-based obesity index for a valid case in both views', () => {
      render(React.createElement(GrowthDashboard));
      fireEvent.click(screen.getByRole('button', { name: '年齢別肥満度が算出できるデータを表示' }));
      fireEvent.click(screen.getByRole('button', { name: '性別年齢別' }));

      // (40 - (0.752 * 140 - 70.461)) / 34.819 = +14.9%
      expect(screen.getByLabelText('測定日 2020/01/01 の成長評価結果')).toHaveTextContent('14.9%');
      expect(tableRow('2020/01/01')).toHaveTextContent('14.9%');
    });
  });
});