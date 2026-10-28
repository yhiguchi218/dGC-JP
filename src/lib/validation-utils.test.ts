import { describe, it, expect } from 'vitest';
import { validateGrowthJSON, parseDateValue, isValidSex, normalizeSex, parseMeasurementValue } from './validation-utils';

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
      sex: '男子',
      measurements: [],
    });

    expect(result.isValid).toBe(true);
    expect(result.gestationalAge).toEqual({ weeks: 40, days: 0 });
  });

  it.each([0, 6])('accepts valid gestational days as numeric values: %i', (gestationalDays) => {
    const result = validateGrowthJSON({
      birthDate: '2020/01/01',
      sex: '男子',
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
      sex: '男子',
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
      sex: '男子',
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
      sex: '女子',
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

  describe('sex is required (no implicit male default)', () => {
    const base = { birthDate: '2020/01/01', measurements: [{ date: '2021/01/01', height: 80, weight: 10 }] };

    it('rejects an omitted sex with a "not specified" reason', () => {
      const res = validateGrowthJSON(base);
      expect(res.isValid).toBe(false);
      expect(res.sex).toBeNull();
      expect(res.errors.find(e => e.field === 'sex')?.message).toContain('性別が指定されていません');
    });

    it.each([null, '', '   ', '\t'])('rejects a blank sex %j as not specified', (sex) => {
      const res = validateGrowthJSON({ ...base, sex });
      expect(res.isValid).toBe(false);
      expect(res.errors.find(e => e.field === 'sex')?.message).toContain('性別が指定されていません');
    });

    it.each(['unknown', 'Male', ' 男子', '男', 0, true, [], {}])('rejects an invalid sex %j with an "invalid value" reason', (sex) => {
      const res = validateGrowthJSON({ ...base, sex });
      expect(res.isValid).toBe(false);
      expect(res.sex).toBeNull();
      expect(res.errors.find(e => e.field === 'sex')?.message).toContain('性別の値が不正です');
    });

    it.each([['男子', '男子'], ['女子', '女子'], ['male', '男子'], ['female', '女子']])('keeps accepting %s and reports %s', (sex, expected) => {
      const res = validateGrowthJSON({ ...base, sex });
      expect(res.isValid).toBe(true);
      expect(res.sex).toBe(expected);
    });
  });

  describe('measurement ids are unique within a file', () => {
    const validate = (measurements: unknown[]) => validateGrowthJSON({ birthDate: '2020/01/01', sex: '男子', measurements });

    it('rejects a duplicated non-empty string id and names the row and the first row using it', () => {
      const res = validate([
        { id: 'dup', date: '2021/01/01', height: 80, weight: 10 },
        { id: 'other', date: '2021/06/01', height: 84 },
        { id: 'dup', date: '2022/01/01', weight: 12 },
      ]);
      expect(res.isValid).toBe(false);
      expect(res.errors).toEqual([expect.objectContaining({
        field: 'measurements[2].id',
        rowIndex: 3,
        message: expect.stringContaining('3行目: 測定データのid（"dup"）が1行目と重複しています'),
        severity: 'error',
      })]);
    });

    it('reports every repeated row of the same id against its first row', () => {
      const res = validate([
        { id: 'x', date: '2021/01/01', height: 80 },
        { id: 'x', date: '2021/02/01', height: 81 },
        { id: 'x', date: '2021/03/01', height: 82 },
      ]);
      expect(res.errors.map(e => e.message)).toEqual([
        expect.stringContaining('2行目: 測定データのid（"x"）が1行目と重複しています'),
        expect.stringContaining('3行目: 測定データのid（"x"）が1行目と重複しています'),
      ]);
    });

    it('compares ids exactly (case and surrounding spaces are significant)', () => {
      const res = validate([
        { id: 'a', date: '2021/01/01', height: 80 },
        { id: 'A', date: '2021/01/01', height: 80 },
        { id: ' a', date: '2021/01/01', height: 80 },
      ]);
      expect(res.isValid).toBe(true);
    });

    it('does not treat omitted, empty, or non-string ids as duplicates, and does not reject the same measurement date', () => {
      const res = validate([
        { date: '2021/01/01', height: 80 },
        { date: '2021/01/01', weight: 10 },
        { id: '', date: '2021/01/01', height: 81 },
        { id: '', date: '2021/01/01', height: 82 },
        { id: 1, date: '2021/01/01', height: 83 },
        { id: 1, date: '2021/01/01', height: 84 },
      ]);
      expect(res.isValid).toBe(true);
      expect(res.measurementValues).toHaveLength(6);
    });
  });

  describe('measurement value rules (height and weight)', () => {
    const validate = (measurements: unknown[]) => validateGrowthJSON({ birthDate: '2020/01/01', sex: '男子', measurements });
    const row = (extra: Record<string, unknown>) => ({ date: '2021/01/01', ...extra });

    it.each([
      ['positive numbers', 80.5, 10.2, 80.5, 10.2],
      ['numeric strings', '80.5', '10.2', 80.5, 10.2],
      ['strings with surrounding whitespace', '  80.5 ', '\t10.2\n', 80.5, 10.2],
      ['saved partial-typing forms', '80.', '.5', 80, 0.5],
    ])('accepts %s and returns the normalized numbers', (_label, height, weight, expectedHeight, expectedWeight) => {
      const res = validate([row({ height, weight })]);
      expect(res.isValid).toBe(true);
      expect(res.measurementValues).toEqual([{ height: expectedHeight, weight: expectedWeight }]);
    });

    it.each([
      ['height only', { height: 80 }, { height: 80, weight: null }],
      ['weight only', { weight: 10 }, { height: null, weight: 10 }],
      ['null/blank for the other value', { height: 80, weight: null }, { height: 80, weight: null }],
      ['blank strings for the other value', { height: '  ', weight: 10 }, { height: null, weight: 10 }],
    ])('accepts %s', (_label, values, expected) => {
      const res = validate([row(values)]);
      expect(res.isValid).toBe(true);
      expect(res.measurementValues).toEqual([expected]);
    });

    it.each([
      ['both omitted', {}],
      ['both null', { height: null, weight: null }],
      ['both empty strings', { height: '', weight: '' }],
      ['both whitespace-only', { height: ' ', weight: '\t' }],
    ])('rejects a row where %s, naming the row', (_label, values) => {
      const res = validate([row({ height: 70, weight: 8 }), row(values)]);
      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.rowIndex === 2 && e.message.includes('2行目: 身長・体重のどちらも入力されていません'))).toBe(true);
    });

    it.each([
      ['boolean', true],
      ['false', false],
      ['array', [5]],
      ['empty array', []],
      ['object', {}],
    ])('rejects a %s height without coercion', (_label, height) => {
      const res = validate([row({ height, weight: 10 })]);
      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.field === 'measurements[0].height' && e.message.includes('数値または数値文字列'))).toBe(true);
    });

    it.each(['100cm', '10kg', '100abc', '1e2', '+5', ' +5 ', ' 1e2 ', '１２３', '１．５', '1,5', '1 0', '０', '0x10', 'Infinity', 'NaN', '-'])('rejects non-decimal text %j', (text) => {
      const res = validate([row({ height: text, weight: 10 })]);
      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.field === 'measurements[0].height')).toBe(true);
    });

    it.each([0, -1, -0.5, '0', '0.0', '-5', '00'])('rejects zero and negative value %j for both fields', (value) => {
      const asHeight = validate([row({ height: value, weight: 10 })]);
      const asWeight = validate([row({ height: 80, weight: value })]);
      expect(asHeight.isValid).toBe(false);
      expect(asHeight.errors.some(e => e.field === 'measurements[0].height' && e.message.includes('正の値'))).toBe(true);
      expect(asWeight.isValid).toBe(false);
      expect(asWeight.errors.some(e => e.field === 'measurements[0].weight' && e.message.includes('正の値'))).toBe(true);
    });

    it('rejects values that are not finite after parsing', () => {
      const huge = '9'.repeat(400);
      const fromText = validate([row({ height: huge, weight: 10 })]);
      const fromJson = validateGrowthJSON(JSON.parse('{"birthDate":"2020/01/01","sex":"男子","measurements":[{"date":"2021/01/01","height":1e999,"weight":10}]}'));
      expect(fromText.isValid).toBe(false);
      expect(fromJson.isValid).toBe(false);
    });

    it('distinguishes the JSON number 1e2 (parsed to 100, accepted) from the string "1e2" (rejected)', () => {
      const text = (height: string) => `{"birthDate":"2020/01/01","sex":"男子","measurements":[{"date":"2021/01/01","height":${height}}]}`;
      const asNumber = validateGrowthJSON(JSON.parse(text('1e2')));
      const asString = validateGrowthJSON(JSON.parse(text('"1e2"')));

      expect(asNumber.isValid).toBe(true);
      expect(asNumber.measurementValues).toEqual([{ height: 100, weight: null }]);
      expect(asString.isValid).toBe(false);
      expect(asString.errors.some(e => e.field === 'measurements[0].height')).toBe(true);
    });

    it('rejects a row with one valid and one invalid value instead of keeping the valid one', () => {
      const res = validate([row({ height: 80, weight: 'abc' })]);
      expect(res.isValid).toBe(false);
      expect(res.errors.every(e => e.field !== 'measurements[0]')).toBe(true);
      expect(res.errors.some(e => e.field === 'measurements[0].weight')).toBe(true);
    });

    it('rejects the whole file when only a later row is invalid', () => {
      const res = validate([row({ height: 70, weight: 8 }), row({ height: 75, weight: 9 }), row({ height: true })]);
      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.rowIndex === 3)).toBe(true);
      expect(res.errors.every(e => e.rowIndex === 3)).toBe(true);
    });

    it('keeps the clinical-range warnings for valid values', () => {
      const res = validate([row({ height: '250', weight: '150' })]);
      expect(res.isValid).toBe(true);
      expect(res.warnings.filter(w => w.field.startsWith('measurements[0]')).length).toBe(2);
    });
  });

  describe('parseMeasurementValue', () => {
    it('distinguishes not entered from invalid', () => {
      [undefined, null, '', '  '].forEach(v => expect(parseMeasurementValue(v)).toEqual({ status: 'missing' }));
      [0, '0', -1, Number.NaN, Infinity, true, [], {}, '12abc'].forEach(v => expect(parseMeasurementValue(v).status).toBe('invalid'));
      expect(parseMeasurementValue('12.5')).toEqual({ status: 'valid', value: 12.5 });
    });
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
