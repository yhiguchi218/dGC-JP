// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { toPng } from 'html-to-image';
import WeightForHeightChart, {
  WEIGHT_FOR_HEIGHT_CHART_AXES,
  type WeightForHeightChartPoint,
} from './WeightForHeightChart';
import { ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS } from '../data/achondroplasia-clarity-wfh-source-fixture';

expect.extend(matchers);

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: () => {} }),
}));
vi.mock('html-to-image', () => ({ toPng: vi.fn(async () => 'data:image/png;base64,AAAA') }));

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

// Default (jsdom) drawing size of the chart: 800 x 720, margins left 11% / right 4% / top 3% / bottom 13%.
const INNER_WIDTH = 800 - 800 * 0.11 - 800 * 0.04;
const INNER_HEIGHT = 720 - 720 * 0.03 - 720 * 0.13;
const px = (heightCm: number) => ((heightCm - 40) / (150 - 40)) * INNER_WIDTH;
const py = (weightKg: number) => INNER_HEIGHT * (1 - weightKg / 90);

const point = (id: string, date: Date, height: number, weight: number, sds: number | undefined, status: WeightForHeightChartPoint['status'] = 'ok'): WeightForHeightChartPoint =>
  ({ id, date, height, weight, sds, status });

const renderChart = (points: WeightForHeightChartPoint[], sex: '男子' | '女子' = '男子', childId = 'ID-1') =>
  render(<WeightForHeightChart growthReference="achondroplasia-clarity" sex={sex} childId={childId} points={points} />);

describe('WeightForHeightChart axes', () => {
  it('encloses every SD line (-3 to +2 SD) of both sexes over their valid heights, by arithmetic on the CSV cells', () => {
    const { xRange, yRange } = WEIGHT_FOR_HEIGHT_CHART_AXES;
    let min = Infinity;
    let max = -Infinity;
    for (const [, ht, , , mean, lower, upper] of ACHONDROPLASIA_CLARITY_WFH_CSV_ROWS) {
      if (mean === null || lower === null || upper === null) continue;
      expect(ht).toBeGreaterThanOrEqual(xRange[0]);
      expect(ht).toBeLessThanOrEqual(xRange[1]);
      min = Math.min(min, mean - 3 * lower);
      max = Math.max(max, mean + 2 * upper);
    }
    expect(min).toBeGreaterThan(yRange[0]);
    expect(max).toBeLessThan(yRange[1]);
  });
});

describe('WeightForHeightChart real SVG', () => {
  it('draws axis titles, tick axes, the 平均 label and the seven SD lines of the sex, with no age-axis text', () => {
    renderChart([]);
    const svg = screen.getByTestId('wfh-chart-svg');
    const scoped = within(svg);
    expect(scoped.getByText('身長・体長 (cm)')).toBeInTheDocument();
    expect(scoped.getByText('体重 (kg)')).toBeInTheDocument();
    expect(scoped.getByTestId('wfh-x-axis')).toBeInTheDocument();
    expect(scoped.getByTestId('wfh-y-axis')).toBeInTheDocument();
    expect(scoped.getAllByText('平均')).toHaveLength(1);
    expect(scoped.getByText('+2.0SD')).toBeInTheDocument();
    expect(scoped.getByText('-3.0SD')).toBeInTheDocument();
    const lines = Array.from(svg.querySelectorAll('[data-testid="wfh-sd-line"]'));
    expect(lines.map(l => l.getAttribute('data-sds'))).toEqual(['-3', '-2.5', '-2', '-1', '0', '1', '2']);
    expect(svg.textContent).not.toMatch(/歳|年齢|月齢/);
  });

  it('starts every line at its first adopted height (50 cm) and ends at 140 cm for boys and 134 cm for girls', () => {
    const boys = renderChart([]);
    const boyLine = boys.container.querySelector('[data-testid="wfh-sd-line"][data-sds="0"]')!;
    const boyD = boyLine.getAttribute('d')!;
    expect(boyD.startsWith(`M${px(50)}`.slice(0, 7))).toBe(true);
    expect(boyD.split('L')).toHaveLength(91);
    cleanup();
    const girls = renderChart([], '女子');
    const girlLine = girls.container.querySelector('[data-testid="wfh-sd-line"][data-sds="0"]')!;
    expect(girlLine.getAttribute('d')!.split('L')).toHaveLength(85); // no points for 135-140 cm
  });

  it('plots measurements at their own height/weight and joins them in the order given (measurement-date order)', () => {
    const points = [
      point('a', new Date(2023, 0, 1), 80, 12, -0.5),
      point('b', new Date(2023, 6, 1), 90, 15, 0.2),
      point('c', new Date(2024, 0, 1), 100, 19, 0.4),
    ];
    const { container } = renderChart(points);
    const markers = Array.from(container.querySelectorAll('[data-testid="wfh-point"]'));
    expect(markers.map(m => m.getAttribute('data-point-id'))).toEqual(['a', 'b', 'c']);
    const circle = markers[1].querySelector('circle')!;
    expect(Number(circle.getAttribute('cx'))).toBeCloseTo(px(90), 6);
    expect(Number(circle.getAttribute('cy'))).toBeCloseTo(py(15), 6);

    const connectors = Array.from(container.querySelectorAll('[data-testid="wfh-point-connector"]'));
    expect(connectors).toHaveLength(2);
    const num = (el: Element, name: string) => Number(el.getAttribute(name));
    expect(num(connectors[0], 'x1')).toBeCloseTo(px(80), 6);
    expect(num(connectors[0], 'y1')).toBeCloseTo(py(12), 6);
    expect(num(connectors[0], 'x2')).toBeCloseTo(px(90), 6);
    expect(num(connectors[0], 'y2')).toBeCloseTo(py(15), 6);
    expect(num(connectors[1], 'x1')).toBeCloseTo(px(90), 6);
    expect(num(connectors[1], 'x2')).toBeCloseTo(px(100), 6);
  });

  it('draws a point outside the valid height range but inside the axes at its own position, as a triangle (never pinned to the endpoint)', () => {
    // Girls are valid to 134 cm; 145 cm is inside the fixed axes (40-150) but has no reference.
    const { container } = renderChart([point('x', new Date(2030, 0, 1), 145, 40, undefined, 'out-of-range')], '女子');
    const marker = container.querySelector('[data-testid="wfh-point"]')!;
    expect(marker.querySelector('circle')).toBeNull();
    const polygon = marker.querySelector('polygon')!;
    const cx = Number(polygon.getAttribute('points')!.split(' ')[0].split(',')[0]);
    expect(cx).toBeCloseTo(px(145), 6);
    expect(cx).not.toBeCloseTo(px(134), 1);
    expect(marker.querySelector('title')!.textContent).toContain('基準の身長範囲外のためSDS算出不可');
  });

  it('does not draw or connect points outside the fixed axes, and says so', () => {
    const points = [
      point('a', new Date(2023, 0, 1), 80, 12, -0.5),
      point('far', new Date(2023, 6, 1), 200, 100, undefined, 'out-of-range'),
      point('c', new Date(2024, 0, 1), 100, 19, 0.4),
    ];
    const { container } = renderChart(points);
    const ids = Array.from(container.querySelectorAll('[data-testid="wfh-point"]')).map(m => m.getAttribute('data-point-id'));
    expect(ids).toEqual(['a', 'c']);
    expect(container.querySelectorAll('[data-testid="wfh-point-connector"]')).toHaveLength(0);
    expect(screen.getByTestId('wfh-off-chart-note')).toHaveTextContent('1件の測定点は、このグラフの表示範囲');
  });

  it('shows no off-chart note when every point is inside the axes', () => {
    renderChart([point('a', new Date(2023, 0, 1), 80, 12, -0.5)]);
    expect(screen.queryByTestId('wfh-off-chart-note')).not.toBeInTheDocument();
  });
});

describe('WeightForHeightChart output target', () => {
  it('keeps the shared print/PNG ids once, with the SVG and a caption naming CLARITY・米国, 身長別体重, sex and child ID', () => {
    const { container } = renderChart([], '女子', 'ABC-99');
    expect(container.querySelectorAll('#printable-chart-area-wrapper')).toHaveLength(1);
    const area = container.querySelector('#printable-chart-area')!;
    expect(container.querySelectorAll('#printable-chart-area')).toHaveLength(1);
    expect(area.querySelector('[data-testid="wfh-chart-svg"]')).not.toBeNull();
    const caption = within(area as HTMLElement).getByTestId('wfh-chart-caption');
    expect(caption).toHaveTextContent('CLARITY');
    expect(caption).toHaveTextContent('米国');
    expect(caption).toHaveTextContent('身長別体重');
    expect(caption).toHaveTextContent('女子');
    expect(caption).toHaveTextContent('ABC-99');
  });

  it('lists the plotted measurements in the alternative table with the SDS or a reason when it is not calculated', () => {
    renderChart([
      point('a', new Date(2023, 0, 1), 95, 23.33, 1.49843233548101),
      point('b', new Date(2023, 6, 1), 145, 40, undefined, 'out-of-range'),
    ]);
    const table = screen.getByTestId('wfh-data-table');
    expect(within(table).getByText('1.50SD')).toBeInTheDocument();
    expect(within(table).getByText('基準の身長範囲外のためSDS算出不可')).toBeInTheDocument();
  });
});

describe('WeightForHeightChart PNG export call', () => {
  it('captures the shared output target and excludes the on-screen legend from the image', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { container } = renderChart([]);
    fireEvent.click(screen.getByRole('button', { name: '身長別体重のグラフをPNG画像としてダウンロードする' }));
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    const [target, options] = vi.mocked(toPng).mock.calls[0] as [HTMLElement, { filter: (n: HTMLElement) => boolean }];
    expect(target).toBe(container.querySelector('#printable-chart-area'));
    const legend = screen.getByTestId('chart-legend');
    expect(options.filter(legend)).toBe(false);
    expect(options.filter(screen.getByTestId('wfh-chart-svg') as unknown as HTMLElement)).toBe(true);
    clickSpy.mockRestore();
  });
});
