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

  it('converts full-width digits to half-width but keeps any other typed character instead of deleting it', () => {
    const handleDataChange = vi.fn();
    const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

    const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;
    expect(heightInput).toBeInTheDocument();

    fireEvent.change(heightInput, { target: { value: '１２３．５' } });
    expect(heightInput.value).toBe('123.5');
    expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
      measurements: [{ id: expect.any(String), date: expect.any(Date), height: '123.5', weight: 15 }]
    }));

    // The trailing character is not stripped to leave a different, valid number.
    fireEvent.change(heightInput, { target: { value: '１２３．５あ' } });
    expect(heightInput.value).toBe('123.5あ');
    expect(heightInput).toHaveAttribute('aria-invalid', 'true');
    expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
      measurements: [{ id: expect.any(String), date: expect.any(Date), height: '123.5あ', weight: 15 }]
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

  it('does not show the old blanket age warning for measurements over 18 years', () => {
    const handleDataChange = vi.fn();
    const dataOverAge = {
      ...defaultInitialData,
      birthDate: new Date(2000, 0, 1),
      measurements: [
        { id: '1', date: new Date(2025, 0, 1), height: 170, weight: 70 } // 25 years old
      ]
    };
    render(<GrowthForm initialData={dataOverAge} onDataChange={handleDataChange} />);
    expect(screen.queryByText(/18歳を超えています/)).not.toBeInTheDocument();
    expect(screen.queryByText(/17\.5歳のデータを参照します/)).not.toBeInTheDocument();
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
      sex: 'female',
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
      sex: 'male',
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
      sex: 'male',
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
      sex: 'female',
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

  describe('JSON import of sex and measurement values', () => {
    const base = { childId: 'imported', birthDate: '2020/01/01', sex: 'female', measurements: [{ id: 'r1', date: '2021/01/01', height: 80, weight: 10 }] };

    const importFile = async (container: HTMLElement, data: unknown) => {
      const file = new File([JSON.stringify(data)], 'import.json', { type: 'application/json' });
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
      await new Promise(resolve => setTimeout(resolve, 50));
    };

    const expectRejectedWithState = (handleDataChange: ReturnType<typeof vi.fn>, container: HTMLElement, reason: string) => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining(reason));
      expect(handleDataChange).not.toHaveBeenCalled();
      expect(screen.getByLabelText('管理ID')).toHaveValue('001');
      expect(screen.getByLabelText('生年月日')).toHaveValue('2020/01/01');
      expect(container.querySelectorAll('input[id^="height-"]')).toHaveLength(1);
      expect(container.querySelector('input[id^="height-"]')).toHaveValue('100');
      expect(container.querySelector('input[id^="weight-"]')).toHaveValue('15');
    };

    it.each([
      ['omitted', undefined, '性別が指定されていません'],
      ['null', null, '性別が指定されていません'],
      ['empty', '', '性別が指定されていません'],
      ['whitespace-only', '   ', '性別が指定されていません'],
      ['invalid', 'other', '性別の値が不正です'],
    ])('rejects the whole import when sex is %s and keeps the current state', async (_label, sex, reason) => {
      const handleDataChange = vi.fn();
      vi.stubGlobal('alert', vi.fn());
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

      await importFile(container, { ...base, sex });

      expectRejectedWithState(handleDataChange, container, reason);
    });

    it.each([
      ['a boolean height', { height: true, weight: 10 }, '身長は数値または数値文字列'],
      ['an array weight', { height: 80, weight: [10] }, '体重は数値または数値文字列'],
      ['an object height', { height: {}, weight: 10 }, '身長は数値または数値文字列'],
      ['a unit-suffixed height', { height: '100cm', weight: 10 }, '身長（"100cm"）が数値ではありません'],
      ['a unit-suffixed weight', { height: 80, weight: '10kg' }, '体重（"10kg"）が数値ではありません'],
      ['a zero height', { height: 0, weight: 10 }, '身長は正の値'],
      ['a negative weight', { height: 80, weight: -1 }, '体重は正の値'],
      ['neither height nor weight', { height: null, weight: '' }, '身長・体重のどちらも入力されていません'],
    ])('rejects the whole import for %s with the row and reason, keeping the current state', async (_label, values, reason) => {
      const handleDataChange = vi.fn();
      vi.stubGlobal('alert', vi.fn());
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

      await importFile(container, { ...base, measurements: [base.measurements[0], { id: 'r2', date: '2021/06/01', ...values }] });

      expectRejectedWithState(handleDataChange, container, `2行目: ${reason}`);
    });

    it('accepts height-only and weight-only rows and imports exactly the validated numbers', async () => {
      const handleDataChange = vi.fn();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

      await importFile(container, {
        ...base,
        measurements: [
          { id: 'h-only', date: '2021/01/01', height: ' 80.5 ' },
          { id: 'w-only', date: '2021/02/01', weight: '10.25', height: null },
        ],
      });

      expect(handleDataChange).toHaveBeenCalledOnce();
      const imported = handleDataChange.mock.calls[0][0];
      expect(imported.sex).toBe('女子');
      expect(imported.measurements.map((m: { id: string; height?: number; weight?: number }) => [m.id, m.height, m.weight]))
        .toEqual([['h-only', 80.5, undefined], ['w-only', undefined, 10.25]]);
      expect(imported.measurements.every((m: { height?: unknown; weight?: unknown }) => m.height === undefined || typeof m.height === 'number')).toBe(true);
    });

    it('keeps accepting the legacy English sex values and string-typed numbers', async () => {
      const handleDataChange = vi.fn();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

      await importFile(container, { ...base, sex: 'male', measurements: [{ date: '2021/01/01', height: '80.5', weight: '10' }] });

      expect(handleDataChange).toHaveBeenCalledWith(expect.objectContaining({
        sex: '男子',
        measurements: [expect.objectContaining({ height: 80.5, weight: 10 })],
      }));
    });
  });

  describe('manual invalid height and weight input', () => {
    const stubSave = () => {
      const createObjectURL = vi.fn(() => 'blob:test');
      vi.stubGlobal('alert', vi.fn());
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      return createObjectURL;
    };
    const saveButton = () => screen.getByRole('button', { name: /現在の入力データをJSONファイル形式/ });

    it.each(['0', '0.0', '.'])('keeps the typed value %j visible, explains it, and holds saving until it is corrected', (typed) => {
      const handleDataChange = vi.fn();
      const createObjectURL = stubSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;

      fireEvent.change(heightInput, { target: { value: typed } });

      expect(heightInput).toHaveValue(typed);
      expect(heightInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/身長は正の(値を|数値で)入力してください/)).toBeInTheDocument();
      expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
        measurements: [expect.objectContaining({ height: typed })],
      }));

      fireEvent.click(saveButton());
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('身長の入力値が不正です'));
      expect(createObjectURL).not.toHaveBeenCalled();

      fireEvent.change(heightInput, { target: { value: '100.5' } });
      expect(heightInput).toHaveAttribute('aria-invalid', 'false');
      fireEvent.click(saveButton());
      expect(createObjectURL).toHaveBeenCalledOnce();
    });

    it.each(['1e2', '-5', '1,000', '100cm', '.', '1..2'])('keeps the typed %j exactly, never converting it to another number', (typed) => {
      const handleDataChange = vi.fn();
      const createObjectURL = stubSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;

      fireEvent.change(heightInput, { target: { value: typed } });

      expect(heightInput).toHaveValue(typed);
      expect(heightInput).toHaveAttribute('aria-invalid', 'true');
      expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
        measurements: [expect.objectContaining({ height: typed, weight: 15 })],
      }));
      fireEvent.click(saveButton());
      expect(createObjectURL).not.toHaveBeenCalled();

      // valid -> invalid -> valid: saving resumes.
      fireEvent.change(heightInput, { target: { value: '100' } });
      expect(heightInput).toHaveAttribute('aria-invalid', 'false');
      fireEvent.click(saveButton());
      expect(createObjectURL).toHaveBeenCalledOnce();
    });

    it.each(['80.5', '.5', '80.', ' 80.5 '])('treats %j as a valid decimal and saves', (typed) => {
      const createObjectURL = stubSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;

      fireEvent.change(heightInput, { target: { value: typed } });

      expect(heightInput).toHaveValue(typed);
      expect(heightInput).toHaveAttribute('aria-invalid', 'false');
      fireEvent.click(saveButton());
      expect(createObjectURL).toHaveBeenCalledOnce();
    });

    it.each(['', '   '])('treats %j as not entered, not invalid', (typed) => {
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;

      fireEvent.change(heightInput, { target: { value: typed } });

      expect(heightInput).toHaveAttribute('aria-invalid', 'false');
    });

    it('applies the same rule to pasted text, and Enter and blur neither change nor drop an invalid value', () => {
      const handleDataChange = vi.fn();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;
      const weightInput = container.querySelector('input[id^="weight-"]') as HTMLInputElement;

      fireEvent.paste(heightInput, { clipboardData: { getData: () => '100cm' } });
      fireEvent.change(heightInput, { target: { value: '100cm' } });
      expect(heightInput).toHaveValue('100cm');
      expect(heightInput).toHaveAttribute('aria-invalid', 'true');

      fireEvent.keyDown(heightInput, { key: 'Enter' });
      expect(document.activeElement).toBe(weightInput);
      fireEvent.blur(heightInput);
      expect(heightInput).toHaveValue('100cm');
      expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
        measurements: [expect.objectContaining({ height: '100cm' })],
      }));
    });

    it('keeps an invalid weight text as typed while the valid height is retained, and holds saving', () => {
      const handleDataChange = vi.fn();
      const createObjectURL = stubSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      const weightInput = container.querySelector('input[id^="weight-"]') as HTMLInputElement;

      fireEvent.change(weightInput, { target: { value: '10kg' } });

      expect(weightInput).toHaveValue('10kg');
      expect(weightInput).toHaveAttribute('aria-invalid', 'true');
      expect(container.querySelector('input[id^="height-"]')).toHaveAttribute('aria-invalid', 'false');
      fireEvent.click(saveButton());
      expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('体重の入力値が不正です'));
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('treats typing an invalid character into a spare row as an edit, so that row holds saving', () => {
      const createObjectURL = stubSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      fireEvent.click(Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.trim() === '追加') as HTMLElement);
      const [, spareHeight] = Array.from(container.querySelectorAll('input[id^="height-"]')) as HTMLInputElement[];

      fireEvent.change(spareHeight, { target: { value: 'abc' } });

      expect(spareHeight).toHaveValue('abc');
      fireEvent.click(saveButton());
      expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('2行目'));
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it.each([
      ['１２３．４', '123.4', true],
      ['．５', '.5', true],
      ['８０．', '80.', true],
      ['－５', '-5', false],
      ['＋５', '+5', false],
      ['１ｅ２', '1e2', false],
      ['１，０００', '1,000', false],
      ['１００ｃｍ', '100cm', false],
      ['１．２．３', '1.2.3', false],
    ])('normalizes full-width %j to %j (valid: %s) without deleting any character', (typed, normalized, valid) => {
      const handleDataChange = vi.fn();
      const createObjectURL = stubSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;

      fireEvent.change(heightInput, { target: { value: typed } });

      expect(heightInput).toHaveValue(normalized);
      expect(heightInput).toHaveAttribute('aria-invalid', String(!valid));
      expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
        measurements: [expect.objectContaining({ height: normalized })],
      }));
      fireEvent.click(saveButton());
      expect(createObjectURL).toHaveBeenCalledTimes(valid ? 1 : 0);
    });

    it('applies the same normalization to pasted full-width text', () => {
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      const weightInput = container.querySelector('input[id^="weight-"]') as HTMLInputElement;

      fireEvent.paste(weightInput, { clipboardData: { getData: () => '１０．５' } });
      fireEvent.change(weightInput, { target: { value: '１０．５' } });
      expect(weightInput).toHaveValue('10.5');
      expect(weightInput).toHaveAttribute('aria-invalid', 'false');

      fireEvent.change(weightInput, { target: { value: '１０ｋｇ' } });
      expect(weightInput).toHaveValue('10kg');
      expect(weightInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('leaves the field text untouched during IME composition and normalizes it when composition ends', () => {
      const handleDataChange = vi.fn();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;

      fireEvent.compositionStart(heightInput);
      fireEvent.change(heightInput, { target: { value: '１２' } });
      expect(heightInput).toHaveValue('１２');
      expect(handleDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
        measurements: [expect.objectContaining({ height: '１２' })],
      }));

      fireEvent.compositionEnd(heightInput);
      expect(heightInput).toHaveValue('12');
      expect(heightInput).toHaveAttribute('aria-invalid', 'false');
    });

    it('saves normalized full-width input so that it reloads', async () => {
      const state = { json: '' };
      const NativeBlob = Blob;
      class CapturingBlob extends NativeBlob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          state.json = parts.join('');
          super(parts, options);
        }
      }
      stubSave();
      vi.stubGlobal('Blob', CapturingBlob);
      const handleDataChange = vi.fn();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      fireEvent.change(container.querySelector('input[id^="height-"]') as HTMLInputElement, { target: { value: '１２３．４' } });
      fireEvent.change(container.querySelector('input[id^="weight-"]') as HTMLInputElement, { target: { value: '１０．' } });
      fireEvent.click(saveButton());
      expect(JSON.parse(state.json).measurements[0]).toEqual(expect.objectContaining({ height: '123.4', weight: '10.' }));

      handleDataChange.mockClear();
      const file = new File([state.json], 'saved.json', { type: 'application/json' });
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handleDataChange).toHaveBeenCalledOnce();
      expect(handleDataChange.mock.calls[0][0].measurements[0]).toEqual(expect.objectContaining({ height: 123.4, weight: 10 }));
    });

    it('rejects JSON string values with a sign, exponent or full-width digits, keeping the current data', async () => {
      const handleDataChange = vi.fn();
      vi.stubGlobal('alert', vi.fn());
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      const file = new File([JSON.stringify({
        birthDate: '2020/01/01', sex: 'male',
        measurements: [{ date: '2021/01/01', height: ' +5 ', weight: '１０' }],
      })], 'bad.json', { type: 'application/json' });

      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('1行目'));
      expect(handleDataChange).not.toHaveBeenCalled();
      expect(container.querySelector('input[id^="height-"]')).toHaveValue('100');
    });

    it('treats an empty height as not entered (weight-only rows can still be saved)', () => {
      const createObjectURL = stubSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;

      fireEvent.change(heightInput, { target: { value: '' } });

      expect(heightInput).toHaveAttribute('aria-invalid', 'false');
      fireEvent.click(saveButton());
      expect(createObjectURL).toHaveBeenCalledOnce();
    });

    it('holds saving for an invalid weight and for a row with neither height nor weight', () => {
      const createObjectURL = stubSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;
      const weightInput = container.querySelector('input[id^="weight-"]') as HTMLInputElement;

      fireEvent.change(weightInput, { target: { value: '0' } });
      fireEvent.click(saveButton());
      expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('体重の入力値が不正です'));

      fireEvent.change(weightInput, { target: { value: '' } });
      fireEvent.change(heightInput, { target: { value: '' } });
      fireEvent.click(saveButton());
      expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('どちらも未入力'));
      expect(createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('saving: spare rows, reload and data retention', () => {
    const captureSave = () => {
      const state = { json: '', saved: 0 };
      const NativeBlob = Blob;
      class CapturingBlob extends NativeBlob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          state.json = parts.join('');
          state.saved += 1;
          super(parts, options);
        }
      }
      vi.stubGlobal('alert', vi.fn());
      vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
      vi.stubGlobal('Blob', CapturingBlob);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      return state;
    };
    const saveButton = () => screen.getByRole('button', { name: /現在の入力データをJSONファイル形式/ });
    const reload = async (container: HTMLElement, json: string) => {
      const file = new File([json], 'reload.json', { type: 'application/json' });
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
      await new Promise(resolve => setTimeout(resolve, 50));
    };
    const addRow = (container: HTMLElement) => {
      const addButton = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.trim() === '追加') as HTMLElement;
      fireEvent.click(addButton);
    };

    it('saves a valid row although an untouched spare input row exists, and leaves the spare row out of the file', () => {
      const state = captureSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      addRow(container);
      expect(container.querySelectorAll('input[id^="height-"]')).toHaveLength(2);

      fireEvent.click(saveButton());

      expect(window.alert).not.toHaveBeenCalled();
      expect(state.saved).toBe(1);
      expect(JSON.parse(state.json).measurements).toHaveLength(1);
      // The spare row stays on screen.
      expect(container.querySelectorAll('input[id^="height-"]')).toHaveLength(2);
    });

    it('does not turn a spare row into a measurement row merely because its date field is focused and left', () => {
      const state = captureSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      addRow(container);
      const dateInputs = container.querySelectorAll('input[id^="date-"]');
      const spareDate = dateInputs[1] as HTMLInputElement;
      fireEvent.focus(spareDate);
      fireEvent.blur(spareDate);

      fireEvent.click(saveButton());

      expect(window.alert).not.toHaveBeenCalled();
      expect(JSON.parse(state.json).measurements).toHaveLength(1);
    });

    it('holds saving, naming the row, once a spare row has been used and then emptied; nothing is dropped', () => {
      const state = captureSave();
      const handleDataChange = vi.fn();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);
      addRow(container);
      const [, spareHeight] = Array.from(container.querySelectorAll('input[id^="height-"]')) as HTMLInputElement[];
      fireEvent.change(spareHeight, { target: { value: '5' } });
      fireEvent.change(spareHeight, { target: { value: '' } });

      fireEvent.click(saveButton());

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('2行目'));
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('どちらも未入力'));
      expect(state.saved).toBe(0);
      const heights = Array.from(container.querySelectorAll('input[id^="height-"]')) as HTMLInputElement[];
      expect(heights).toHaveLength(2);
      expect(heights[0]).toHaveValue('100');
    });

    it('holds saving for an actual row whose height and weight were both cleared, naming the row', () => {
      const state = captureSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      fireEvent.change(container.querySelector('input[id^="height-"]') as HTMLInputElement, { target: { value: '' } });
      fireEvent.change(container.querySelector('input[id^="weight-"]') as HTMLInputElement, { target: { value: '' } });

      fireEvent.click(saveButton());

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('1行目'));
      expect(state.saved).toBe(0);
    });

    it('keeps the entered data and resumes saving after an invalid value is corrected', () => {
      const state = captureSave();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={vi.fn()} />);
      const heightInput = container.querySelector('input[id^="height-"]') as HTMLInputElement;

      fireEvent.change(heightInput, { target: { value: '0' } });
      fireEvent.click(saveButton());
      expect(state.saved).toBe(0);
      expect(heightInput).toHaveValue('0');
      expect(container.querySelector('input[id^="weight-"]')).toHaveValue('15');

      fireEvent.change(heightInput, { target: { value: '99.5' } });
      fireEvent.click(saveButton());
      expect(state.saved).toBe(1);
      expect(JSON.parse(state.json).measurements[0].height).toBe('99.5');
    });

    it('saves height-only, weight-only and partially typed rows, and reloads exactly what was saved', async () => {
      const state = captureSave();
      const handleDataChange = vi.fn();
      const initialData = {
        ...defaultInitialData,
        sex: '女子' as const,
        measurements: [
          { id: 'h-only', date: new Date(2020, 5, 1), height: '80.', weight: undefined },
          { id: 'w-only', date: new Date(2020, 6, 1), height: undefined, weight: '.5' },
          { id: 'both', date: new Date(2020, 7, 1), height: 82.5, weight: '' },
        ],
      };
      const { container } = render(<GrowthForm initialData={initialData} onDataChange={handleDataChange} />);

      fireEvent.click(saveButton());
      expect(state.saved).toBe(1);
      await reload(container, state.json);

      expect(handleDataChange).toHaveBeenCalledOnce();
      const imported = handleDataChange.mock.calls[0][0];
      expect(imported.sex).toBe('女子');
      expect(imported.measurements.map((m: { id: string; height?: number; weight?: number }) => [m.id, m.height, m.weight]))
        .toEqual([['h-only', 80, undefined], ['w-only', undefined, 0.5], ['both', 82.5, undefined]]);
    });

    it('reloads a file whose typed values were saved as strings, and one saved by hand with a JSON number 1e2', async () => {
      const handleDataChange = vi.fn();
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

      await reload(container, '{"childId":"x","birthDate":"2020/01/01","sex":"male","measurements":[{"date":"2021/01/01","height":1e2,"weight":"10.5"}]}');

      expect(handleDataChange).toHaveBeenCalledOnce();
      const [row] = handleDataChange.mock.calls[0][0].measurements;
      expect(row.height).toBe(100);
      expect(row.weight).toBe(10.5);
    });

    it('rejects the string "1e2" and a leading "+" instead of reading part of them, keeping the current data', async () => {
      const handleDataChange = vi.fn();
      vi.stubGlobal('alert', vi.fn());
      const { container } = render(<GrowthForm initialData={defaultInitialData} onDataChange={handleDataChange} />);

      await reload(container, '{"birthDate":"2020/01/01","sex":"male","measurements":[{"date":"2021/01/01","height":"1e2","weight":"+5"}]}');

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('1行目'));
      expect(handleDataChange).not.toHaveBeenCalled();
      expect(container.querySelector('input[id^="height-"]')).toHaveValue('100');
    });
  });
});
