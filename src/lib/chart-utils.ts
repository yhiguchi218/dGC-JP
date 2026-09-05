import { CLINICAL_LIMITS } from './constants';

export interface PointVisualMode {
  isOutlier: boolean;
  isCorrected: boolean;
  plottedValue: number;
  marker: '▲' | '●';
  color: string; // Hex color code
}

/**
 * Determines marker shape, color, and clamped coordinate for a growth chart point.
 */
export function calculatePointVisualMode(
  value: number,
  zScore: number | undefined,
  range: [number, number],
  isCorrected: boolean = false,
  genderColor: string = '#2563eb'
): PointVisualMode {
  const isExtremeZ = Math.abs(zScore || 0) > CLINICAL_LIMITS.SD_OUTLIER_THRESHOLD;
  const isOffChart = value < range[0] || value > range[1];
  const isOutlier = isExtremeZ || isOffChart;

  const plottedValue = Math.max(range[0], Math.min(range[1], value));
  const marker = isOutlier ? '▲' : '●';
  const color = isOutlier ? '#f97316' : (isCorrected ? '#10b981' : genderColor);

  return {
    isOutlier,
    isCorrected,
    plottedValue,
    marker,
    color,
  };
}
