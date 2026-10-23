// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import * as matchers from '@testing-library/jest-dom/matchers';
import GrowthForm from './GrowthForm';
import type { GrowthReference } from '../lib/constants';

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const initialData = {
  childId: '001',
  birthDate: new Date(2020, 0, 1),
  sex: '男子' as const,
  gestationalWeeks: 40,
  gestationalDays: 0,
  measurements: [{ id: '1', date: new Date(2020, 5, 1), height: 100, weight: 15 }],
};

const importedFile = (extra: Record<string, unknown> = {}) => new File([JSON.stringify({
  childId: 'imported',
  birthDate: '2021/01/01',
  sex: 'female',
  gestationalWeeks: 40,
  gestationalDays: 0,
  measurements: [{ id: 'imported-row', date: '2021/02/01', height: 80, weight: 10 }],
  ...extra,
})], 'data.json', { type: 'application/json' });

// The file is read asynchronously by FileReader, so callers must wait for an observable outcome (waitFor).
const loadFile = (container: HTMLElement, file: File) => {
  fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
};

// Mirrors how the dashboard owns the reference: the form reports a loaded reference and the parent passes it back.
const StatefulForm: React.FC<{
  initialData: React.ComponentProps<typeof GrowthForm>['initialData'];
  initialReference: GrowthReference;
  onDataChange?: React.ComponentProps<typeof GrowthForm>['onDataChange'];
  onReferenceChange?: (reference: GrowthReference) => void;
}> = ({ initialData: data, initialReference, onDataChange = () => {}, onReferenceChange }) => {
  const [reference, setReference] = React.useState<GrowthReference>(initialReference);
  return (
    <>
      <GrowthForm
        initialData={data}
        onDataChange={onDataChange}
        growthReference={reference}
        onGrowthReferenceChange={next => {
          onReferenceChange?.(next);
          setReference(next);
        }}
      />
      <output data-testid="selected-reference">{reference}</output>
    </>
  );
};

const captureSave = () => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
  const NativeBlob = Blob;
  const captured = { text: '' };
  class CapturingBlob extends NativeBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      captured.text = parts.join('');
      super(parts, options);
    }
  }
  vi.stubGlobal('Blob', CapturingBlob);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return captured;
};

const clickSave = () => fireEvent.click(screen.getByRole('button', { name: /現在の入力データをJSONファイル形式/ }));

describe('GrowthForm: growthReference in save and load', () => {
  it.each(['japanese', 'achondroplasia-clarity'] as const)('writes the explicit growthReference (%s) to the saved JSON', reference => {
    const captured = captureSave();
    render(<GrowthForm initialData={initialData} onDataChange={vi.fn()} growthReference={reference} />);
    clickSave();
    expect(JSON.parse(captured.text).growthReference).toBe(reference);
  });

  it('saves the Japanese reference when no reference is supplied', () => {
    const captured = captureSave();
    render(<GrowthForm initialData={initialData} onDataChange={vi.fn()} />);
    clickSave();
    expect(JSON.parse(captured.text).growthReference).toBe('japanese');
  });

  it('round-trips: a saved achondroplasia file restores the reference and every input', async () => {
    const captured = captureSave();
    const saved = {
      childId: 'round-trip',
      birthDate: new Date(2021, 2, 5),
      sex: '女子' as const,
      gestationalWeeks: 35,
      gestationalDays: 4,
      measurements: [{ id: 'saved-row', date: new Date(2021, 8, 5), height: 68.4, weight: 7.9 }],
    };
    const first = render(<StatefulForm initialData={saved} initialReference="achondroplasia-clarity" />);
    clickSave();
    const savedText = captured.text;
    first.unmount();

    // The saved JSON itself carries every value that must be restored.
    const savedJson = JSON.parse(savedText);
    expect(savedJson).toEqual({
      childId: 'round-trip',
      birthDate: '2021/03/05',
      sex: '女子',
      growthReference: 'achondroplasia-clarity',
      gestationalWeeks: 35,
      gestationalDays: 4,
      measurements: [{ id: 'saved-row', date: '2021/09/05', height: 68.4, weight: 7.9 }],
    });

    // A different form (other ID, sex, birth date, row, reference) loads the saved file.
    const onDataChange = vi.fn();
    const onReferenceChange = vi.fn();
    const { container } = render(
      <StatefulForm initialData={initialData} initialReference="japanese" onDataChange={onDataChange} onReferenceChange={onReferenceChange} />,
    );
    expect(screen.getByLabelText('管理ID')).toHaveValue('001');
    expect(screen.getByTestId('selected-reference')).toHaveTextContent('japanese');

    loadFile(container, new File([savedText], 'saved.json', { type: 'application/json' }));

    // Wait for the rendered end state, not just for the callbacks.
    await waitFor(() => {
      expect(screen.getByLabelText('管理ID')).toHaveValue('round-trip');
      expect(screen.getByLabelText('生年月日')).toHaveValue('2021/03/05');
      expect(screen.getByLabelText('在胎期間 (週)')).toHaveValue('35');
      expect(screen.getByLabelText('在胎期間 (日)')).toHaveValue('4');
      expect(container.querySelectorAll('input[id^="height-saved-row"]')).toHaveLength(1);
      expect(container.querySelector('input[id="height-saved-row"]')).toHaveValue('68.4');
      expect(container.querySelector('input[id="weight-saved-row"]')).toHaveValue('7.9');
      expect(screen.getByTestId('selected-reference')).toHaveTextContent('achondroplasia-clarity');
    });
    expect(onReferenceChange).toHaveBeenCalledOnce();
    expect(onReferenceChange).toHaveBeenCalledWith('achondroplasia-clarity');
    expect(onDataChange).toHaveBeenCalledOnce();
    expect(onDataChange).toHaveBeenCalledWith({
      childId: 'round-trip',
      birthDate: saved.birthDate,
      sex: '女子',
      gestationalWeeks: 35,
      gestationalDays: 4,
      measurements: [expect.objectContaining({ id: 'saved-row', date: saved.measurements[0].date, height: 68.4, weight: 7.9 })],
    });

    // Saving the restored form again reproduces the same JSON, so the sex and the reference came back through the form's own state and props.
    clickSave();
    expect(JSON.parse(captured.text)).toEqual(savedJson);
  });

  it.each(['japanese', 'achondroplasia-clarity'] as const)('applies an explicit %s from the file', async reference => {
    const onReferenceChange = vi.fn();
    const onDataChange = vi.fn();
    const other: GrowthReference = reference === 'japanese' ? 'achondroplasia-clarity' : 'japanese';
    const { container } = render(
      <StatefulForm initialData={initialData} initialReference={other} onDataChange={onDataChange} onReferenceChange={onReferenceChange} />,
    );
    loadFile(container, importedFile({ growthReference: reference }));
    await waitFor(() => {
      expect(screen.getByLabelText('管理ID')).toHaveValue('imported');
      expect(screen.getByTestId('selected-reference')).toHaveTextContent(reference);
    });
    expect(onReferenceChange).toHaveBeenCalledWith(reference);
    expect(onDataChange).toHaveBeenCalledOnce();
  });

  it('loads a legacy file without growthReference as the Japanese reference', async () => {
    const onReferenceChange = vi.fn<(reference: GrowthReference) => void>();
    const onDataChange = vi.fn();
    const { container } = render(
      <StatefulForm initialData={initialData} initialReference="achondroplasia-clarity" onDataChange={onDataChange} onReferenceChange={onReferenceChange} />,
    );
    loadFile(container, importedFile());
    await waitFor(() => {
      expect(screen.getByLabelText('管理ID')).toHaveValue('imported');
      expect(screen.getByTestId('selected-reference')).toHaveTextContent('japanese');
    });
    expect(onReferenceChange).toHaveBeenCalledWith('japanese');
    expect(onDataChange).toHaveBeenCalledOnce();
  });

  it.each([
    { label: 'an unknown identifier', value: 'unknown-reference' },
    { label: 'null', value: null },
    { label: 'an empty string', value: '' },
    { label: 'the display label instead of the identifier', value: '日本人基準' },
  ])('rejects the whole load for $label, keeping the current inputs and reference', async ({ value }) => {
    vi.stubGlobal('alert', vi.fn());
    const onReferenceChange = vi.fn();
    const onDataChange = vi.fn();
    const { container } = render(
      <StatefulForm initialData={initialData} initialReference="achondroplasia-clarity" onDataChange={onDataChange} onReferenceChange={onReferenceChange} />,
    );
    loadFile(container, importedFile({ growthReference: value }));
    // The alert is raised after validation and before the handler returns, so nothing is applied afterwards.
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('成長基準')));

    expect(onReferenceChange).not.toHaveBeenCalled();
    expect(onDataChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('selected-reference')).toHaveTextContent('achondroplasia-clarity');
    expect(screen.getByLabelText('管理ID')).toHaveValue('001');
    expect(screen.getByLabelText('生年月日')).toHaveValue('2020/01/01');
    expect(container.querySelectorAll('input[id^="height-"]')).toHaveLength(1);
    expect(container.querySelector('input[id^="height-"]')).toHaveValue('100');
  });

  it('does not persist the reference to localStorage on its own', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<GrowthForm initialData={initialData} onDataChange={vi.fn()} growthReference="achondroplasia-clarity" />);
    expect(setItem).not.toHaveBeenCalled();
  });
});
