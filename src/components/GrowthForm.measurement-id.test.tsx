// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthForm from './GrowthForm';

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type UUID = ReturnType<Crypto['randomUUID']>;

const initialData = {
  childId: '001',
  birthDate: new Date(2020, 0, 1),
  sex: '男子' as const,
  gestationalWeeks: 40,
  gestationalDays: 0,
  measurements: [{ id: '1', date: new Date(2020, 5, 1), height: 100, weight: 15 }],
};

const fileOf = (measurements: unknown[]) => new File([JSON.stringify({
  childId: 'imported',
  birthDate: '2020/01/01',
  sex: 'female',
  growthReference: 'achondroplasia-clarity',
  gestationalWeeks: 40,
  gestationalDays: 0,
  measurements,
})], 'data.json', { type: 'application/json' });

const loadFile = (container: HTMLElement, file: File) => {
  fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
};

const renderForm = () => {
  const onDataChange = vi.fn();
  const onGrowthReferenceChange = vi.fn();
  const view = render(
    <GrowthForm initialData={initialData} onDataChange={onDataChange} growthReference="japanese" onGrowthReferenceChange={onGrowthReferenceChange} />,
  );
  return { ...view, onDataChange, onGrowthReferenceChange };
};

const expectCurrentStateKept = (container: HTMLElement) => {
  expect(screen.getByLabelText('管理ID')).toHaveValue('001');
  expect(screen.getByLabelText('生年月日')).toHaveValue('2020/01/01');
  expect(container.querySelectorAll('input[id^="height-"]')).toHaveLength(1);
  expect(container.querySelector('#height-1')).toHaveValue('100');
  expect(container.querySelector('#weight-1')).toHaveValue('15');
};

describe('GrowthForm JSON import: measurement ids', () => {
  it('rejects the whole file when a non-empty string id is duplicated, naming the rows, and keeps the current input and reference', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    const { container, onDataChange, onGrowthReferenceChange } = renderForm();

    loadFile(container, fileOf([
      { id: 'dup', date: '2021/01/01', height: 80, weight: 10 },
      { id: 'other', date: '2021/06/01', height: 84, weight: 11 },
      { id: 'dup', date: '2022/01/01', height: 88, weight: 12 },
    ]));

    await waitFor(() => expect(alertMock).toHaveBeenCalledTimes(1));
    expect(alertMock.mock.calls[0][0]).toContain('ファイルの読み込みに失敗しました');
    expect(alertMock.mock.calls[0][0]).toContain('3行目: 測定データのid（"dup"）が1行目と重複しています');
    expect(onDataChange).not.toHaveBeenCalled();
    expect(onGrowthReferenceChange).not.toHaveBeenCalled();
    expectCurrentStateKept(container);
  });

  it('accepts rows on the same measurement date with distinct ids and keeps both rows', async () => {
    const { container, onDataChange } = renderForm();

    loadFile(container, fileOf([
      { id: 'a', date: '2021/01/01', height: 80, weight: 10 },
      { id: 'b', date: '2021/01/01', height: 82, weight: 11 },
    ]));

    await waitFor(() => expect(onDataChange).toHaveBeenCalledOnce());
    expect(onDataChange.mock.calls[0][0].measurements.map((m: { id: string; height?: number; weight?: number }) => [m.id, m.height, m.weight]))
      .toEqual([['a', 80, 10], ['b', 82, 11]]);
  });

  it('keeps existing unique ids and gives rows without an id a generated id that differs from every loaded id', async () => {
    const generated: UUID[] = ['kept' as UUID, 'fresh' as UUID];
    vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => generated.shift() ?? ('unexpected' as UUID));
    const { container, onDataChange } = renderForm();

    loadFile(container, fileOf([
      { date: '2021/01/01', height: 80, weight: 10 },
      { id: 'kept', date: '2021/06/01', height: 84, weight: 11 },
      { id: '', date: '2022/01/01', height: 88 },
    ]));

    await waitFor(() => expect(onDataChange).toHaveBeenCalledOnce());
    const ids = onDataChange.mock.calls[0][0].measurements.map((m: { id: string }) => m.id);
    expect(ids[1]).toBe('kept');
    expect(ids[0]).toBe('fresh');
    expect(ids[2]).toBe('unexpected');
    expect(new Set(ids).size).toBe(3);
  });

  it('gives an added row an id that differs from the current rows', () => {
    const generated: UUID[] = ['1' as UUID, 'new-row' as UUID];
    vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => generated.shift() ?? ('unexpected' as UUID));
    const { container } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    expect(container.querySelectorAll('input[id^="height-"]')).toHaveLength(2);
    expect(container.querySelector('#height-1')).toHaveValue('100');
    expect(container.querySelector('#height-new-row')).toBeInTheDocument();
  });
});

describe('GrowthForm JSON import: file read failure', () => {
  it('tells the user when the file cannot be read, keeps the current input, and allows choosing a file again', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const NativeFileReader = FileReader;
    class FailingFileReader {
      onload: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      error = new DOMException('read failed', 'NotReadableError');
      readAsText() {
        setTimeout(() => this.onerror?.(new Event('error')), 0);
      }
    }
    vi.stubGlobal('FileReader', FailingFileReader);
    const { container, onDataChange, onGrowthReferenceChange } = renderForm();
    const file = fileOf([{ id: 'r1', date: '2021/01/01', height: 80, weight: 10 }]);

    loadFile(container, file);

    await waitFor(() => expect(alertMock).toHaveBeenCalledTimes(1));
    expect(alertMock.mock.calls[0][0]).toContain('ファイルを読み取れませんでした');
    expect(onDataChange).not.toHaveBeenCalled();
    expect(onGrowthReferenceChange).not.toHaveBeenCalled();
    expectCurrentStateKept(container);

    vi.stubGlobal('FileReader', NativeFileReader);
    loadFile(container, file);

    await waitFor(() => expect(onDataChange).toHaveBeenCalledOnce());
    expect(onGrowthReferenceChange).toHaveBeenCalledWith('achondroplasia-clarity');
    expect(alertMock).toHaveBeenCalledTimes(1);
  });
});
