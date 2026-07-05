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

    expect(screen.getByText(/身長は正の値を入力してください/)).toBeInTheDocument();
    expect(screen.getByText(/体重は正の値を入力してください/)).toBeInTheDocument();
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

  it('displays warning when gestational weeks < 22', () => {
    const handleDataChange = vi.fn();
    const dataWithPrematureWarning = {
      ...defaultInitialData,
      gestationalWeeks: 20
    };
    render(<GrowthForm initialData={dataWithPrematureWarning} onDataChange={handleDataChange} />);
    expect(screen.getByText(/22週未満は22週0日として計算されます/)).toBeInTheDocument();
  });

  it('displays warning when gestational weeks >= 44', () => {
    const handleDataChange = vi.fn();
    const dataWithPosttermWarning = {
      ...defaultInitialData,
      gestationalWeeks: 45
    };
    render(<GrowthForm initialData={dataWithPosttermWarning} onDataChange={handleDataChange} />);
    expect(screen.getByText(/44週以上は44週0日として計算されます/)).toBeInTheDocument();
  });

  it('displays warning when measurement date is before birth date', () => {
    const handleDataChange = vi.fn();
    const dataBeforeBirth = {
      ...defaultInitialData,
      measurements: [
        { id: '1', date: new Date(2019, 0, 1), height: 100, weight: 15 } // Before Jan 1 2020
      ]
    };
    render(<GrowthForm initialData={dataBeforeBirth} onDataChange={handleDataChange} />);
    expect(screen.getByText(/測定日が生年月日より前です/)).toBeInTheDocument();
  });

  it('displays warning when age > 18', () => {
    const handleDataChange = vi.fn();
    const dataOverAge = {
      ...defaultInitialData,
      birthDate: new Date(2000, 0, 1),
      measurements: [
        { id: '1', date: new Date(2025, 0, 1), height: 170, weight: 70 } // 25 years old
      ]
    };
    render(<GrowthForm initialData={dataOverAge} onDataChange={handleDataChange} />);
    expect(screen.getByText(/18歳を超えています/)).toBeInTheDocument();
  });

  it('handles JSON import with backward compatibility ("male" -> "男子")', async () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    
    const fileData = {
      childId: '005',
      birthDate: '2020/01/01',
      sex: 'male',
      gestationalWeeks: 38,
      gestationalDays: 2,
      measurements: [
        { id: 'm1', date: '2020/07/01', height: 75.5, weight: 9.8 }
      ]
    };

    const file = new File([JSON.stringify(fileData)], 'patient.json', { type: 'application/json' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait a brief tick for file reader onload to execute
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(handleDataChange).toHaveBeenCalledWith(expect.objectContaining({
      childId: '005',
      sex: '男子',
      gestationalWeeks: 38,
      gestationalDays: 2
    }));
  });

  it('handles invalid JSON import gracefully showing error alert', async () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    
    // Stub alert to prevent crash in jsdom
    const originalAlert = window.alert;
    window.alert = vi.fn();

    const file = new File(['{ invalid json }'], 'corrupted.json', { type: 'application/json' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('ファイルの読み込みに失敗しました'));
    window.alert = originalAlert;
  });

  it('supports keyboard navigation using the Enter key to move focus', () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

    const dateInput = container.querySelector('input[id^="date-"]') as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();

    // 1. Focus date input and press Enter
    dateInput.focus();
    expect(document.activeElement?.id).toBe(dateInput.id);

    fireEvent.keyDown(dateInput, { key: 'Enter' });
    
    // Query the height input after the event
    const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;
    expect(heightInput).toBeInTheDocument();
    expect(document.activeElement?.id).toBe(heightInput.id);

    // 2. Focus height input and press Enter
    fireEvent.keyDown(heightInput, { key: 'Enter' });
    
    // Query the weight input after the event
    const weightInput = container.querySelector('input[id^="weight-"]') as HTMLInputElement;
    expect(weightInput).toBeInTheDocument();
    expect(document.activeElement?.id).toBe(weightInput.id);
  });
});
