import { describe, it, expect } from 'vitest';
import { validateGrowthJSON, parseDateValue } from './validation-utils';

describe('JSON Detailed Validation Utils', () => {
  it('should validate valid data successfully', () => {
    const validData = {
      childId: '001',
      birthDate: '2020/01/01',
      sex: '男子',
      gestationalWeeks: 40,
      gestationalDays: 0,
      measurements: [
        { id: '1', date: '2021/01/01', height: 75.5, weight: 9.8 },
        { id: '2', date: '2022/01/01', height: 86.0, weight: 12.1 },
      ],
    };

    const result = validateGrowthJSON(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  });

  it('should detect non-object root', () => {
    const result = validateGrowthJSON('invalid string');
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('正しいJSONオブジェクト形式');
  });

  it('should detect missing or invalid birthDate and future birthDate', () => {
    const missingBirth = {
      childId: '001',
      measurements: [{ date: '2021/01/01', height: 100 }],
    };
    const res1 = validateGrowthJSON(missingBirth);
    expect(res1.isValid).toBe(false);
    expect(res1.errors.some(e => e.field === 'birthDate')).toBe(true);

    const invalidBirth = {
      childId: '001',
      birthDate: 'not-a-date',
      measurements: [{ date: '2021/01/01', height: 100 }],
    };
    const res2 = validateGrowthJSON(invalidBirth);
    expect(res2.isValid).toBe(false);
    expect(res2.errors.some(e => e.message.includes('生年月日の形式が不正'))).toBe(true);

    const futureBirth = {
      childId: '001',
      birthDate: '2099/01/01',
      measurements: [{ date: '2099/05/01', height: 100 }],
    };
    const res3 = validateGrowthJSON(futureBirth);
    expect(res3.isValid).toBe(false);
    expect(res3.errors.some(e => e.message.includes('未来の日付'))).toBe(true);
  });

  it('should detect empty childId or unrecognized sex and warn', () => {
    const data = {
      birthDate: '2020/01/01',
      sex: 'unknown_gender',
      measurements: [{ date: '2021/01/01', height: 80, weight: 10 }],
    };
    const res = validateGrowthJSON(data);
    expect(res.warnings.some(w => w.field === 'childId')).toBe(true);
    expect(res.warnings.some(w => w.field === 'sex')).toBe(true);
  });

  it('should detect invalid gestational days and weeks', () => {
    const data = {
      childId: '001',
      birthDate: '2020/01/01',
      gestationalWeeks: 50,
      gestationalDays: 10,
      measurements: [],
    };
    const res = validateGrowthJSON(data);
    expect(res.warnings.some(w => w.field === 'gestationalWeeks')).toBe(true);
    expect(res.warnings.some(w => w.field === 'gestationalDays')).toBe(true);
    expect(res.warnings.some(w => w.field === 'measurements')).toBe(true);
  });

  it('should detect measurement date before birth date with row numbers', () => {
    const data = {
      childId: '001',
      birthDate: '2020/05/01',
      measurements: [
        { date: '2020/06/01', height: 60, weight: 5 },
        { date: '2019/01/01', height: 50, weight: 3 }, // row 2: before birth
      ],
    };

    const res = validateGrowthJSON(data);
    expect(res.isValid).toBe(false);
    const dateErr = res.errors.find(e => e.rowIndex === 2 && e.field.includes('date'));
    expect(dateErr).toBeDefined();
    expect(dateErr?.message).toContain('2行目: 測定日が生年月日より過去');
  });

  it('should detect missing measurement date and non-object rows', () => {
    const data = {
      childId: '001',
      birthDate: '2020/01/01',
      measurements: [
        'invalid item',
        { height: 80 }, // missing date
        { date: 'bad-date', height: 80 },
      ],
    };
    const res = validateGrowthJSON(data);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.message.includes('1行目: 測定データが正しいオブジェクトではありません'))).toBe(true);
    expect(res.errors.some(e => e.message.includes('2行目: 測定日が指定されていません'))).toBe(true);
    expect(res.errors.some(e => e.message.includes('3行目: 測定日（"bad-date"）の日付形式が不正'))).toBe(true);
  });

  it('should detect non-array measurements field', () => {
    const data = {
      childId: '001',
      birthDate: '2020/01/01',
      measurements: 'not-an-array',
    };
    const res = validateGrowthJSON(data);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.field === 'measurements')).toBe(true);
  });

  it('should detect negative or non-numeric height/weight with row numbers', () => {
    const data = {
      childId: '001',
      birthDate: '2020/01/01',
      measurements: [
        { date: '2021/01/01', height: -10, weight: 'abc' },
        { date: '2021/06/01', height: 'invalid-num', weight: -5 },
      ],
    };

    const res = validateGrowthJSON(data);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.message.includes('1行目: 身長は正の値'))).toBe(true);
    expect(res.errors.some(e => e.message.includes('1行目: 体重（"abc"）が数値ではありません'))).toBe(true);
    expect(res.errors.some(e => e.message.includes('2行目: 身長（"invalid-num"）が数値ではありません'))).toBe(true);
    expect(res.errors.some(e => e.message.includes('2行目: 体重は正の値'))).toBe(true);
  });

  it('should provide warnings for out-of-range clinical values and age > 18 without failing hard', () => {
    const data = {
      childId: '001',
      birthDate: '2000/01/01',
      gestationalWeeks: 20, // < 22w
      measurements: [
        { date: '2022/01/01', height: 250, weight: 150 }, // age 22y (>18y), extreme height & weight
      ],
    };

    const res = validateGrowthJSON(data);
    expect(res.isValid).toBe(true); // Warnings do not invalidate JSON structure
    expect(res.warnings.some(w => w.field === 'gestationalWeeks')).toBe(true);
    expect(res.warnings.some(w => w.message.includes('18歳を超えています'))).toBe(true);
    expect(res.warnings.some(w => w.message.includes('身長 (250 cm) が臨床標準範囲'))).toBe(true);
    expect(res.warnings.some(w => w.message.includes('体重 (150 kg) が臨床標準範囲'))).toBe(true);
  });

  describe('parseDateValue helper', () => {
    it('should parse valid Date instances', () => {
      const d = new Date(2020, 0, 1);
      expect(parseDateValue(d)).toEqual(d);
    });

    it('should return null for non-date non-string or invalid dates', () => {
      expect(parseDateValue(123)).toBeNull();
      expect(parseDateValue('completely invalid')).toBeNull();
      expect(parseDateValue(new Date('invalid'))).toBeNull();
    });
  });
});
