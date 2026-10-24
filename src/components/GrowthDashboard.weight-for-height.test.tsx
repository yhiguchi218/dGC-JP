// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthDashboard from './GrowthDashboard';
import { ACHONDROPLASIA_CLARITY_CSV_ROWS } from '../data/achondroplasia-clarity-source-fixture';

expect.extend(matchers);

const state = vi.hoisted(() => ({
  scenario: null as unknown,
  formProps: null as null | { growthReference: string; initialData: { childId: string; measurements: unknown[] } },
}));

vi.mock('./GrowthForm', () => ({
  default: (props: {
    onDataChange: (data: unknown) => void;
    growthReference?: string;
    initialData: { childId: string; measurements: unknown[] };
  }) => {
    const { onDataChange } = props;
    React.useEffect(() => {
      onDataChange(state.scenario);
    }, [onDataChange]);
    state.formProps = { growthReference: props.growthReference ?? '', initialData: props.initialData };
    return <span data-testid="form-reference">{props.growthReference}</span>;
  },
}));
// Only the rendered age chart is replaced; the real preset constants are kept (the dashboard's initial state reads CHART_PRESETS[2]).
vi.mock('./GrowthChart', async importOriginal => {
  const actual = await importOriginal<typeof import('./GrowthChart')>();
  return {
    ...actual,
    default: () => <div data-testid="age-chart" />,
  };
});
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));
// The weight-for-height chart is NOT mocked: these tests render its real SVG.
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: () => {} }),
}));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ACH_ID = 'achondroplasia-clarity';
const AGE_AXIS_MARKER_NOTE = 'SDSが±5を超える点、または身長・体重が縦軸の表示範囲を超える点は▲で表示します。縦軸範囲外の点は上下端に表示し、横軸の年齢範囲外の点は表示しません。';
const WFH_MARKER_NOTE = 'SDSが±5を超える点、またはSDSを算出できない点は、グラフの表示範囲内では▲で表示します。表示範囲外の点は端に移動せず、描画せずに注記します。';
const markerNote = () => screen.getByTestId('outlier-marker-note');
const referenceSelect = () => screen.getByLabelText('成長基準') as HTMLSelectElement;
const selectReference = (value: string) => fireEvent.change(referenceSelect(), { target: { value } });
const viewGroup = () => screen.queryByRole('group', { name: '表示するグラフ' });
const clickView = (name: '身長・体重' | '身長別体重') => fireEvent.click(screen.getByRole('button', { name }));

type Row = { id: string; date: Date; height?: number | string; weight?: number | string };
function renderScenario(measurements: Row[], overrides: Record<string, unknown> = {}) {
  state.scenario = {
    childId: 'ach-test',
    birthDate: new Date(2020, 0, 1),
    sex: '男子',
    gestationalWeeks: 40,
    gestationalDays: 0,
    measurements,
    ...overrides,
  };
  return render(React.createElement(GrowthDashboard));
}

const rowsOf = (container: HTMLElement) => Array.from(container.querySelectorAll('#results-section tbody tr'));
const wfhTableCells = (container: HTMLElement) => rowsOf(container).map(tr => tr.querySelectorAll('td')[4]?.textContent ?? '');
const wfhCardValues = () =>
  screen.queryAllByText('身長別体重SDS', { selector: 'dt' }).map(dt => dt.nextElementSibling?.textContent ?? '');

// Boys, 2020-01-01 birth. The weights/heights give these fixed weight-for-height results (independent arithmetic on
// the Table S2 CSV cells): 95 cm / 23.33 kg -> +1.4984; 141 cm is above the boys' 140 cm limit.
const MIXED: Row[] = [
  { id: 'a', date: new Date(2023, 0, 1), height: 95, weight: 23.33 },
  { id: 'b', date: new Date(2023, 6, 1), height: 141, weight: 60 },
  { id: 'c', date: new Date(2024, 0, 1), height: 100 },
  { id: 'd', date: new Date(2024, 6, 1), height: 'abc', weight: 20 },
];

describe('GrowthDashboard: weight-for-height chart switch', () => {
  it('is shown only for CLARITY and defaults to the age-based chart', () => {
    renderScenario(MIXED);
    expect(viewGroup()).toBeNull();
    expect(screen.getByTestId('age-chart')).toBeInTheDocument();
    expect(markerNote()).toHaveTextContent(AGE_AXIS_MARKER_NOTE);

    selectReference(ACH_ID);
    expect(viewGroup()).not.toBeNull();
    expect(screen.getByRole('button', { name: '身長・体重' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '身長別体重' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('age-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('wfh-chart-svg')).toBeNull();
    expect(markerNote()).toHaveTextContent(AGE_AXIS_MARKER_NOTE);
  });

  it('swaps the chart without changing the reference, the entered data or the form props', () => {
    const { container } = renderScenario(MIXED);
    selectReference(ACH_ID);
    const formBefore = JSON.stringify(state.formProps);
    const resultsBefore = container.querySelector('#results-section')!.textContent;

    clickView('身長別体重');
    expect(screen.getByTestId('wfh-chart-svg')).toBeInTheDocument();
    expect(screen.queryByTestId('age-chart')).toBeNull();
    expect(referenceSelect().value).toBe(ACH_ID);
    expect(JSON.stringify(state.formProps)).toBe(formBefore);
    expect(container.querySelector('#results-section')!.textContent).toBe(resultsBefore);
    expect(screen.getByRole('button', { name: '身長別体重' })).toHaveAttribute('aria-pressed', 'true');
    expect(markerNote()).toHaveTextContent(WFH_MARKER_NOTE);
    expect(markerNote()).not.toHaveTextContent('上下端に表示');

    clickView('身長・体重');
    expect(screen.getByTestId('age-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('wfh-chart-svg')).toBeNull();
    expect(JSON.stringify(state.formProps)).toBe(formBefore);
    expect(markerNote()).toHaveTextContent(AGE_AXIS_MARKER_NOTE);
    expect(markerNote()).not.toHaveTextContent('端に移動せず');
  });

  it('does not use the age presets in the weight-for-height view, and the form data holds no chart-view field', () => {
    renderScenario(MIXED);
    selectReference(ACH_ID);
    expect(screen.getByText('表示範囲:')).toBeInTheDocument();
    clickView('身長別体重');
    expect(screen.queryByText('表示範囲:')).toBeNull();
    // Saved/loaded data goes through the form; the view is not part of it.
    expect(Object.keys(state.formProps!.initialData).sort()).not.toContain('chartView');
  });

  it('returns to the conventional Japanese display when the reference is switched back', () => {
    const { container } = renderScenario(MIXED);
    selectReference(ACH_ID);
    clickView('身長別体重');
    selectReference('japanese');
    expect(viewGroup()).toBeNull();
    expect(screen.queryByTestId('wfh-chart-svg')).toBeNull();
    expect(screen.getByTestId('age-chart')).toBeInTheDocument();
    expect(screen.queryByText('身長別体重SDS', { selector: 'th' })).toBeNull();
    expect(screen.queryAllByText('身長別体重SDS', { selector: 'dt' })).toHaveLength(0);
    expect(within(container.querySelector('#results-section') as HTMLElement).getAllByText(/BMI/).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/身長別体重/);
  });
});

describe('GrowthDashboard: weight-for-height SDS column and cards', () => {
  it('shows the SDS or the reason per row, with the table and the mobile cards agreeing', () => {
    const { container } = renderScenario(MIXED);
    selectReference(ACH_ID);
    const cells = wfhTableCells(container);
    expect(cells).toHaveLength(4);
    expect(cells[0]).toBe('1.50SD');
    expect(cells[1]).toMatch(/基準範囲外/);
    expect(cells[1]).toMatch(/50〜140cm/);
    expect(cells[2]).toMatch(/身長と体重の両方が必要/);
    expect(cells[3]).toMatch(/入力が不正なため算出しません/);
    expect(wfhCardValues()).toEqual(cells);
  });

  it('applies the girls range (50-134 cm) to girls', () => {
    const { container } = renderScenario(
      [{ id: 'g', date: new Date(2030, 0, 1), height: 135, weight: 40 }],
      { sex: '女子' },
    );
    selectReference(ACH_ID);
    expect(wfhTableCells(container)[0]).toMatch(/50〜134cm/);
  });

  it('is separate from the age-based weight SDS and carries no obesity percentage, classification or judgment colour', () => {
    const { container } = renderScenario([MIXED[0]]);
    selectReference(ACH_ID);
    const headers = Array.from(container.querySelectorAll('#results-section thead th')).map(th => th.textContent ?? '');
    expect(headers.some(h => h.startsWith('体重 (SDS)'))).toBe(true);
    expect(headers.some(h => h.startsWith('身長別体重SDS'))).toBe(true);

    // Age-based weight SDS at exactly 36 completed months, by arithmetic on the age-based CLARITY CSV row (boys).
    const row = ACHONDROPLASIA_CLARITY_CSV_ROWS.find(r => r[0] === 0 && r[1] === 36)!;
    const [, , , , wtMean, wtLower, wtUpper] = row;
    const ageBased = (23.33 - wtMean) / (23.33 > wtMean ? wtUpper : wtLower);
    expect(ageBased.toFixed(2)).not.toBe('1.50');
    const cells = rowsOf(container)[0].querySelectorAll('td');
    expect(cells[3].textContent).toContain(`${ageBased.toFixed(2)}SD`);
    expect(cells[4].textContent).toBe('1.50SD');

    const wfhCell = cells[4];
    expect(wfhCell.innerHTML).not.toMatch(/text-red|text-amber|font-bold/);
    expect(wfhCell.textContent).not.toMatch(/肥満|やせ|%/);
  });

  it('keeps one invalid or missing value from blocking the other evaluations', () => {
    const { container } = renderScenario([
      { id: 'h', date: new Date(2021, 0, 1), height: 71.9 },
      { id: 'w', date: new Date(2022, 0, 1), weight: 12 },
    ]);
    selectReference(ACH_ID);
    const rows = rowsOf(container);
    expect(rows[0].querySelectorAll('td')[2].textContent).toMatch(/SD/); // height-only row keeps its age-based height SDS
    expect(rows[1].querySelectorAll('td')[3].textContent).toMatch(/SD/); // weight-only row keeps its age-based weight SDS
    expect(wfhTableCells(container).every(t => /身長と体重の両方が必要/.test(t))).toBe(true);
  });

  it('is evaluated while the gestational status holds the age-based SDS', () => {
    const { container } = renderScenario([MIXED[0]], { gestationalWeeks: Number.NaN });
    selectReference(ACH_ID);
    const cells = rowsOf(container)[0].querySelectorAll('td');
    expect(cells[3].textContent).toMatch(/在胎情報要確認/);
    expect(cells[4].textContent).toBe('1.50SD');
  });
});

describe('GrowthDashboard: weight-for-height output target (DOM structure only; not a real print/PNG check)', () => {
  it('has one print/PNG target containing the real weight-for-height SVG and a caption naming CLARITY・米国, 身長別体重 and the child', () => {
    const { container } = renderScenario(MIXED);
    selectReference(ACH_ID);
    clickView('身長別体重');
    const targets = container.querySelectorAll('#printable-chart-area');
    expect(targets).toHaveLength(1);
    expect(container.querySelectorAll('#printable-chart-area-wrapper')).toHaveLength(1);
    const target = targets[0] as HTMLElement;
    expect(target.querySelector('svg[data-testid="wfh-chart-svg"]')).not.toBeNull();
    const caption = within(target).getByTestId('wfh-chart-caption');
    expect(caption).toHaveTextContent('CLARITY・米国');
    expect(caption).toHaveTextContent('身長別体重');
    expect(caption).toHaveTextContent('ach-test');
    expect(target.textContent).not.toMatch(/歳|年齢|月齢/);
    expect(within(target).queryByTestId('chart-legend')).not.toBeNull(); // on-screen legend (hidden when printing by CSS)
  });

  it('shows the selected graph kind in the child information block that is printed', () => {
    renderScenario(MIXED);
    selectReference(ACH_ID);
    expect(screen.queryByText('表示グラフ')).toBeNull();
    clickView('身長別体重');
    expect(screen.getByText('表示グラフ').parentElement).toHaveTextContent('身長別体重');
  });

  it('plots only same-row valid height/weight pairs, in measurement-date order, at their own positions', () => {
    // Entered out of date order on purpose.
    const reversed = [...MIXED].reverse();
    const { container } = renderScenario(reversed);
    selectReference(ACH_ID);
    clickView('身長別体重');
    const ids = Array.from(container.querySelectorAll('[data-testid="wfh-point"]')).map(m => m.getAttribute('data-point-id'));
    // c (height only) and d (invalid height) are not pairs; b (141 cm) is a pair without an SDS and is drawn as a triangle.
    expect(ids).toEqual(['a', 'b']);
    const b = container.querySelector('[data-point-id="b"]')!;
    expect(b.querySelector('polygon')).not.toBeNull();
    expect(b.querySelector('title')!.textContent).toContain('基準の身長範囲外');
  });
});
