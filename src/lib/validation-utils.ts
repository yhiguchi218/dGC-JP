import { format, isValid, parse, isAfter } from 'date-fns';
import { CLINICAL_LIMITS, DEFAULT_GROWTH_REFERENCE, DetailedValidationResult, GROWTH_REFERENCES, GrowthReference, isGrowthReference, ValidationIssue } from './constants';
import { calculateDecimalAge, isValidGestationalDays, isValidGestationalWeeks } from './growth-utils';

export interface RawMeasurementInput {
  id?: string;
  date?: string | Date;
  height?: number | string;
  weight?: number | string;
}

export interface RawGrowthJSONInput {
  childId?: unknown;
  birthDate?: unknown;
  sex?: unknown;
  growthReference?: unknown;
  gestationalWeeks?: unknown;
  gestationalDays?: unknown;
  measurements?: unknown;
}

export type SupportedSexInput = '男子' | '女子' | 'male' | 'female';
export type NormalizedSex = '男子' | '女子';
const SUPPORTED_DATE_FORMATS = 'YYYY/MM/DD または YYYY-MM-DD';

export type MeasurementValueIssue = 'type' | 'not-a-number' | 'non-positive' | 'non-finite';
export type MeasurementValueParse =
  | { status: 'missing' }
  | { status: 'valid'; value: number }
  | { status: 'invalid'; issue: MeasurementValueIssue };

const POSITIVE_DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
const NEGATIVE_DECIMAL = /^-(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Interprets a height or weight value from JSON or the manual form.
 *
 * Not entered (undefined, null, empty or whitespace-only string) is `missing`, which is distinct from `invalid`.
 * Valid values are finite numbers > 0, or strings whose whole trimmed text is a plain decimal (no sign, exponent
 * or unit). Booleans, arrays, objects, 0, negatives, non-finite values and partially numeric text are `invalid`.
 */
export function parseMeasurementValue(raw: unknown): MeasurementValueParse {
  if (raw === undefined || raw === null) return { status: 'missing' };

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { status: 'invalid', issue: 'non-finite' };
    if (raw <= 0) return { status: 'invalid', issue: 'non-positive' };
    return { status: 'valid', value: raw };
  }

  if (typeof raw === 'string') {
    const text = raw.trim();
    if (text === '') return { status: 'missing' };
    if (NEGATIVE_DECIMAL.test(text)) return { status: 'invalid', issue: 'non-positive' };
    if (!POSITIVE_DECIMAL.test(text)) return { status: 'invalid', issue: 'not-a-number' };
    const value = Number(text);
    if (!Number.isFinite(value)) return { status: 'invalid', issue: 'non-finite' };
    if (value <= 0) return { status: 'invalid', issue: 'non-positive' };
    return { status: 'valid', value };
  }

  return { status: 'invalid', issue: 'type' };
}

/**
 * Checks whether an input is one of the supported Japanese or English sex labels accepted by import.
 */
export function isValidSex(sexStr: unknown): sexStr is SupportedSexInput {
  return typeof sexStr === 'string' && ['男子', '女子', 'male', 'female'].includes(sexStr);
}

/**
 * Normalizes a supported Japanese or English sex label to the dashboard's Japanese labels.
 *
 * Unsupported values throw rather than being mapped to a plausible value.
 */
export function normalizeSex(sexStr: unknown): NormalizedSex {
  if (sexStr === '男子' || sexStr === 'male') return '男子';
  if (sexStr === '女子' || sexStr === 'female') return '女子';
  throw new Error('性別データが不正です。「男子」または「女子」を指定してください。');
}

/**
 * Validates the structural and field-level conditions currently checked for growth-chart JSON import.
 *
 * Errors make `isValid` false and reject invalid required fields, including invalid gestational days.
 * Warnings report accepted but notable conditions, such as empty measurements or values outside configured
 * ranges, without making the result invalid. This validation does not establish complete clinical validity.
 */
export function validateGrowthJSON(data: unknown): DetailedValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!data || typeof data !== 'object') {
    errors.push({
      field: 'root',
      message: 'データが正しいJSONオブジェクト形式ではありません。',
      severity: 'error',
    });
    return {
      isValid: false,
      errors,
      warnings,
      sex: null,
      growthReference: null,
      gestationalAge: { weeks: CLINICAL_LIMITS.GESTATION_WEEKS.DEFAULT, days: CLINICAL_LIMITS.GESTATION_DAYS.DEFAULT },
      measurementValues: [],
      parsedDates: { birthDate: null, measurements: [] },
    };
  }

  const input = data as RawGrowthJSONInput;

  // 1. Validate childId
  if (input.childId === undefined || input.childId === null || String(input.childId).trim() === '') {
    warnings.push({
      field: 'childId',
      message: '管理IDが空です（デフォルトID「001」が適用されます）。',
      severity: 'warning',
    });
  }

  // 2. Validate birthDate
  let parsedBirthDate: Date | null = null;
  if (!input.birthDate) {
    errors.push({
      field: 'birthDate',
      message: `生年月日（birthDate）が指定されていません。受け入れ形式: ${SUPPORTED_DATE_FORMATS}。`,
      severity: 'error',
    });
  } else {
    parsedBirthDate = parseDateValue(input.birthDate);
    if (!parsedBirthDate || !isValid(parsedBirthDate)) {
      errors.push({
        field: 'birthDate',
        message: `生年月日の形式が不正です（入力値: "${input.birthDate}"）。受け入れ形式: ${SUPPORTED_DATE_FORMATS}。`,
        severity: 'error',
      });
    } else {
      const now = new Date();
      if (isAfter(parsedBirthDate, now)) {
        errors.push({
          field: 'birthDate',
          message: '生年月日が未来の日付になっています。',
          severity: 'error',
        });
      }
    }
  }

  // 3. Validate Sex
  let normalizedSex: NormalizedSex | null = null;
  if (input.sex === undefined || input.sex === null || (typeof input.sex === 'string' && input.sex.trim() === '')) {
    errors.push({
      field: 'sex',
      message: '性別が指定されていません。「男子」または「女子」（male / female も可）を指定してください。',
      severity: 'error',
    });
  } else if (!isValidSex(input.sex)) {
    errors.push({
      field: 'sex',
      message: `性別の値が不正です（入力値: "${typeof input.sex === 'string' ? input.sex : JSON.stringify(input.sex)}"）。「男子」または「女子」（male / female も可）を指定してください。`,
      severity: 'error',
    });
  } else {
    normalizedSex = normalizeSex(input.sex);
  }

  // 3b. Validate growth reference: omitted means the Japanese reference (legacy files); anything else
  // that is not an exact identifier (null, empty string, unknown text, other types) rejects the whole load.
  let growthReference: GrowthReference | null = null;
  if (input.growthReference === undefined) {
    growthReference = DEFAULT_GROWTH_REFERENCE;
  } else if (isGrowthReference(input.growthReference)) {
    growthReference = input.growthReference;
  } else {
    const shown = typeof input.growthReference === 'string' ? input.growthReference : JSON.stringify(input.growthReference);
    errors.push({
      field: 'growthReference',
      message: `成長基準（growthReference）の値が不正です（入力値: ${typeof input.growthReference === 'string' ? `"${shown}"` : shown}）。${GROWTH_REFERENCES.map(id => `"${id}"`).join(' または ')} を指定するか、項目を省略してください。`,
      severity: 'error',
    });
  }

  // 4. Validate Gestational age
  let gestationalWeeks: number = CLINICAL_LIMITS.GESTATION_WEEKS.DEFAULT;
  if (input.gestationalWeeks !== undefined) {
    if (!isValidGestationalWeeks(input.gestationalWeeks)) {
      errors.push({
        field: 'gestationalWeeks',
        message: '在胎週数は有限の整数で指定してください。',
        severity: 'error',
      });
    } else {
      gestationalWeeks = input.gestationalWeeks;
    }
    if (isValidGestationalWeeks(input.gestationalWeeks)
      && (input.gestationalWeeks < CLINICAL_LIMITS.GESTATION_WEEKS.MIN || input.gestationalWeeks >= CLINICAL_LIMITS.GESTATION_WEEKS.MAX)) {
      warnings.push({
        field: 'gestationalWeeks',
        message: `在胎週数 ${input.gestationalWeeks}週は${input.gestationalWeeks < CLINICAL_LIMITS.GESTATION_WEEKS.MIN ? '22週0日' : '44週0日'}として計算されます。`,
        severity: 'warning',
      });
    }
  }

  let gestationalDays: number = CLINICAL_LIMITS.GESTATION_DAYS.DEFAULT;
  if (input.gestationalDays !== undefined) {
    if (!isValidGestationalDays(input.gestationalDays)) {
      errors.push({
        field: 'gestationalDays',
        message: `在胎日数は${CLINICAL_LIMITS.GESTATION_DAYS.MIN}〜${CLINICAL_LIMITS.GESTATION_DAYS.MAX}日の整数で指定してください。`,
        severity: 'error',
      });
    } else {
      gestationalDays = input.gestationalDays;
    }
  }

  // 5. Validate measurements
  const measurementInputs = input.measurements;
  const parsedMeasurementDates: (Date | null)[] = Array.isArray(measurementInputs)
    ? Array(measurementInputs.length).fill(null)
    : [];
  const measurementValues: DetailedValidationResult['measurementValues'] = Array.isArray(measurementInputs)
    ? Array(measurementInputs.length).fill(null)
    : [];
  if (!Array.isArray(measurementInputs)) {
    errors.push({
      field: 'measurements',
      message: '測定データ一覧（measurements）が配列形式ではありません。',
      severity: 'error',
    });
  } else if (measurementInputs.length === 0) {
    warnings.push({
      field: 'measurements',
      message: '測定データが空です。',
      severity: 'warning',
    });
  } else {
    // Row number of the first row using each non-empty string id; rows are never merged or dropped.
    const firstRowById = new Map<string, number>();
    measurementInputs.forEach((m: unknown, index: number) => {
      const rowNumber = index + 1;
      if (!m || typeof m !== 'object') {
        errors.push({
          field: `measurements[${index}]`,
          rowIndex: rowNumber,
          message: `${rowNumber}行目: 測定データが正しいオブジェクトではありません。`,
          severity: 'error',
        });
        return;
      }

      const meas = m as RawMeasurementInput;

      const id: unknown = meas.id;
      if (typeof id === 'string' && id !== '') {
        const firstRow = firstRowById.get(id);
        if (firstRow === undefined) {
          firstRowById.set(id, rowNumber);
        } else {
          errors.push({
            field: `measurements[${index}].id`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 測定データのid（"${id}"）が${firstRow}行目と重複しています。各行に異なるidを指定してください。`,
            severity: 'error',
          });
        }
      }

      // Date validation
      if (!meas.date) {
        errors.push({
          field: `measurements[${index}].date`,
          rowIndex: rowNumber,
          message: `${rowNumber}行目: 測定日が指定されていません。受け入れ形式: ${SUPPORTED_DATE_FORMATS}。`,
          severity: 'error',
        });
      } else {
        const mDate = parseDateValue(meas.date);
        parsedMeasurementDates[index] = mDate;
        if (!mDate || !isValid(mDate)) {
          errors.push({
            field: `measurements[${index}].date`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 測定日（"${meas.date}"）の日付形式が不正です。受け入れ形式: ${SUPPORTED_DATE_FORMATS}。`,
            severity: 'error',
          });
        } else if (parsedBirthDate && isValid(parsedBirthDate)) {
          if (mDate < parsedBirthDate) {
            errors.push({
              field: `measurements[${index}].date`,
              rowIndex: rowNumber,
              message: `${rowNumber}行目: 測定日が生年月日より過去の日付になっています。`,
              severity: 'error',
            });
          } else {
            const age = calculateDecimalAge(parsedBirthDate, mDate);
            if (age !== null && age > CLINICAL_LIMITS.AGE.MAX) {
              warnings.push({
                field: `measurements[${index}].date`,
                rowIndex: rowNumber,
                message: `${rowNumber}行目: 測定時の年齢 (${age.toFixed(1)}歳) が${CLINICAL_LIMITS.AGE.MAX}歳を超えています。`,
                severity: 'warning',
              });
            }
          }
        }
      }

      // Height / weight validation (shared rules; the validated numbers are what import uses)
      const fields = [
        { key: 'height' as const, label: '身長', unit: 'cm', range: CLINICAL_LIMITS.HEIGHT },
        { key: 'weight' as const, label: '体重', unit: 'kg', range: CLINICAL_LIMITS.WEIGHT },
      ];
      const parsedValues: { height: number | null; weight: number | null } = { height: null, weight: null };
      let hasInvalidValue = false;
      fields.forEach(({ key, label, unit, range }) => {
        const raw = meas[key];
        const parsed = parseMeasurementValue(raw);
        if (parsed.status === 'missing') return;
        const field = `measurements[${index}].${key}`;
        if (parsed.status === 'invalid') {
          hasInvalidValue = true;
          const shown = typeof raw === 'string' ? raw : String(raw);
          const message = {
            'type': `${rowNumber}行目: ${label}は数値または数値文字列で指定してください（真偽値・配列・オブジェクトは受け付けません）。`,
            'not-a-number': `${rowNumber}行目: ${label}（"${shown}"）が数値ではありません。`,
            'non-positive': `${rowNumber}行目: ${label}は正の値である必要があります（入力値: ${shown.trim()} ${unit}）。`,
            'non-finite': `${rowNumber}行目: ${label}（"${shown}"）が有限の数値ではありません。`,
          }[parsed.issue];
          errors.push({ field, rowIndex: rowNumber, message, severity: 'error' });
          return;
        }
        parsedValues[key] = parsed.value;
        if (parsed.value < range.MIN || parsed.value > range.MAX) {
          warnings.push({
            field,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: ${label} (${parsed.value} ${unit}) が臨床標準範囲 (${range.MIN}〜${range.MAX} ${unit}) 外です。`,
            severity: 'warning',
          });
        }
      });

      if (!hasInvalidValue && parsedValues.height === null && parsedValues.weight === null) {
        errors.push({
          field: `measurements[${index}]`,
          rowIndex: rowNumber,
          message: `${rowNumber}行目: 身長・体重のどちらも入力されていません。少なくともどちらか一方を指定してください。`,
          severity: 'error',
        });
      }
      measurementValues[index] = parsedValues;
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sex: normalizedSex,
    growthReference,
    gestationalAge: { weeks: gestationalWeeks, days: gestationalDays },
    measurementValues,
    parsedDates: { birthDate: parsedBirthDate, measurements: parsedMeasurementDates },
  };
}

/**
 * Parses valid `Date` values and strict local calendar-date strings for JSON import.
 *
 * Strings must use `YYYY/MM/DD` or `YYYY-MM-DD`; other input types and invalid dates return `null`.
 */
export function parseDateValue(dateVal: string | Date | unknown): Date | null {
  if (dateVal instanceof Date) return isValid(dateVal) ? dateVal : null;
  if (typeof dateVal !== 'string') return null;

  const normalized = dateVal.trim();
  const match = /^(\d{4})(\/|-)(\d{2})\2(\d{2})$/.exec(normalized);
  if (!match) return null;

  const dateFormat = match[2] === '/' ? 'yyyy/MM/dd' : 'yyyy-MM-dd';
  const parsed = parse(normalized, dateFormat, new Date());
  if (!isValid(parsed) || format(parsed, dateFormat) !== normalized) return null;
  return parsed;
}
