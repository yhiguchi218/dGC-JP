// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthForm from './GrowthForm';

expect.extend(matchers);

describe('GrowthForm Component Integration / E2E Tests', () => {
  const defaultInitialData = {
    childId: '001',
    birthDate: new Date(2020, 0, 1),
    sex: '男子' as const,
    gestationalWeeks: 40,
    gestationalDays: 0,
    measurements: [
      { id: '1', date: new Date(2020, 5, 1), height: 100, weight: 15 }
    ]
  };

  it('renders the form correctly with initial data', () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

    // Check if the infant details card and labels exist via stable element IDs
    const gestationalWeeksInput = container.querySelector('#gestationalWeeks') as HTMLInputElement;
    const gestationalDaysInput = container.querySelector('#gestationalDays') as HTMLInputElement;
    expect(gestationalWeeksInput).toBeInTheDocument();
    expect(gestationalDaysInput).toBeInTheDocument();
    
    // Check if current measurement fields are rendered with values
    const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;
    const weightInput = container.querySelector('input[id^="weight-"]') as HTMLInputElement;
    
    expect(heightInput).toBeInTheDocument();
    expect(weightInput).toBeInTheDocument();
    expect(heightInput.value).toBe('100');
    expect(weightInput.value).toBe('15');
  });

  it('converts full-width characters and filters non-numeric characters automatically (Sanitization)', () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

    const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;
    expect(heightInput).toBeInTheDocument();

    // Simulate inputting full-width digits and extra character: 「１２３．５あ」 -> "123.5"
    fireEvent.change(heightInput, { target: { value: '１２３．５あ' } });

    expect(heightInput.value).toBe('123.5');
    expect(handleDataChange).toHaveBeenCalledWith(expect.objectContaining({
      measurements: [{ id: expect.any(String), date: expect.any(Date), height: '123.5', weight: 15 }]
    }));
  });

  it('displays warnings and applies red border on negative initial values (Upload/Migration Safeguard)', () => {
    const handleDataChange = vi.fn();
    const dataWithNegative = {
      ...defaultInitialData,
      measurements: [
        { id: '1', date: new Date(2020, 5, 1), height: -95, weight: -12 }
      ]
    };
    
    const { container } = render(<GrowthForm initialData={dataWithNegative} onDataChange={handleDataChange} />);

    const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;
    const weightInput = container.querySelector('input[id^="weight-"]') as HTMLInputElement;

    // Ensure negative warning system triggers correct warning class for safety state
    expect(heightInput).toHaveClass('border-red-500');
    expect(weightInput).toHaveClass('border-red-500');

    expect(screen.getByText(/身長に負の値は入力できません/)).toBeInTheDocument();
    expect(screen.getByText(/体重に負の値は入力できません/)).toBeInTheDocument();
  });

  it('can add a new measurement row interactively', async () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

    // Uniquely find the exact button whose text content is exactly '追加'
    const addButton = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.trim() === '追加'
    );
    expect(addButton).toBeDefined();
    if (addButton) {
      fireEvent.click(addButton);
    }

    // After adding, there should be multiple height inputs with dynamic IDs
    const heightInputs = container.querySelectorAll('input[id^="height-"]');
    expect(heightInputs.length).toBe(2);
  });
});
