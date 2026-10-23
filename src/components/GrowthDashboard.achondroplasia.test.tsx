// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthDashboard from './GrowthDashboard';
import { GROWTH_REFERENCE_LABELS } from '../lib/constants';

expect.extend(matchers);

const state = vi.hoisted(() => ({
  scenario: null as unknown,
  formProps: null as null | { growthReference: string; initialData: { childId: string; measurements: unknown[] } },
  chartProps: null as null | { growthReference?: string; preset: { id: string; name: string } },
}));

vi.mock('./GrowthForm', () => ({
  default: (props: {
    onDataChange: (data: unknown) => void;
    onGrowthReferenceChange?: (reference: string) => void;
    growthReference?: string;
    initialData: { childId: string; measurements: unknown[] };
  }) => {
    const { onDataChange } = props;
    React.useEffect(() => {
      onDataChange(state.scenario);
    }, [onDataChange]);
    state.formProps = { growthReference: props.growthReference ?? '', initialData: props.initialData };
    return (
      <div>
        <span data-testid="form-reference">{props.growthReference}</span>
        <span data-testid="form-child-id">{props.initialData.childId}</span>
        <button type="button" onClick={() => props.onGrowthReferenceChange?.('achondroplasia-clarity')}>
          load-achondroplasia-file
        </button>
      </div>
    );
  },
}));
vi.mock('./GrowthChart', () => ({
  default: (props: { growthReference?: string; preset: { id: string; name: string } }) => {
    state.chartProps = props;
    return null;
  },
  CHART_PRESETS: [
    { id: 'preset-1', name: 'JP 1' },
    { id: 'preset-2', name: 'JP 2' },
    { id: 'preset-3', name: 'JP 3' },
  ],
  ACHONDROPLASIA_CHART_PRESETS: [
    { id: 'preset-1', name: 'ACH 1' },
    { id: 'preset-2', name: 'ACH 2' },
    { id: 'preset-3', name: 'ACH 3' },
  ],
}));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));

afterEach(() => cleanup());

const ACH_ID = 'achondroplasia-clarity';
const ACH_LABEL = GROWTH_REFERENCE_LABELS[ACH_ID];
const DESCRIPTION = 'CLARITY基準：身長は共通SD、体重は平均の上下で異なるSDを使用します。背景線は補足表から算出したSD線です。';
const HEIGHT_RANGE = '身長SDSはCLARITY基準の対象範囲外です（18.0歳まで）。';
const WEIGHT_RANGE = '体重SDSはCLARITY基準の対象範囲外です（18.0歳まで）。';

function renderScenario(measurements: Array<{ id: string; date: Date; height?: number | string; weight?: number | string }>, overrides: Record<string, unknown> = {}) {
  state.scenario = {
    childId: 'ach-test',
    birthDate: new Date(2000, 0, 1),
    sex: '男子',
    gestationalWeeks: 40,
    gestationalDays: 0,
    measurements,
    ...overrides,
  };
  return render(React.createElement(GrowthDashboard));
}

const TWO_MEASUREMENTS = [
  { id: 'a', date: new Date(2001, 0, 1), height: 71.9, weight: 9.15 },
  { id: 'b', date: new Date(2002, 0, 1), height: 85, weight: 11 },
];

const referenceSelect = () => screen.getByLabelText('成長基準') as HTMLSelectElement;
const selectReference = (value: string) => fireEvent.change(referenceSelect(), { target: { value } });
const resultsSection = (container: HTMLElement) => container.querySelector('#results-section') as HTMLElement;

describe('GrowthDashboard: reference selector', () => {
  it('offers the two labeled references and defaults to the Japanese reference', () => {
    renderScenario(TWO_MEASUREMENTS);
    const options = within(referenceSelect()).getAllByRole('option').map(o => [(o as HTMLOptionElement).value, o.textContent]);
    expect(options).toEqual([
      ['japanese', '日本人基準'],
      [ACH_ID, '軟骨無形成症（CLARITY・米国）'],
    ]);
    expect(referenceSelect().value).toBe('japanese');
    expect(screen.queryByText('フェーズ 1: スタンドアロン版')).toBeNull();
    expect(state.formProps?.growthReference).toBe('japanese');
    expect(state.chartProps?.growthReference).toBe('japanese');
  });

  it('keeps the entered data and passes the reference to the form and chart when switching', () => {
    renderScenario(TWO_MEASUREMENTS);
    selectReference(ACH_ID);
    expect(screen.getByTestId('form-reference')).toHaveTextContent(ACH_ID);
    expect(screen.getByTestId('form-child-id')).toHaveTextContent('ach-test');
    expect(state.formProps?.initialData.measurements).toHaveLength(2);
    expect(state.chartProps?.growthReference).toBe(ACH_ID);
  });

  it('keeps the selected display range (same id) while switching to the achondroplasia presets', () => {
    renderScenario(TWO_MEASUREMENTS);
    expect(state.chartProps?.preset).toEqual({ id: 'preset-3', name: 'JP 3' });
    selectReference(ACH_ID);
    expect(state.chartProps?.preset).toEqual({ id: 'preset-3', name: 'ACH 3' });
    selectReference('japanese');
    expect(state.chartProps?.preset).toEqual({ id: 'preset-3', name: 'JP 3' });
  });

  it('switches when a loaded file sets the reference through the form', () => {
    renderScenario(TWO_MEASUREMENTS);
    fireEvent.click(screen.getByRole('button', { name: 'load-achondroplasia-file' }));
    expect(referenceSelect().value).toBe(ACH_ID);
    expect(screen.getByTestId('form-reference')).toHaveTextContent(ACH_ID);
  });
});

describe('GrowthDashboard: achondroplasia (CLARITY) mode', () => {
  it('shows the description for the selected reference only', () => {
    renderScenario(TWO_MEASUREMENTS);
    expect(document.getElementById('growth-reference-description')).toBeNull();
    selectReference(ACH_ID);
    expect(document.getElementById('growth-reference-description')).toHaveTextContent(DESCRIPTION);
    expect(referenceSelect()).toHaveAttribute('aria-describedby', 'growth-reference-description');
  });

  it('shows the height and weight values with SDS from the CLARITY rows in both the table and the cards', () => {
    const { container } = renderScenario(TWO_MEASUREMENTS);
    selectReference(ACH_ID);
    // Boys, 12 completed months: 71.9 cm -> +3.08 SD, 9.15 kg -> +1.50 SD (CSV rows; see achondroplasia-growth.test.ts)
    expect(screen.getAllByText(/3\.08SD/)).toHaveLength(2);
    expect(screen.getAllByText(/1\.50SD/)).toHaveLength(2);
    expect(within(resultsSection(container)).getAllByText(/71\.9cm/).length).toBeGreaterThanOrEqual(2);
    expect(within(resultsSection(container)).getAllByText(/9\.15kg/).length).toBeGreaterThanOrEqual(2);
  });

  it('hides BMI, the obesity index, the obesity-basis toggle, and the height-velocity card and link', () => {
    const { container } = renderScenario(TWO_MEASUREMENTS);
    // Present for the Japanese reference
    expect(screen.getByRole('columnheader', { name: /BMI/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '肥満度の算出基準' })).toBeInTheDocument();
    expect(container.querySelector('#hv-section')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'HV' })).toBeInTheDocument();

    selectReference(ACH_ID);
    expect(screen.queryByRole('columnheader', { name: /BMI/ })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /肥満度/ })).toBeNull();
    expect(screen.queryByRole('group', { name: '肥満度の算出基準' })).toBeNull();
    expect(container.querySelector('#hv-section')).toBeNull();
    expect(screen.queryByText(/身長速度/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'HV' })).toBeNull();
    expect(resultsSection(container)).not.toHaveTextContent('肥満度');
    expect(resultsSection(container)).not.toHaveTextContent('BMI');
    // The same-page navigation links stay links
    expect(screen.getByRole('link', { name: '評価結果' })).toHaveAttribute('href', '#results-section');
  });

  it('does not show the Japanese-only notices (附表1 / LMS / Suwa / 17-year limits)', () => {
    const { container } = renderScenario([{ id: 'a', date: new Date(2017, 7, 1), height: 171, weight: 61 }]);
    expect(container).toHaveTextContent('身長SDSは基準表の対象範囲外です（満17歳6か月まで）。');
    selectReference(ACH_ID);
    expect(container).not.toHaveTextContent('満17歳6か月');
    expect(container).not.toHaveTextContent('17歳6か月の基準値を使用した参考値');
    expect(container).not.toHaveTextContent('附表1の満月齢別平均');
    expect(container).not.toHaveTextContent('Suwa');
    expect(container).not.toHaveTextContent('Isojima');
  });

  it('names the reference in the table, every mobile card, and the print header', () => {
    const { container } = renderScenario(TWO_MEASUREMENTS);
    expect(container).not.toHaveTextContent(`成長基準: ${ACH_LABEL}`);
    selectReference(ACH_ID);

    const table = within(resultsSection(container)).getByRole('table');
    expect(table.querySelector('caption')).toHaveTextContent(ACH_LABEL);

    const cards = within(resultsSection(container)).getAllByRole('article');
    expect(cards).toHaveLength(2);
    for (const card of cards) expect(card).toHaveTextContent(`成長基準: ${ACH_LABEL}`);

    let header: HTMLElement | null = screen.getByText('デジタル成長報告書 (dGC-JP)');
    while (header && !header.textContent?.includes('対象児ID')) header = header.parentElement;
    expect(header).not.toBeNull();
    expect(header).toHaveTextContent(ACH_LABEL);
    expect(resultsSection(container)).toHaveTextContent(`（成長基準: ${ACH_LABEL}）`);
  });

  it('shows the out-of-range notice from just after 18.0 years, keeping the measured values and giving no SDS', () => {
    const { container } = renderScenario([
      { id: 'on', date: new Date(2018, 0, 1), height: 139, weight: 75.25 },
      { id: 'after', date: new Date(2018, 0, 2), height: 140, weight: 76 },
    ]);
    selectReference(ACH_ID);
    // Exactly 18.0 years is calculated; the next day is not.
    expect(screen.getAllByText(/1\.60SD/)).toHaveLength(2);
    expect(screen.getAllByText(/1\.50SD/)).toHaveLength(2);
    expect(screen.getAllByText(HEIGHT_RANGE)).toHaveLength(2);
    expect(screen.getAllByText(WEIGHT_RANGE)).toHaveLength(2);
    expect(within(resultsSection(container)).getAllByText(/140cm/).length).toBeGreaterThanOrEqual(2);
    expect(within(resultsSection(container)).getAllByText(/76kg/).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the invalid-input reason and no SDS, using wording without BMI or obesity', () => {
    const { container } = renderScenario([{ id: 'a', date: new Date(2001, 0, 1), height: 'abc', weight: 9.15 }]);
    selectReference(ACH_ID);
    expect(screen.getAllByText('身長入力が不正です（入力値: abc）：身長SDSは算出しません')).toHaveLength(2);
    expect(screen.getAllByText(/1\.50SD/)).toHaveLength(2);
    expect(resultsSection(container)).not.toHaveTextContent('BMI');
  });

  it('holds the evaluation and says so when the gestational information is invalid', () => {
    const { container } = renderScenario(
      [{ id: 'a', date: new Date(2001, 0, 1), height: 71.9, weight: 9.15 }],
      { gestationalWeeks: Number.NaN },
    );
    selectReference(ACH_ID);
    expect(screen.getAllByText('在胎情報要確認：SDS未評価')).toHaveLength(4);
    expect(container).not.toHaveTextContent('3.08SD');
  });

  it('keeps numerically valid measurements visible even when no SDS can be calculated', () => {
    renderScenario([{ id: 'a', date: new Date(2018, 5, 1), height: 150, weight: 60 }]);
    selectReference(ACH_ID);
    expect(screen.getAllByText(/150cm/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/60kg/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(HEIGHT_RANGE)).toHaveLength(2);
  });
});

describe('GrowthDashboard: returning to the Japanese reference', () => {
  it('restores the Japanese results and features exactly as before', () => {
    const { container } = renderScenario(TWO_MEASUREMENTS);
    const before = resultsSection(container).textContent;
    const hvBefore = container.querySelector('#hv-section')?.textContent;
    expect(hvBefore).toBeTruthy();

    selectReference(ACH_ID);
    expect(resultsSection(container).textContent).not.toBe(before);

    selectReference('japanese');
    expect(resultsSection(container).textContent).toBe(before);
    expect(container.querySelector('#hv-section')?.textContent).toBe(hvBefore);
    expect(screen.getByRole('columnheader', { name: /BMI/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '肥満度の算出基準' })).toBeInTheDocument();
    expect(document.getElementById('growth-reference-description')).toBeNull();
    expect(container).not.toHaveTextContent('3.08SD');
    expect(resultsSection(container)).not.toHaveTextContent('CLARITY');
    expect(container).not.toHaveTextContent('背景線は補足表から算出したSD線です');
  });
});
