// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthDashboard from './GrowthDashboard';

expect.extend(matchers);

vi.mock('./GrowthChart', () => ({
  default: ({ heightPoints, weightPoints }: { heightPoints: Array<unknown>; weightPoints: Array<unknown> }) => React.createElement('div', {
    'data-testid': 'growth-chart',
    'data-height-points': heightPoints.length,
    'data-weight-points': weightPoints.length,
  }),
  CHART_PRESETS: [
    { id: 'preset-1', name: 'Preset 1' },
    { id: 'preset-2', name: 'Preset 2' },
    { id: 'preset-3', name: 'Preset 3' },
  ],
}));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));

// Real form and dashboard: default boys data, row 2 = 2021/01/01, 75 cm (附表1 mean, SDS 0.00), 9.5 kg.
describe('manual height input through the real form to the dashboard', () => {
  const card = () => screen.getByLabelText('測定日 2021/01/01 の成長評価結果');
  const chart = () => screen.getByTestId('growth-chart');

  it.each(['1e2', '-5', '1,000', '100cm', '.', '1..2'])('keeps %j, withholds the height-dependent evaluations, and does not keep the previous valid result', (typed) => {
    const { container } = render(<GrowthDashboard />);
    const heightInput = container.querySelector('#height-2') as HTMLInputElement;
    expect(card()).toHaveTextContent('0.00SD');
    expect(chart()).toHaveAttribute('data-height-points', '4');

    fireEvent.change(heightInput, { target: { value: typed } });

    expect(heightInput).toHaveValue(typed);
    expect(card()).toHaveTextContent('身長入力が不正です');
    expect(card()).toHaveTextContent(`入力値: ${typed}`);
    // The previous valid SDS (0.00) for 75 cm is not left behind; BMI is not shown.
    expect(card().querySelectorAll('dd')[0]).not.toHaveTextContent('0.00SD');
    expect(card().querySelectorAll('dd')[2]).toHaveTextContent('-');
    expect(chart()).toHaveAttribute('data-height-points', '3');
    // The independent valid weight evaluation remains.
    expect(card().querySelectorAll('dd')[1]).toHaveTextContent(/9\.5kg.*-?\d+\.\d{2}SD/);
    expect(chart()).toHaveAttribute('data-weight-points', '4');
  });

  it('resumes the evaluation after valid -> invalid -> valid editing', () => {
    const { container } = render(<GrowthDashboard />);
    const heightInput = container.querySelector('#height-2') as HTMLInputElement;

    fireEvent.change(heightInput, { target: { value: '75x' } });
    expect(card()).toHaveTextContent('身長入力が不正です');

    fireEvent.change(heightInput, { target: { value: '75' } });
    expect(card()).not.toHaveTextContent('身長入力が不正です');
    expect(card().querySelectorAll('dd')[0]).toHaveTextContent('0.00SD');
    expect(chart()).toHaveAttribute('data-height-points', '4');
  });

  it('treats an emptied height as not entered, not as invalid', () => {
    const { container } = render(<GrowthDashboard />);

    fireEvent.change(container.querySelector('#height-2') as HTMLInputElement, { target: { value: '' } });

    expect(card()).not.toHaveTextContent('不正');
    expect(chart()).toHaveAttribute('data-height-points', '3');
  });
});
