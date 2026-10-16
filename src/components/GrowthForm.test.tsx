// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthForm from './GrowthForm';

expect.extend(matchers);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it('synchronizes the remaining measurements when one row is deleted', () => {
    const handleDataChange = vi.fn();
    const initialData = {
      ...defaultInitialData,
      childId: 'delete-test',
      sex: '女子' as const,
      gestationalWeeks: 35,
      gestationalDays: 4,
      measurements: [
        { id: 'first', date: new Date(2020, 5, 1), height: 100, weight: 15 },
        { id: 'second', date: new Date(2021, 5, 1), height: 110, weight: 18 },
      ],
    };

    render(<GrowthForm initialData={initialData} onDataChange={handleDataChange} />);
    fireEvent.click(screen.getByRole('button', { name: '2020/06/01の測定データを削除' }));

    expect(screen.queryByRole('button', { name: '2020/06/01の測定データを削除' })).toBeNull();
    expect(screen.getByRole('button', { name: '2021/06/01の測定データを削除' })).toBeInTheDocument();
    expect(handleDataChange).toHaveBeenLastCalledWith({
      childId: 'delete-test',
      birthDate: initialData.birthDate,
      sex: '女子',
      gestationalWeeks: 35,
      gestationalDays: 4,
      measurements: [initialData.measurements[1]],
    });
  });

  it('synchronizes an empty measurement array when the final row is deleted', () => {
    const handleDataChange = vi.fn();
    const initialData = {
      ...defaultInitialData,
      childId: 'delete-final-test',
      gestationalWeeks: 36,
      gestationalDays: 2,
      measurements: [{ id: 'only', date: new Date(2022, 0, 15), height: 90, weight: 13 }],
    };

    render(<GrowthForm initialData={initialData} onDataChange={handleDataChange} />);
    fireEvent.click(screen.getByRole('button', { name: '2022/01/15の測定データを削除' }));

    expect(screen.queryByRole('button', { name: '2022/01/15の測定データを削除' })).toBeNull();
    expect(handleDataChange).toHaveBeenLastCalledWith({
      childId: 'delete-final-test',
      birthDate: initialData.birthDate,
      sex: initialData.sex,
      gestationalWeeks: 36,
      gestationalDays: 2,
      measurements: [],
    });
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

  it('keeps gestational-week drafts uncommitted until a complete integer is confirmed', () => {
    const handleDataChange = vi.fn();
    render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    const weeksInput = screen.getByLabelText('在胎期間 (週)');

    fireEvent.change(weeksInput, { target: { value: '' } });
    expect(weeksInput).toHaveValue('');
    expect(weeksInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/在胎週数は空欄にせず/)).toBeInTheDocument();
    expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({ gestationalWeeks: Number.NaN }));

    for (const draft of ['35.5', '35abc', '-3']) {
      fireEvent.change(weeksInput, { target: { value: draft } });
      fireEvent.blur(weeksInput);
      expect(weeksInput).toHaveValue(draft);
      expect(weeksInput).toHaveAttribute('aria-invalid', 'true');
      expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({ gestationalWeeks: Number.NaN }));
    }

    fireEvent.change(weeksInput, { target: { value: '３５' } });
    fireEvent.keyDown(weeksInput, { key: 'Enter' });
    expect(weeksInput).toHaveValue('35');
    expect(weeksInput).toHaveAttribute('aria-invalid', 'false');
    expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({ gestationalWeeks: 35 }));
  });

  it('does not export JSON while gestational weeks are blank or malformed', () => {
    const handleDataChange = vi.fn();
    const createObjectURL = vi.fn();
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

    fireEvent.change(screen.getByLabelText('在胎期間 (週)'), { target: { value: '35.5' } });
    fireEvent.click(screen.getByRole('button', { name: /現在の入力データをJSONファイル形式/ }));

    expect(window.alert).toHaveBeenCalledWith('在胎週数を有限の整数に修正してからデータを保存してください。');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('keeps invalid gestational days visible and reports them as invalid', () => {
    const handleDataChange = vi.fn();
    render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

    const daysInput = screen.getByLabelText('在胎期間 (日)');
    fireEvent.change(daysInput, { target: { value: '7' } });

    expect(daysInput).toHaveValue('7');
    expect(daysInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('在胎日数は0〜6日の整数で入力してください')).toBeInTheDocument();
    expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({ gestationalDays: 7 }));
  });

  it.each([
    ['7', 7],
    ['', Number.NaN],
    [' ', Number.NaN],
    ['　', Number.NaN],
    ['1e0', Number.NaN],
    ['0x0', Number.NaN],
    ['1.5', Number.NaN],
  ])('does not export JSON for invalid gestational days: %s', (value, expectedDays) => {
    const handleDataChange = vi.fn();
    const createObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

    fireEvent.change(screen.getByLabelText('在胎期間 (日)'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: /現在の入力データをJSONファイル形式/ }));

    expect(window.alert).toHaveBeenCalledWith('在胎日数を0〜6日の整数に修正してからデータを保存してください。');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({ gestationalDays: expectedDays }));
  });

  it.each([0, 6])('exports valid gestational days as a number: %i', (gestationalDays) => {
    const handleDataChange = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:test');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const NativeBlob = Blob;
    let serializedData = '';
    class CapturingBlob extends NativeBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        serializedData = parts.join('');
        super(parts, options);
      }
    }

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.stubGlobal('Blob', CapturingBlob);
    render(<GrowthForm initialData={{ ...defaultInitialData, gestationalDays }} onDataChange={handleDataChange} />);

    fireEvent.click(screen.getByRole('button', { name: /現在の入力データをJSONファイル形式/ }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(JSON.parse(serializedData)).toEqual(expect.objectContaining({ gestationalWeeks: 40, gestationalDays }));
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

  it.each([
    ['male', '男子'],
    ['female', '女子'],
  ])('handles JSON import with backward compatibility (%s -> %s)', async (sexInput, expectedSex) => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    
    const fileData = {
      childId: '005',
      birthDate: '2020/01/01',
      sex: sexInput,
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
      sex: expectedSex,
      gestationalWeeks: 38,
      gestationalDays: 2
    }));
  });

  it('rejects an invalid birth date without changing form state', async () => {
    const handleDataChange = vi.fn();
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    const fileData = {
      childId: 'imported',
      birthDate: '2020/02/30',
      sex: 'female',
      measurements: [{ date: '2021/02/28', height: 80, weight: 10 }],
    };
    const file = new File([JSON.stringify(fileData)], 'invalid-birth.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('生年月日の形式が不正'));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('YYYY/MM/DD または YYYY-MM-DD'));
    expect(handleDataChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('管理ID')).toHaveValue('001');
    expect(screen.getByLabelText('生年月日')).toHaveValue('2020/01/01');
  });

  it('rejects the entire import when a later measurement date is invalid', async () => {
    const handleDataChange = vi.fn();
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    const fileData = {
      childId: 'imported',
      birthDate: '2020-02-29',
      sex: 'female',
      gestationalWeeks: 35,
      gestationalDays: 4,
      measurements: [
        { id: 'valid', date: '2021-02-28', height: 80, weight: 10 },
        { id: 'invalid', date: '2021/02/29', height: 90, weight: 12 },
      ],
    };
    const file = new File([JSON.stringify(fileData)], 'invalid-measurement.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('2行目: 測定日'));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('YYYY/MM/DD または YYYY-MM-DD'));
    expect(handleDataChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('管理ID')).toHaveValue('001');
    expect(screen.getByLabelText('生年月日')).toHaveValue('2020/01/01');
    expect(container.querySelectorAll('input[id^="height-"]')).toHaveLength(1);
    expect(container.querySelector('input[id^="height-"]')).toHaveValue('100');
  });

  it('rejects an invalid gestational week without changing the current form or notifying the dashboard', async () => {
    const handleDataChange = vi.fn();
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    const fileData = {
      childId: 'imported',
      birthDate: '2021/01/01',
      gestationalWeeks: '35',
      gestationalDays: 4,
      measurements: [{ id: 'imported-row', date: '2021/02/01', height: 80, weight: 10 }],
    };
    const file = new File([JSON.stringify(fileData)], 'invalid-weeks.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('在胎週数は有限の整数'));
    expect(handleDataChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('管理ID')).toHaveValue('001');
    expect(screen.getByLabelText('生年月日')).toHaveValue('2020/01/01');
    expect(screen.getByLabelText('在胎期間 (週)')).toHaveValue('40');
    expect(container.querySelector('input[id^="height-"]')).toHaveValue('100');
  });

  it('uses 40 weeks and 0 days only when legacy JSON omits both fields', async () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    const fileData = {
      childId: 'legacy',
      birthDate: '2020/01/01',
      measurements: [{ id: 'legacy-row', date: '2020/02/01', height: 52, weight: 4 }],
    };
    const file = new File([JSON.stringify(fileData)], 'legacy.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(handleDataChange).toHaveBeenCalledWith(expect.objectContaining({ gestationalWeeks: 40, gestationalDays: 0 }));
    expect(screen.getByLabelText('在胎期間 (週)')).toHaveValue('40');
    expect(screen.getByLabelText('在胎期間 (日)')).toHaveValue('0');
  });

  it('defaults omitted legacy gestational days to 0 while preserving the specified week', async () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    const fileData = {
      childId: 'legacy-weeks-only',
      birthDate: '2020/01/01',
      gestationalWeeks: 35,
      measurements: [{ id: 'legacy-weeks-only-row', date: '2020/02/01', height: 52, weight: 4 }],
    };
    const file = new File([JSON.stringify(fileData)], 'legacy-weeks-only.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(handleDataChange).toHaveBeenCalledWith(expect.objectContaining({ gestationalWeeks: 35, gestationalDays: 0 }));
    expect(screen.getByLabelText('在胎期間 (週)')).toHaveValue('35');
    expect(screen.getByLabelText('在胎期間 (日)')).toHaveValue('0');
  });

  it('shows the effective clamped value when importing an out-of-range integer week', async () => {
    const handleDataChange = vi.fn();
    vi.stubGlobal('alert', vi.fn());
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
    const fileData = {
      childId: 'clamped',
      birthDate: '2020/01/01',
      gestationalWeeks: 20,
      gestationalDays: 4,
      measurements: [{ id: 'clamped-row', date: '2020/02/01', height: 52, weight: 4 }],
    };
    const file = new File([JSON.stringify(fileData)], 'clamped.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('在胎週数 20週は22週0日として計算されます'));
    expect(handleDataChange).toHaveBeenCalledWith(expect.objectContaining({ gestationalWeeks: 20, gestationalDays: 4 }));
  });

  it('preserves local calendar dates when saved JSON is reloaded', async () => {
    const handleDataChange = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const NativeBlob = Blob;
    let serializedData = '';
    class CapturingBlob extends NativeBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        serializedData = parts.join('');
        super(parts, options);
      }
    }
    vi.stubGlobal('Blob', CapturingBlob);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const initialData = {
      ...defaultInitialData,
      birthDate: new Date(2020, 1, 29),
      measurements: [{ id: 'leap-day', date: new Date(2020, 11, 31), height: 100, weight: 15 }],
    };
    const { container } = render(<GrowthForm initialData={initialData} onDataChange={handleDataChange} />);

    fireEvent.click(screen.getByRole('button', { name: /現在の入力データをJSONファイル形式/ }));
    const savedData = JSON.parse(serializedData);
    expect(savedData.birthDate).toBe('2020/02/29');
    expect(savedData.measurements[0].date).toBe('2020/12/31');
    const file = new File([serializedData], 'round-trip.json', { type: 'application/json' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(handleDataChange).toHaveBeenCalledOnce();
    const imported = handleDataChange.mock.calls[0][0];
    expect([imported.birthDate.getFullYear(), imported.birthDate.getMonth() + 1, imported.birthDate.getDate()]).toEqual([2020, 2, 29]);
    expect([imported.measurements[0].date.getFullYear(), imported.measurements[0].date.getMonth() + 1, imported.measurements[0].date.getDate()]).toEqual([2020, 12, 31]);
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
