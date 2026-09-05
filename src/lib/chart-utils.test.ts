import { describe, it, expect } from 'vitest';
import { calculatePointVisualMode } from './chart-utils';

describe('Chart Utils Point Visual Modes', () => {
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
});
