// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthChart, { ACHONDROPLASIA_CHART_PRESETS, CHART_PRESETS } from './GrowthChart';
import { HEIGHT_BOYS_LMS, WEIGHT_BOYS_LMS } from '../data/growth-data';
import type { GrowthReference } from '../lib/constants';

expect.extend(matchers);

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: () => {} }),
}));

beforeEach(() => {
  // jsdom has no ResizeObserver; the chart only needs the constructor to exist (it keeps its default 800x1280 size).
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

const renderChart = (growthReference: GrowthReference) => {
  const preset = growthReference === 'achondroplasia-clarity' ? ACHONDROPLASIA_CHART_PRESETS[0] : CHART_PRESETS[0];
  return render(
    <GrowthChart
      growthReference={growthReference}
      sex="男子"
      heightLmsTable={HEIGHT_BOYS_LMS}
      weightLmsTable={WEIGHT_BOYS_LMS}
      heightPoints={[]}
      weightPoints={[]}
      preset={preset}
    />,
  );
};

describe('GrowthChart: 0 SD legend wording per reference', () => {
  it('names the 0 SD line of the CLARITY reference 平均 for both height and weight', () => {
    renderChart('achondroplasia-clarity');
    const legend = within(screen.getByTestId('chart-legend'));
    expect(legend.getByText('身長 平均 (0SD)')).toBeInTheDocument();
    expect(legend.getByText('体重 平均 (0SD)')).toBeInTheDocument();
    expect(legend.queryByText(/中央値/)).not.toBeInTheDocument();
  });

  it('names the 0 SD line of the Japanese reference 中央値 for both height and weight', () => {
    renderChart('japanese');
    const legend = within(screen.getByTestId('chart-legend'));
    expect(legend.getByText('身長 中央値 (0SD)')).toBeInTheDocument();
    expect(legend.getByText('体重 中央値 (0SD)')).toBeInTheDocument();
    expect(legend.queryByText(/平均/)).not.toBeInTheDocument();
  });

  it('draws the CLARITY 0 SD labels as 平均 in the SVG, and 中央値 appears nowhere in the PNG source area', async () => {
    const { container } = renderChart('achondroplasia-clarity');
    // Only the chart's own SVG (not the lucide icon SVGs, the legend, or the screen-reader description).
    const svg = container.querySelector('svg[role="img"][aria-describedby="chart-description"]') as SVGSVGElement;
    expect(svg).not.toBeNull();

    // D3 draws in an effect from the component's default size, so no ResizeObserver notification is needed;
    // waitFor makes sure the assertion is made against the drawn SVG, not an empty one.
    await waitFor(() => {
      const svgTexts = Array.from(svg.querySelectorAll('text')).map(node => node.textContent?.trim());
      expect(svgTexts).toContain('身長 (cm)');
      expect(svgTexts).toContain('体重 (kg)');
      // One 0 SD label per indicator: height and weight.
      expect(svgTexts.filter(text => text === '平均')).toHaveLength(2);
    });

    const labels = Array.from(svg.querySelectorAll('text')).filter(node => node.textContent?.trim() === '平均');
    const labelYs = labels.map(node => Number(node.getAttribute('y')));
    expect(labelYs.every(Number.isFinite)).toBe(true);
    expect(new Set(labelYs).size).toBe(2);

    const chartArea = container.querySelector('#printable-chart-area') as HTMLElement;
    expect(chartArea).not.toBeNull();
    expect(chartArea).toContainElement(svg);
    expect(chartArea.textContent).not.toContain('中央値');
  });
});
