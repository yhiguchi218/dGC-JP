// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthDashboard, { getSuwaHVSDSClass } from './GrowthDashboard';

expect.extend(matchers);

vi.mock('./GrowthChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'growth-chart' }),
  CHART_PRESETS: [
    { id: 'preset-1', name: 'Preset 1' },
    { id: 'preset-2', name: 'Preset 2' },
    { id: 'preset-3', name: 'Preset 3' },
  ],
}));

vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));

vi.mock('./GrowthForm', () => ({
  default: ({ onDataChange }: { onDataChange: (data: unknown) => void }) => (
    React.createElement(React.Fragment, null,
      React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: 0,
          measurements: [
            { id: '1', date: new Date(2020, 0, 1), height: 45, weight: 2.2 },
            { id: '2', date: new Date(2021, 0, 1), height: 74, weight: 9.2 },
          ],
        }),
      }, '早産児データを表示'),
      React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'corrected-age-zero',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 34,
          gestationalDays: 0,
          measurements: [{ id: '1', date: new Date(2020, 1, 12), height: 54, weight: 4.2 }],
        }),
      }, '修正年齢0のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm-valid-days-six',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: 6,
          measurements: [],
        }),
      }, '35週6日のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm-invalid-days-seven',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: 7,
          measurements: [],
        }),
      }, '35週7日のデータを表示')
      , React.createElement('button', {
        type: 'button',
        onClick: () => onDataChange({
          childId: 'preterm-invalid-days-nan',
          birthDate: new Date(2020, 0, 1),
          sex: '女子',
          gestationalWeeks: 35,
          gestationalDays: Number.NaN,
          measurements: [],
        }),
      }, '35週NaN日のデータを表示')
    )
  ),
}));

describe('Suwa HV-SDS display styling', () => {
  it('emphasizes values beyond the abnormal threshold', () => {
    expect(getSuwaHVSDSClass(2.1, '男子')).toBe('text-orange-500 dark:text-orange-400 font-bold');
    expect(getSuwaHVSDSClass(-2.1, '女子')).toBe('text-orange-500 dark:text-orange-400 font-bold');
  });

  it('uses the sex-specific normal style at the inclusive threshold', () => {
    expect(getSuwaHVSDSClass(2.0, '男子')).toBe('text-blue-500 dark:text-blue-400 font-medium');
    expect(getSuwaHVSDSClass(-2.0, '女子')).toBe('text-pink-500 dark:text-pink-400 font-medium');
  });
});

describe('GrowthDashboard responsive results content', () => {
  it('provides four accessible quick-navigation anchors for page sections', () => {
    render(React.createElement(GrowthDashboard));

    const navigation = screen.getByRole('navigation', { name: '画面内ナビゲーション' });
    expect(navigation).toHaveTextContent('入力');
    expect(navigation).toHaveTextContent('成長曲線');
    expect(navigation).toHaveTextContent('評価結果');
    expect(navigation).toHaveTextContent('HV');

    expect(screen.getByRole('link', { name: '入力' })).toHaveAttribute('href', '#input-section');
    expect(screen.getByRole('link', { name: '成長曲線' })).toHaveAttribute('href', '#chart-section');
    expect(screen.getByRole('link', { name: '評価結果' })).toHaveAttribute('href', '#results-section');
    expect(screen.getByRole('link', { name: 'HV' })).toHaveAttribute('href', '#hv-section');

    ['input-section', 'chart-section', 'results-section', 'hv-section'].forEach((id) => {
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
    });
  });

  it.each([
    ['早産児データを表示', '35週0日', true],
    ['35週6日のデータを表示', '35週6日', true],
  ])('displays valid gestational days and preterm correction status: %s', (buttonName, gestationalAge, expected) => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    expect(screen.getByText(gestationalAge)).toBeInTheDocument();
    expect(screen.queryByText('(早産期修正)')).toBe(expected ? screen.getByText('(早産期修正)') : null);
  });

  it.each([
    ['35週7日のデータを表示', '35週7日'],
    ['35週NaN日のデータを表示', 'NaN'],
  ])('does not print invalid gestational days: %s', (buttonName, invalidValue) => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    const gestationalAge = screen.getByText('在胎期間').parentElement;
    expect(gestationalAge).toHaveTextContent('35週（在胎日数要確認）');
    expect(gestationalAge).not.toHaveTextContent(invalidValue);
    expect(gestationalAge).not.toHaveTextContent('(早産期修正)');
  });

  it('does not display preterm correction status for term births', () => {
    render(React.createElement(GrowthDashboard));

    expect(screen.queryByText('(早産期修正)')).toBeNull();
  });

  it('renders separate Raw and Suwa HV cards using the existing calculated results', () => {
    render(React.createElement(GrowthDashboard));

    const rawHVRegions = screen.getAllByRole('region', { name: '直近HV' });
    const suwaHVRegions = screen.getAllByRole('region', { name: '12か月HV（Suwa基準）' });

    expect(rawHVRegions).not.toHaveLength(0);
    expect(suwaHVRegions).toHaveLength(rawHVRegions.length);
    expect(rawHVRegions).not.toContain(suwaHVRegions[0]);
    expect(rawHVRegions[0]).toHaveTextContent(/cm\/年/);
    expect(suwaHVRegions[0]).toHaveTextContent(/cm\/年/);
  });

  it('retains chronological and corrected decimal and full-month ages in measurement cards', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '早産児データを表示' }));

    const measurementCard = screen.getByLabelText('測定日 2021/01/01 の成長評価結果');
    expect(measurementCard).toHaveTextContent(/\d+\.\d{4}歳/);
    expect(measurementCard).toHaveTextContent(/満(?:\d+歳)?\d+ヶ月/);
    expect(measurementCard).toHaveTextContent(/修正 \d+\.\d{4}歳/);
    expect(measurementCard).toHaveTextContent(/修正 満(?:\d+歳)?\d+ヶ月/);
  });

  it('preserves a corrected age of zero in the dashboard display', () => {
    render(React.createElement(GrowthDashboard));
    fireEvent.click(screen.getByRole('button', { name: '修正年齢0のデータを表示' }));

    expect(screen.getByLabelText('測定日 2020/02/12 の成長評価結果')).toHaveTextContent('修正 0.0000歳');
  });

  it('announces and displays the selected obesity calculation basis', () => {
    render(React.createElement(GrowthDashboard));

    const heightButton = screen.getByRole('button', { name: '性別身長別' });
    const ageButton = screen.getByRole('button', { name: '性別年齢別' });
    const measurementCard = screen.getByLabelText('測定日 2020/01/01 の成長評価結果');

    expect(heightButton).toHaveAttribute('aria-pressed', 'true');
    expect(ageButton).toHaveAttribute('aria-pressed', 'false');
    expect(measurementCard).toHaveTextContent('肥満度（身長値ベース）');

    fireEvent.click(ageButton);

    expect(heightButton).toHaveAttribute('aria-pressed', 'false');
    expect(ageButton).toHaveAttribute('aria-pressed', 'true');
    expect(measurementCard).toHaveTextContent('肥満度（年齢別ベース）');
  });
});