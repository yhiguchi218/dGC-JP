// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { toPng } from 'html-to-image';
import GrowthChart, { CHART_PRESETS } from './GrowthChart';
import { HEIGHT_BOYS_LMS, WEIGHT_BOYS_LMS } from '../data/growth-data';

expect.extend(matchers);

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: () => {} }),
}));
vi.mock('html-to-image', () => ({ toPng: vi.fn(async () => 'data:image/png;base64,AAAA') }));

type Point = React.ComponentProps<typeof GrowthChart>['heightPoints'][number];

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
  vi.restoreAllMocks();
  vi.mocked(toPng).mockClear();
});

const renderChart = (heightPoints: Point[], weightPoints: Point[]) =>
  render(
    <GrowthChart
      sex="男子"
      heightLmsTable={HEIGHT_BOYS_LMS}
      weightLmsTable={WEIGHT_BOYS_LMS}
      heightPoints={heightPoints}
      weightPoints={weightPoints}
      preset={CHART_PRESETS[0]}
    />,
  );

/** Body rows of the alternative table as [age cell, height cell, weight cell] texts. */
const tableRows = () => {
  const region = screen.getByRole('region', { name: '測定データ代替テーブル' });
  return within(region).getAllByRole('row').slice(1)
    .map(row => Array.from(row.querySelectorAll('td')).map(td => td.textContent));
};

describe('GrowthChart alternative table pairs height and weight by measurement row', () => {
  it('keeps each row pair when two rows share the same measurement date', () => {
    renderChart(
      [
        { age: 1, value: 80, isCorrected: false, measurementId: 'a' },
        { age: 1, value: 82, isCorrected: false, measurementId: 'b' },
      ],
      // Reverse order: neither the first weight at the same age nor the same array index is used.
      [
        { age: 1, value: 11, isCorrected: false, measurementId: 'b' },
        { age: 1, value: 10, isCorrected: false, measurementId: 'a' },
      ],
    );
    expect(tableRows()).toEqual([
      ['1.0000歳', '80.0 cm', '10.00 kg'],
      ['1.0000歳', '82.0 cm', '11.00 kg'],
    ]);
  });

  it('does not merge a height-only row and a weight-only row on the same date', () => {
    renderChart(
      [{ age: 1, value: 80, isCorrected: false, measurementId: 'height-only' }],
      [{ age: 1, value: 10, isCorrected: false, measurementId: 'weight-only' }],
    );
    expect(tableRows()).toEqual([
      ['1.0000歳', '80.0 cm', '-'],
      ['1.0000歳', '-', '10.00 kg'],
    ]);
  });

  it('pairs calendar points with calendar points and corrected points with corrected points', () => {
    renderChart(
      [
        { age: 1, value: 75, isCorrected: false, measurementId: 'p' },
        { age: 0.8, value: 75, isCorrected: true, measurementId: 'p' },
      ],
      // Distinct weights per kind only to make a swap visible in this component-level test.
      [
        { age: 0.8, value: 9.5, isCorrected: true, measurementId: 'p' },
        { age: 1, value: 9, isCorrected: false, measurementId: 'p' },
      ],
    );
    expect(tableRows()).toEqual([
      ['1.0000歳', '75.0 cm', '9.00 kg'],
      ['0.8000歳修正年齢', '75.0 cm', '9.50 kg'],
    ]);
  });

  it('does not pair points without a measurement id by age proximity', () => {
    renderChart(
      [{ age: 1, value: 80, isCorrected: false }],
      [{ age: 1, value: 10, isCorrected: false }],
    );
    expect(tableRows()).toEqual([
      ['1.0000歳', '80.0 cm', '-'],
      ['1.0000歳', '-', '10.00 kg'],
    ]);
  });

  it('draws the same chart whether or not the points carry a measurement id', () => {
    const heights: Point[] = [{ age: 0.5, value: 67, zScore: 0.1, isCorrected: false }, { age: 0.3, value: 62, zScore: -0.2, isCorrected: true }];
    const weights: Point[] = [{ age: 0.5, value: 7.9, zScore: 0.3, isCorrected: false }, { age: 0.3, value: 6.4, zScore: -0.1, isCorrected: true }];
    const svgMarkup = (container: HTMLElement) => Array.from(container.querySelectorAll('svg')).map(svg => svg.outerHTML);

    const withoutIds = svgMarkup(renderChart(heights, weights).container);
    cleanup();
    const withIds = svgMarkup(renderChart(
      heights.map(p => ({ ...p, measurementId: 'm1' })),
      weights.map(p => ({ ...p, measurementId: 'm1' })),
    ).container);

    expect(withIds).toEqual(withoutIds);
  });
});

describe('GrowthChart PNG export failure', () => {
  it('tells the user when the image cannot be generated and allows a retry', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.mocked(toPng).mockRejectedValueOnce(new Error('render failed'));
    renderChart([{ age: 1, value: 75, isCorrected: false, measurementId: 'a' }], []);
    const button = screen.getByRole('button', { name: '成長曲線をPNG画像としてダウンロードする' });

    fireEvent.click(button);
    await waitFor(() => expect(alertMock).toHaveBeenCalledTimes(1));
    expect(alertMock.mock.calls[0][0]).toContain('画像の出力に失敗しました');
    expect(clickSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(button).toBeEnabled());
    expect(tableRows()).toEqual([['1.0000歳', '75.0 cm', '-']]);

    fireEvent.click(button);
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(toPng).toHaveBeenCalledTimes(2);
    expect(alertMock).toHaveBeenCalledTimes(1);
  });
});
