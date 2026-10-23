import { describe, expect, it } from 'vitest';
import { validateGrowthJSON } from './validation-utils';
import { DEFAULT_GROWTH_REFERENCE, GROWTH_REFERENCES, GROWTH_REFERENCE_LABELS, isGrowthReference } from './constants';

const base = {
  childId: '001',
  birthDate: '2020/01/01',
  sex: '男子',
  gestationalWeeks: 40,
  gestationalDays: 0,
  measurements: [{ id: '1', date: '2021/01/01', height: 71.9, weight: 9.15 }],
};

describe('growthReference in saved JSON', () => {
  it('defines exactly the two supported identifiers, with Japanese as the default', () => {
    expect([...GROWTH_REFERENCES]).toEqual(['japanese', 'achondroplasia-clarity']);
    expect(DEFAULT_GROWTH_REFERENCE).toBe('japanese');
    expect(GROWTH_REFERENCE_LABELS.japanese).toBe('日本人基準');
    expect(GROWTH_REFERENCE_LABELS['achondroplasia-clarity']).toBe('軟骨無形成症（CLARITY・米国）');
  });

  it('accepts only the exact identifiers', () => {
    expect(isGrowthReference('japanese')).toBe(true);
    expect(isGrowthReference('achondroplasia-clarity')).toBe(true);
    for (const bad of ['', 'Japanese', 'achondroplasia', ' japanese', null, undefined, 0, {}, ['japanese']]) {
      expect(isGrowthReference(bad)).toBe(false);
    }
  });

  it('loads a legacy file without growthReference as the Japanese reference', () => {
    const result = validateGrowthJSON(base);
    expect(result.isValid).toBe(true);
    expect(result.growthReference).toBe('japanese');
    expect(result.errors).toHaveLength(0);
  });

  it.each(['japanese', 'achondroplasia-clarity'] as const)('loads an explicit %s', id => {
    const result = validateGrowthJSON({ ...base, growthReference: id });
    expect(result.isValid).toBe(true);
    expect(result.growthReference).toBe(id);
  });

  it.each([
    { label: 'null', value: null },
    { label: 'empty string', value: '' },
    { label: 'unknown identifier', value: 'unknown-reference' },
    { label: 'label text instead of the identifier', value: '日本人基準' },
    { label: 'different case', value: 'Japanese' },
    { label: 'whitespace', value: ' japanese ' },
    { label: 'number', value: 1 },
    { label: 'boolean', value: false },
    { label: 'object', value: { id: 'japanese' } },
    { label: 'array', value: ['japanese'] },
  ])('rejects the whole load for $label', ({ value }) => {
    const result = validateGrowthJSON({ ...base, growthReference: value });
    expect(result.isValid).toBe(false);
    expect(result.growthReference).toBeNull();
    expect(result.errors.some(e => e.field === 'growthReference')).toBe(true);
  });

  it('does not fall back to Japanese for an invalid identifier, even when everything else is valid', () => {
    const result = validateGrowthJSON({ ...base, growthReference: 'achondroplasia' });
    expect(result.isValid).toBe(false);
    expect(result.growthReference).not.toBe('japanese');
  });

  it('reports no reference for a non-object root', () => {
    expect(validateGrowthJSON('x').growthReference).toBeNull();
  });
});
