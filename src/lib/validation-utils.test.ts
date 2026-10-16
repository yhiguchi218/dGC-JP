import { describe, it, expect } from 'vitest';
import { validateGrowthJSON, parseDateValue, isValidSex, normalizeSex } from './validation-utils';

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

  it('should detect empty childId and still warn', () => {
    const data = {
      birthDate: '2020/01/01',
      measurements: [{ date: '2021/01/01', height: 80, weight: 10 }],
    };
    const res = validateGrowthJSON(data);
    expect(res.warnings.some(w => w.field === 'childId')).toBe(true);
  });

  it('should fail closed for unsupported sex values', () => {
    const data = {
      birthDate: '2020/01/01',
      sex: 'unknown_gender',
      measurements: [{ date: '2021/01/01', height: 80, weight: 10 }],
    };
    const res = validateGrowthJSON(data);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.field === 'sex')).toBe(true);
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
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.field === 'gestationalDays')).toBe(true);
    expect(res.errors.some(e => e.message === '在胎日数は0〜6日の整数で指定してください。')).toBe(true);
    expect(res.warnings.some(w => w.field === 'measurements')).toBe(true);
  });

  it.each([-1, 7, 1.5, Number.NaN, Infinity, 'invalid'])('rejects invalid gestational days: %s', (gestationalDays) => {
    const res = validateGrowthJSON({
      birthDate: '2020/01/01',
      gestationalDays,
      measurements: [],
    });

    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.field === 'gestationalDays')).toBe(true);
  });

  it.each([null, '0', '3', '', ' ', true, [], {}, 1.5, Number.NaN, Infinity])(
    'rejects invalid gestational weeks without coercion: %j',
    (gestationalWeeks) => {
      const result = validateGrowthJSON({
        birthDate: '2020/01/01',
        gestationalWeeks,
        gestationalDays: 0,
        measurements: [],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.field === 'gestationalWeeks')).toBe(true);
      expect(result.warnings.some(warning => warning.field === 'gestationalWeeks')).toBe(false);
    }
  );

  it.each([null, '0', '4', true, [], {}, 1.5, Number.NaN, Infinity])(
    'rejects explicit invalid gestational days: %j',
    (gestationalDays) => {
      const result = validateGrowthJSON({
        birthDate: '2020/01/01',
        gestationalWeeks: 35,
        gestationalDays,
        measurements: [],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.field === 'gestationalDays')).toBe(true);
    }
  );

  it('defaults only omitted gestational fields for legacy JSON', () => {
    const result = validateGrowthJSON({
      birthDate: '2020/01/01',
      measurements: [],
    });

    expect(result.isValid).toBe(true);
    expect(result.gestationalAge).toEqual({ weeks: 40, days: 0 });
  });

  it.each([0, 6])('accepts valid gestational days as numeric values: %i', (gestationalDays) => {
    const result = validateGrowthJSON({
      birthDate: '2020/01/01',
      gestationalWeeks: 35,
      gestationalDays,
      measurements: [],
    });

    expect(result.isValid).toBe(true);
    expect(result.gestationalAge).toEqual({ weeks: 35, days: gestationalDays });
  });

  it('accepts the specified 35-week-4-day gestational age as numeric values', () => {
    const result = validateGrowthJSON({
      birthDate: '2020/01/01',
      gestationalWeeks: 35,
      gestationalDays: 4,
      measurements: [],
    });

    expect(result.isValid).toBe(true);
    expect(result.gestationalAge).toEqual({ weeks: 35, days: 4 });
  });

  it.each([
    [20, '22週0日'],
    [45, '44週0日'],
  ])('accepts integer week %i with the existing clamp warning', (gestationalWeeks, clampedGestation) => {
    const result = validateGrowthJSON({
      birthDate: '2020/01/01',
      gestationalWeeks,
      gestationalDays: 5,
      measurements: [],
    });

    expect(result.isValid).toBe(true);
    expect(result.gestationalAge).toEqual({ weeks: gestationalWeeks, days: 5 });
    expect(result.warnings.find(warning => warning.field === 'gestationalWeeks')?.message).toContain(clampedGestation);
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
    it.each([
      ['2020/02/29', 2020, 2, 29],
      ['2020-02-29', 2020, 2, 29],
      ['2021/02/28', 2021, 2, 28],
      ['2020/12/31', 2020, 12, 31],
      ['2000/02/29', 2000, 2, 29],
      ['  2020/02/29  ', 2020, 2, 29],
      ['\t2020-02-29\n', 2020, 2, 29],
    ])('parses strict local calendar date %j', (input, year, month, day) => {
      const parsed = parseDateValue(input);
      expect(parsed).not.toBeNull();
      expect([parsed?.getFullYear(), (parsed?.getMonth() ?? -1) + 1, parsed?.getDate()]).toEqual([year, month, day]);
    });

    it.each([
      '2020/02/30', '2021/02/29', '1900/02/29', '2020-02-30', '2020/04/31',
      '2020/00/01', '2020/13/01', '2020/01/00', '2020/01/32', '1', '', '   ',
      'not-a-date', '２０２０/０２/２９', '2020/2/09', '2020/02-29', '02/29/2020',
      '2020-02-29T00:00:00Z', '2020-02-29T00:00:00+09:00',
    ])('rejects non-date or non-strict date string %j', (input) => {
      expect(parseDateValue(input)).toBeNull();
    });

    it.each([123, null, undefined, [], {}, new Date('invalid')])('rejects unsupported date input %j', (input) => {
      expect(parseDateValue(input)).toBeNull();
    });

    it('preserves valid Date instances', () => {
      const d = new Date(2020, 0, 1);
      expect(parseDateValue(d)).toEqual(d);
      expect(parseDateValue(d)).toBe(d);
    });
  });

  describe('sex normalization helpers', () => {
    it('should recognize all supported Japanese and English sex values', () => {
      expect(isValidSex('男子')).toBe(true);
      expect(isValidSex('女子')).toBe(true);
      expect(isValidSex('male')).toBe(true);
      expect(isValidSex('female')).toBe(true);
      expect(isValidSex('other')).toBe(false);
    });

    it('should normalize English and Japanese sex values', () => {
      expect(normalizeSex('男子')).toBe('男子');
      expect(normalizeSex('male')).toBe('男子');
      expect(normalizeSex('女子')).toBe('女子');
      expect(normalizeSex('female')).toBe('女子');
      expect(() => normalizeSex('other')).toThrow('性別データが不正です');
    });
  });
});
