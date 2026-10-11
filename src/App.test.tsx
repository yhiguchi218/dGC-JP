// @vitest-environment jsdom

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/GrowthDashboard', () => ({
  default: () => (
    <div data-testid="growth-dashboard">Growth Dashboard Mock</div>
  ),
}));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('App Rendering', () => {
  it('renders the dashboard without review authentication', () => {
    render(<App />);

    expect(screen.getByTestId('growth-dashboard')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('レビュー用パスワード', { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'レビュー用パスワードを入力してアプリケーションにアクセス',
      }),
    ).not.toBeInTheDocument();
  });

  it('preserves the skip link', () => {
    render(<App />);

    expect(
      screen.getByRole('link', {
        name: 'メインコンテンツにスキップする',
      }),
    ).toHaveAttribute('href', '#main-content');
  });
});