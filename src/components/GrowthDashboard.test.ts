import { describe, expect, it } from 'vitest';
import { getSuwaHVSDSClass } from './GrowthDashboard';

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