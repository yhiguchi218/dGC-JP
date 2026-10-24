/**
 * Types for obesity index calculation methods.
 */
export type ObesityMethod = 'height' | 'age';

/**
 * Classification result for obesity index.
 */
export interface ObesityClassification {
  category: string; // Category name (e.g., "太りすぎ", "軽度肥満")
  colorClass: string; // Tailwind CSS class for coloring
  note?: string; // Additional note (e.g., for infants)
}

/**
 * Determines the obesity classification based on age, index value, and method.

 * @param age Chronological age in years (decimal).
 * @param index The raw obesity index percentage.
 * @param method The calculation method used ('height' or 'age').
 * @returns ObesityClassification or null if not applicable (e.g., invalid input, >= 18y).
 */
export function getObesityClassification(
  age: number,
  index: number | null,
  method: ObesityMethod
): ObesityClassification | null {
  if (index === null || !Number.isFinite(index) || age < 0 || !Number.isFinite(age)) {
    return null;
  }

  const years = age;

  // 18 years or older: Not subject to classification
  if (years >= 18) {
    return null;
  }

  // Under 1 year: Reference only, no category/color
  if (years < 1) {
    return {
      category: '',
      colorClass: '',
      note: '参考値・乳児の肥満判定には用いません',
    };
  }

  // 1 to under 6 years (Toddler)
  if (years < 6) {
    if (index >= 30) {
      return { category: '太りすぎ', colorClass: 'text-red-600 dark:text-red-400 font-bold' };
    } else if (index >= 20) {
      return { category: 'やや太りすぎ', colorClass: 'text-orange-500 dark:text-orange-300 font-bold' };
    } else if (index >= 15) {
      return { category: '太りぎみ', colorClass: 'text-yellow-600 dark:text-yellow-400 font-bold' };
    } else {
      return { category: '', colorClass: '' };
    }
  }

  // 6 to under 18 years (School-age)
  if (years < 18) {
    // Obesity side
    if (index >= 50) {
      return { category: '高度肥満', colorClass: 'text-red-700 dark:text-red-400 font-bold' };
    } else if (index >= 30) {
      return { category: '中等度肥満', colorClass: 'text-orange-600 dark:text-orange-300 font-bold' };
    } else if (index >= 20) {
      return { category: '軽度肥満', colorClass: 'text-yellow-700 dark:text-yellow-400 font-bold' };
    }

    // Underweight side - Only for Age-Specific method ('age')
    if (method === 'age') {
      if (index <= -30) {
        return { category: '高度のやせ', colorClass: 'text-blue-700 dark:text-blue-400 font-bold' };
      } else if (index <= -20) {
        return { category: 'やせ', colorClass: 'text-blue-500 dark:text-blue-300 font-bold' };
      }
    }

    // Neutral range or Height-Specific underweight
    return { category: '', colorClass: '' };
  }

  return null;
}
