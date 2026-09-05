import { CLINICAL_LIMITS } from './constants';

export interface PointVisualMode {
  isOutlier: boolean;
  isCorrected: boolean;
  plottedValue: number;
  marker: '▲' | '●';
  color: string; // Hex color code
}

export interface ChartThemeColors {
  background: string;
  gridLine: string;
  border: string;
  axisText: string;
  axisTitle: string;
  labelBgStroke: string;
  labelText: string;
  genderColor: string;
  genderLightColor: string;
  outlierColor: string;
  correctedColor: string;
}

export function getChartThemeColors(isDarkMode: boolean, sex: '男子' | '女子'): ChartThemeColors {
  if (isDarkMode) {
    return {
      background: '#18181b', // zinc-900
      gridLine: '#27272a',   // zinc-800
      border: '#52525b',     // zinc-600
      axisText: '#d4d4d8',   // zinc-300
      axisTitle: sex === '男子' ? '#60a5fa' : '#f472b6',
      labelBgStroke: '#18181b',
      labelText: '#e4e4e7',  // zinc-200
      genderColor: sex === '男子' ? '#3b82f6' : '#ec4899',
      genderLightColor: sex === '男子' ? '#93c5fd' : '#f9a8d4',
      outlierColor: '#fb923c', // orange-400
      correctedColor: '#34d399', // emerald-400
    };
  }

  return {
    background: '#ffffff',
    gridLine: '#f3f4f6',
    border: '#9ca3af',
    axisText: '#374151',
    axisTitle: sex === '男子' ? '#2563eb' : '#db2777',
    labelBgStroke: '#ffffff',
    labelText: '#374151',
    genderColor: sex === '男子' ? '#2563eb' : '#db2777',
    genderLightColor: sex === '男子' ? '#60a5fa' : '#f472b6',
    outlierColor: '#f97316',
    correctedColor: '#10b981',
  };
}

/**
 * Determines marker shape, color, and clamped coordinate for a growth chart point.
 */
export function calculatePointVisualMode(
  value: number,
  zScore: number | undefined,
  range: [number, number],
  isCorrected: boolean = false,
  genderColor: string = '#2563eb',
  outlierColor: string = '#f97316',
  correctedColor: string = '#10b981'
): PointVisualMode {
  const isExtremeZ = Math.abs(zScore || 0) > CLINICAL_LIMITS.SD_OUTLIER_THRESHOLD;
  const isOffChart = value < range[0] || value > range[1];
  const isOutlier = isExtremeZ || isOffChart;

  const plottedValue = Math.max(range[0], Math.min(range[1], value));
  const marker = isOutlier ? '▲' : '●';
  const color = isOutlier ? outlierColor : (isCorrected ? correctedColor : genderColor);

  return {
    isOutlier,
    isCorrected,
    plottedValue,
    marker,
    color,
  };
}
