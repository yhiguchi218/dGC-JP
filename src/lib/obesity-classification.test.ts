import { describe, it, expect } from 'vitest';
import { getObesityClassification } from './obesity-classification';

const cat = (age: number, index: number | null, method: 'height' | 'age' = 'height') =>
  getObesityClassification(age, index, method)?.category;

const color = (age: number, index: number | null, method: 'height' | 'age' = 'height') =>
  getObesityClassification(age, index, method)?.colorClass;

describe('getObesityClassification (age in years)', () => {
  it('returns null for invalid age/index values', () => {
    expect(getObesityClassification(5, null, 'height')).toBeNull();
    expect(getObesityClassification(5, Number.NaN, 'height')).toBeNull();
    expect(getObesityClassification(5, Number.POSITIVE_INFINITY, 'height')).toBeNull();
    expect(getObesityClassification(5, Number.NEGATIVE_INFINITY, 'height')).toBeNull();
    expect(getObesityClassification(Number.NaN, 10, 'height')).toBeNull();
    expect(getObesityClassification(Number.POSITIVE_INFINITY, 10, 'height')).toBeNull();
    expect(getObesityClassification(Number.NEGATIVE_INFINITY, 10, 'height')).toBeNull();
    expect(getObesityClassification(-1, 10, 'height')).toBeNull();
  });

  it('switches age bands at 1/6/18 years on the same index value', () => {
    expect(cat(0.9999, 20, 'height')).toBe('');
    expect(cat(1.0, 20, 'height')).toBe('やや太りすぎ');
    expect(cat(5.9999, 20, 'height')).toBe('やや太りすぎ');
    expect(cat(6.0, 20, 'height')).toBe('軽度肥満');
    expect(cat(17.9999, 20, 'height')).toBe('軽度肥満');
    expect(getObesityClassification(18.0, 20, 'height')).toBeNull();
  });

  it('gives infants under 1 year a reference note and no category or color', () => {
    const r = getObesityClassification(0.9999, 45, 'height');
    expect(r?.category).toBe('');
    expect(r?.colorClass).toBe('');
    expect(r?.note).toContain('参考値');
    expect(getObesityClassification(1, 45, 'height')?.note).toBeUndefined();
  });

  it.each([
    [14.99, ''],
    [15.0, '太りぎみ'],
    [15.01, '太りぎみ'],
    [19.99, '太りぎみ'],
    [20.0, 'やや太りすぎ'],
    [20.01, 'やや太りすぎ'],
    [29.99, 'やや太りすぎ'],
    [30.0, '太りすぎ'],
    [30.01, '太りすぎ'],
  ])('classifies ages 1 to under 6 with raw boundary rules: %f', (index, expected) => {
    expect(cat(3, index)).toBe(expected);
  });

  it.each([
    [19.99, ''],
    [20.0, '軽度肥満'],
    [20.01, '軽度肥満'],
    [29.99, '軽度肥満'],
    [30.0, '中等度肥満'],
    [30.01, '中等度肥満'],
    [49.99, '中等度肥満'],
    [50.0, '高度肥満'],
    [50.01, '高度肥満'],
  ])('classifies ages 6 to under 18 with raw boundary rules: %f', (index, expected) => {
    expect(cat(10, index)).toBe(expected);
  });

  it.each([
    [-19.99, ''],
    [-20.0, '軽度やせ'],
    [-20.01, '軽度やせ'],
    [-29.99, '軽度やせ'],
    [-30.0, '高度やせ'],
    [-30.01, '高度やせ'],
  ])('applies age-specific underweight thresholds in school-age only: %f', (index, expected) => {
    expect(cat(10, index, 'age')).toBe(expected);
  });

  it('does not apply underweight categories in height-based mode or under age 6', () => {
    expect(cat(10, -30, 'height')).toBe('');
    expect(cat(10, -20, 'height')).toBe('');
    expect(cat(5.9999, -30, 'age')).toBe('');
    expect(cat(3, -20, 'age')).toBe('');
  });

  it('keeps zero in the non-classified middle range', () => {
    expect(cat(10, 0, 'height')).toBe('');
    expect(cat(10, 0, 'age')).toBe('');
  });

  it('uses empty color class when there is no category', () => {
    expect(color(0.5, 10, 'height')).toBe('');
    expect(color(10, 19.96, 'height')).toBe('');
    expect(color(10, -19.96, 'age')).toBe('');
  });
});
