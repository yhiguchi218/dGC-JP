import * as d3 from 'd3';
import { describe, expect, it } from 'vitest';
import { ACHONDROPLASIA_CHART_PRESETS, CHART_PRESETS, type ChartPreset } from './GrowthChart';
import { getAchondroplasiaSdLine } from '../lib/achondroplasia-growth';
import { calculatePointVisualMode } from '../lib/chart-utils';

// Same SD levels the chart draws for both indicators in achondroplasia mode.
const SD_LEVELS = [-3, -2.5, -2, -1, 0, 1, 2];
const INNER_HEIGHT = 1000; // arbitrary plot height in px; every check below is a fraction of it
const SEXES = ['male', 'female'] as const;

/** Rendered y (px, 0 = top of the plot) of every background-line point, built with the same scale the chart uses. */
const renderedLines = (preset: ChartPreset, sex: 'male' | 'female', indicator: 'height' | 'weight') => {
  const scale = d3.scaleLinear()
    .domain(indicator === 'height' ? preset.yHeightRange : preset.yWeightRange)
    .range([INNER_HEIGHT, 0]);
  const byMonth = new Map<number, number[]>();
  for (const z of SD_LEVELS) {
    for (const p of getAchondroplasiaSdLine(sex, indicator, z)) {
      if (p.age < preset.xRange[0] || p.age > preset.xRange[1]) continue;
      const month = Math.round(p.age * 12);
      byMonth.set(month, [...(byMonth.get(month) ?? []), scale(p.value)]);
    }
  }
  return byMonth;
};

const cases = ACHONDROPLASIA_CHART_PRESETS.flatMap(preset => SEXES.map(sex => ({ label: `${preset.name} / ${sex}`, preset, sex })));

describe('achondroplasia chart axes: rendered height and weight background lines', () => {
  it('covers 3 presets x 2 sexes', () => {
    expect(cases).toHaveLength(6);
  });

  it.each(cases)('keeps every line inside the plot with a margin at the top and bottom ($label)', ({ preset, sex }) => {
    for (const indicator of ['height', 'weight'] as const) {
      const ys = [...renderedLines(preset, sex, indicator).values()].flat();
      expect(ys.length).toBeGreaterThan(0);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(INNER_HEIGHT * 0.03);
      expect(Math.max(...ys)).toBeLessThanOrEqual(INNER_HEIGHT * 0.99);
    }
  });

  // The separation condition is per age: at the same age the highest weight line must be below the lowest height
  // line. Bands across different ages are not required to be separated (for 0-18 years they cannot be).
  it.each(cases)('places the weight lines below the height lines at every age with a gap ($label)', ({ preset, sex }) => {
    const height = renderedLines(preset, sex, 'height');
    const weight = renderedLines(preset, sex, 'weight');
    expect([...weight.keys()]).toEqual([...height.keys()]);
    for (const [month, heightYs] of height) {
      const lowestHeightLineY = Math.max(...heightYs); // largest y = lowest on screen
      const highestWeightLineY = Math.min(...(weight.get(month) as number[]));
      expect(highestWeightLineY - lowestHeightLineY, `month ${month}`).toBeGreaterThanOrEqual(INNER_HEIGHT * 0.1);
    }
  });
});

describe('achondroplasia chart axes: configuration', () => {
  it('keeps the same preset ids, names and x ranges as the Japanese presets (the dashboard maps presets by id)', () => {
    expect(ACHONDROPLASIA_CHART_PRESETS.map(p => [p.id, p.name, p.xRange])).toEqual(
      CHART_PRESETS.map(p => [p.id, p.name, p.xRange]),
    );
  });

  it.each(ACHONDROPLASIA_CHART_PRESETS)('has no negative ticks and aligned height/weight grid intervals ($name)', preset => {
    const [h0, h1] = preset.yHeightRange;
    const [w0, w1] = preset.yWeightRange;
    const weightStep = preset.weightTickStep as number;
    expect(h0).toBeGreaterThanOrEqual(0);
    expect(w0).toBeGreaterThanOrEqual(0);
    expect(weightStep).toBeGreaterThan(0);
    // The chart draws height ticks every 10 cm; the right-axis ticks must land on the same grid lines.
    expect((h1 - h0) % 10).toBe(0);
    expect((w1 - w0) % weightStep).toBe(0);
    expect((h1 - h0) / 10).toBe((w1 - w0) / weightStep);
    expect(preset.maxWeightLabel).toBe(w1);
  });

  it('leaves the Japanese presets unchanged', () => {
    expect(CHART_PRESETS.map(p => [p.id, p.yHeightRange, p.yWeightRange])).toEqual([
      ['0〜24ヶ月', [30, 100], [0, 35]],
      ['0歳〜6歳', [30, 130], [0, 100]],
      ['0歳〜18歳', [30, 190], [0, 160]],
    ]);
    expect(CHART_PRESETS.some(p => p.weightTickStep !== undefined || p.maxWeightLabel !== undefined)).toBe(false);
  });

  it.each(ACHONDROPLASIA_CHART_PRESETS)('still marks off-chart values with the out-of-range marker at the axis edge ($name)', preset => {
    for (const range of [preset.yHeightRange, preset.yWeightRange]) {
      const inside = calculatePointVisualMode(range[1], undefined, range);
      expect(inside.isOutlier).toBe(false);
      const above = calculatePointVisualMode(range[1] + 0.1, undefined, range);
      expect(above.isOutlier).toBe(true);
      expect(above.marker).toBe('▲');
      expect(above.plottedValue).toBe(range[1]);
    }
  });
});
