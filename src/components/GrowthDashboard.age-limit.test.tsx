// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthDashboard from './GrowthDashboard';
import { calculateHeightVelocityResults } from '../lib/growth-utils';
import { SUWA_HV_BOYS, SUWA_HV_GIRLS, type HVReferencePoint } from '../data/suwa-hv-data';

expect.extend(matchers);

type Scenario = {
  childId: string;
  birthDate: Date;
  sex: '男子' | '女子';
  gestationalWeeks: number;
  gestationalDays: number;
  measurements: Array<{ id: string; date: Date; height?: number | string; weight?: number | string }>;
};

const scenarioState = vi.hoisted(() => ({ scenario: null as unknown }));

vi.mock('./GrowthForm', () => ({
  default: ({ onDataChange }: { onDataChange: (data: unknown) => void }) => {
    React.useEffect(() => {
      onDataChange(scenarioState.scenario);
    }, [onDataChange]);
    return null;
  },
}));
vi.mock('./GrowthChart', () => ({
  default: () => null,
  CHART_PRESETS: [
    { id: 'preset-1', name: 'Preset 1' },
    { id: 'preset-2', name: 'Preset 2' },
    { id: 'preset-3', name: 'Preset 3' },
  ],
}));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));

afterEach(() => cleanup());

const HEIGHT_NOTICE = '身長SDSは基準表の対象範囲外です（満17歳6か月まで）。';
const WEIGHT_NOTICE = '体重SDSは17歳6か月の基準値を使用した参考値です。';

function renderScenario(measurements: Scenario['measurements'], overrides: Partial<Scenario> = {}) {
  scenarioState.scenario = {
    childId: 'age-limit',
    birthDate: new Date(2000, 0, 1),
    sex: '男子',
    gestationalWeeks: 40,
    gestationalDays: 0,
    measurements,
    ...overrides,
  } satisfies Scenario;
  return render(React.createElement(GrowthDashboard));
}

// Boys born 2000-01-01: 2017-07-01 is 210 completed months, 2017-08-01 is 211.
const AT_210 = new Date(2017, 6, 31);
const AT_211 = new Date(2017, 7, 1);

describe('result-specific age-limit notices', () => {
  it('shows no height or weight notice through 210 completed months, even when the decimal age exceeds 17.5', () => {
    const { container } = renderScenario([{ id: 'a', date: AT_210, height: 176.6, weight: 60 }]);
    expect(container).not.toHaveTextContent(HEIGHT_NOTICE);
    expect(container).not.toHaveTextContent('参考値です');
    expect(container).toHaveTextContent('1.00SD');
  });

  it('shows both notices from 211 completed months, even under 18 years, in the table and the card', () => {
    renderScenario([{ id: 'a', date: AT_211, height: 171, weight: 61 }]);
    expect(screen.getAllByText(HEIGHT_NOTICE)).toHaveLength(2);
    expect(screen.getAllByText(WEIGHT_NOTICE)).toHaveLength(2);
  });

  it('shows the weight notice when the SDS is exactly 0', () => {
    // Boys 17.5 y weight M = 60.9, so 60.9 kg is SDS 0 on the clamped last row.
    renderScenario([{ id: 'a', date: AT_211, height: 171, weight: 60.9 }]);
    expect(screen.getAllByText(/0\.00SD/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(WEIGHT_NOTICE)).toHaveLength(2);
  });

  it('does not show a reference-value notice when the weight is invalid', () => {
    const { container } = renderScenario([{ id: 'a', date: AT_211, height: 171, weight: 'abc' }]);
    expect(container).toHaveTextContent('体重入力が不正です');
    expect(container).not.toHaveTextContent('体重SDSは17歳6か月');
    expect(screen.getAllByText(HEIGHT_NOTICE)).toHaveLength(2);
  });

  it('does not show the reference-value notice when standard evaluation is held', () => {
    const { container } = renderScenario(
      [{ id: 'a', date: new Date(2002, 0, 1), height: 85, weight: 12 }],
      { gestationalWeeks: Number.NaN }
    );
    expect(container).toHaveTextContent('在胎情報要確認');
    expect(container).not.toHaveTextContent('参考値です');
  });

  it('shows the HV-SDS notice from the selected pair midpoint age in the dashboard', () => {
    // Midpoint is about 17.67 years, beyond the boys table's last row (17.5).
    const { container } = renderScenario([
      { id: 'a', date: new Date(2017, 2, 1), height: 170, weight: 60 },
      { id: 'b', date: new Date(2018, 2, 1), height: 171, weight: 61 },
    ]);
    expect(container).toHaveTextContent('HV-SDSは17歳6か月の基準値を使用した参考値です。');
  });

  it('shows no HV-SDS notice when the pair midpoint is within the table', () => {
    const { container } = renderScenario([
      { id: 'a', date: new Date(2016, 0, 1), height: 168, weight: 58 },
      { id: 'b', date: new Date(2017, 0, 1), height: 171, weight: 61 },
    ]);
    expect(container).toHaveTextContent('HV-SDS:');
    expect(container).not.toHaveTextContent('HV-SDSは17歳6か月の基準値を使用した参考値です。');
  });
});

describe('HV-SDS reference-limit flag', () => {
  const point = (age: number, height: number) => ({ date: new Date(2000, 0, 1), age, height });
  const flag = (ages: [number, number], sex: 'male' | 'female') => {
    const table = sex === 'male' ? SUWA_HV_BOYS : SUWA_HV_GIRLS;
    return calculateHeightVelocityResults([point(ages[0], 160), point(ages[1], 166)], sex, table)[0].suwa;
  };

  it('uses the boys limit of 17.5 years: no flag at the limit, flag beyond it', () => {
    expect(flag([17, 18], 'male')?.referenceLimitAge).toBeNull();
    expect(flag([17, 18.01], 'male')?.referenceLimitAge).toBe(17.5);
  });

  it('uses the girls limit of 17.25 years: no flag at the limit, flag beyond it', () => {
    expect(flag([16.75, 17.75], 'female')?.referenceLimitAge).toBeNull();
    expect(flag([16.75, 17.76], 'female')?.referenceLimitAge).toBe(17.25);
  });

  it('is decided by the pair midpoint, not by the current measurement age', () => {
    // Current age 17.95 is beyond 17.5, but the midpoint 17.45 is not.
    expect(flag([16.95, 17.95], 'male')?.referenceLimitAge).toBeNull();
    // Girls: current age 17.5 is beyond 17.25, but the midpoint 17.0 is within the table.
    expect(flag([16.5, 17.5], 'female')?.referenceLimitAge).toBeNull();
  });

  it('is not set when no SDS is calculated (no usable reference SD) or when there is no pair', () => {
    const noSd: HVReferencePoint[] = [
      { age: 17, mean: 1, sd: 1 },
      { age: 17.5, mean: 1, sd: 0 },
    ];
    const suwa = calculateHeightVelocityResults([point(17, 160), point(18, 166)], 'male', noSd)[0].suwa;
    expect(suwa?.sds).toBeNull();
    expect(suwa?.referenceLimitAge).toBeNull();
  });

  it('omits the result row entirely when the interval is below the raw minimum', () => {
    const noResults = calculateHeightVelocityResults(
      [point(17, 160), point(17.4, 163)],
      'male',
      SUWA_HV_BOYS
    );
    expect(noResults).toEqual([]);
  });

  it('keeps a raw-only result row, without Suwa, for a 0.75-year interval', () => {
    const results = calculateHeightVelocityResults(
      [point(17, 160), point(17.75, 163)],
      'male',
      SUWA_HV_BOYS
    );
    expect(results).toHaveLength(1);
    expect(results[0].raw).not.toBeNull();
    expect(results[0].suwa).toBeNull();
  });

  it('keeps the flag null for an HV-SDS of 0 when the midpoint equals the table limit', () => {
    const table: HVReferencePoint[] = [
      { age: 17, mean: 6, sd: 1 },
      { age: 17.5, mean: 6, sd: 1 },
    ];
    const suwa = calculateHeightVelocityResults([point(17, 160), point(18, 166)], 'male', table)[0].suwa;
    expect(suwa).not.toBeNull();
    expect(suwa?.midpointAge).toBe(17.5);
    expect(suwa?.sds).toBe(0);
    expect(suwa?.referenceLimitAge).toBeNull();
  });

  it('is set even when the HV-SDS is exactly 0 and the midpoint is beyond the limit', () => {
    const table: HVReferencePoint[] = [
      { age: 17, mean: 6, sd: 1 },
      { age: 17.5, mean: 6, sd: 1 },
    ];
    const suwa = calculateHeightVelocityResults([point(17.25, 160), point(18.25, 166)], 'male', table)[0].suwa;
    expect(suwa).not.toBeNull();
    expect(suwa?.midpointAge).toBe(17.75);
    expect(suwa?.sds).toBe(0);
    expect(suwa?.referenceLimitAge).toBe(17.5);
  });
});
