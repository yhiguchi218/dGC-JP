import { describe, it, expect } from 'vitest';
import { calculatePointVisualMode, getChartThemeColors } from './chart-utils';

describe('Chart Utils Point Visual Modes and Theming', () => {
  const normalRange: [number, number] = [30, 190];
  const boyColor = '#2563eb';

  it('should render standard dot for normal measurement within range', () => {
    const result = calculatePointVisualMode(100, 0, normalRange, false, boyColor);
    expect(result.isOutlier).toBe(false);
    expect(result.marker).toBe('●');
    expect(result.color).toBe(boyColor);
    expect(result.plottedValue).toBe(100);
  });

  it('should render green dot for corrected age measurement within range', () => {
    const result = calculatePointVisualMode(75, -1.0, normalRange, true, boyColor);
    expect(result.isOutlier).toBe(false);
    expect(result.isCorrected).toBe(true);
    expect(result.marker).toBe('●');
    expect(result.color).toBe('#10b981');
  });

  it('should render orange triangle outlier for extreme Z-score (> +5SD)', () => {
    const result = calculatePointVisualMode(180, 5.5, normalRange, false, boyColor);
    expect(result.isOutlier).toBe(true);
    expect(result.marker).toBe('▲');
    expect(result.color).toBe('#f97316');
  });

  it('should render orange triangle outlier for extreme Z-score (< -5SD)', () => {
    const result = calculatePointVisualMode(40, -5.2, normalRange, false, boyColor);
    expect(result.isOutlier).toBe(true);
    expect(result.marker).toBe('▲');
    expect(result.color).toBe('#f97316');
  });

  it('should clamp plotted value to chart range and set outlier if value is off-chart', () => {
    // Value > 190
    const overChart = calculatePointVisualMode(210, 3.0, normalRange, false, boyColor);
    expect(overChart.isOutlier).toBe(true);
    expect(overChart.plottedValue).toBe(190);
    expect(overChart.marker).toBe('▲');

    // Value < 30
    const underChart = calculatePointVisualMode(25, -2.0, normalRange, false, boyColor);
    expect(underChart.isOutlier).toBe(true);
    expect(underChart.plottedValue).toBe(30);
    expect(underChart.marker).toBe('▲');
  });

  it('should respect custom outlier and corrected colors for dark mode', () => {
    const darkOutlier = '#fb923c';
    const darkCorrected = '#34d399';
    const darkBoy = '#3b82f6';

    const outlierRes = calculatePointVisualMode(200, 6, normalRange, false, darkBoy, darkOutlier, darkCorrected);
    expect(outlierRes.color).toBe(darkOutlier);

    const correctedRes = calculatePointVisualMode(100, 0, normalRange, true, darkBoy, darkOutlier, darkCorrected);
    expect(correctedRes.color).toBe(darkCorrected);
  });

  it('should return appropriate chart theme color palettes for light and dark modes', () => {
    const lightBoy = getChartThemeColors(false, '男子');
    expect(lightBoy.background).toBe('#ffffff');
    expect(lightBoy.genderColor).toBe('#2563eb');
    expect(lightBoy.axisTitle).toBe('#2563eb');

    const lightGirl = getChartThemeColors(false, '女子');
    expect(lightGirl.genderColor).toBe('#db2777');
    expect(lightGirl.axisTitle).toBe('#db2777');

    const darkBoy = getChartThemeColors(true, '男子');
    expect(darkBoy.background).toBe('#18181b');
    expect(darkBoy.genderColor).toBe('#3b82f6');
    expect(darkBoy.axisTitle).toBe('#60a5fa');
    expect(darkBoy.gridLine).toBe('#27272a');

    const darkGirl = getChartThemeColors(true, '女子');
    expect(darkGirl.genderColor).toBe('#ec4899');
    expect(darkGirl.axisTitle).toBe('#f472b6');
  });
});
