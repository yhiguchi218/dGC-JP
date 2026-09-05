import { isValid, parse, isAfter } from 'date-fns';
import { CLINICAL_LIMITS, DetailedValidationResult, ValidationIssue } from './constants';
import { calculateDecimalAge } from './growth-utils';

export interface RawMeasurementInput {
  id?: string;
  date?: string | Date;
  height?: number | string;
  weight?: number | string;
}

export interface RawGrowthJSONInput {
  childId?: any;
  birthDate?: any;
  sex?: any;
  gestationalWeeks?: any;
  gestationalDays?: any;
  measurements?: any;
}

export type SupportedSexInput = '男子' | '女子' | 'male' | 'female';
export type NormalizedSex = '男子' | '女子';

export function isValidSex(sexStr: unknown): sexStr is SupportedSexInput {
  return typeof sexStr === 'string' && ['男子', '女子', 'male', 'female'].includes(sexStr);
}

export function normalizeSex(sexStr: unknown): NormalizedSex {
  if (sexStr === '男子' || sexStr === 'male') return '男子';
  if (sexStr === '女子' || sexStr === 'female') return '女子';
  throw new Error('性別データが不正です。「男子」または「女子」を指定してください。');
}

/**
 * Validates a parsed JSON object for growth chart import with detailed field-level error messages.
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
    return { isValid: false, errors, warnings };
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
      message: '生年月日（birthDate）が指定されていません。',
      severity: 'error',
    });
  } else {
    parsedBirthDate = parseDateValue(input.birthDate);
    if (!parsedBirthDate || !isValid(parsedBirthDate)) {
      errors.push({
        field: 'birthDate',
        message: `生年月日の形式が不正です（入力値: "${input.birthDate}"、推奨形式: YYYY/MM/DD）。`,
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
  if (input.sex !== undefined) {
    if (!isValidSex(input.sex)) {
      errors.push({
        field: 'sex',
        message: `性別データが不正です（入力値: "${input.sex}"）。「男子」または「女子」を指定してください。`,
        severity: 'error',
      });
    }
  }

  // 4. Validate Gestational age
  if (input.gestationalWeeks !== undefined) {
    const weeks = Number(input.gestationalWeeks);
    if (isNaN(weeks) || weeks < CLINICAL_LIMITS.GESTATION_WEEKS.MIN || weeks > CLINICAL_LIMITS.GESTATION_WEEKS.MAX) {
      warnings.push({
        field: 'gestationalWeeks',
        message: `在胎週数 (${input.gestationalWeeks}週) が標準範囲 (${CLINICAL_LIMITS.GESTATION_WEEKS.MIN}〜${CLINICAL_LIMITS.GESTATION_WEEKS.MAX}週) 外です。計算時にクランプされます。`,
        severity: 'warning',
      });
    }
  }

  if (input.gestationalDays !== undefined) {
    const days = Number(input.gestationalDays);
    if (isNaN(days) || days < CLINICAL_LIMITS.GESTATION_DAYS.MIN || days > CLINICAL_LIMITS.GESTATION_DAYS.MAX) {
      warnings.push({
        field: 'gestationalDays',
        message: `在胎日数 (${input.gestationalDays}日) が0〜6日の範囲外です。`,
        severity: 'warning',
      });
    }
  }

  // 5. Validate measurements
  if (!Array.isArray(input.measurements)) {
    errors.push({
      field: 'measurements',
      message: '測定データ一覧（measurements）が配列形式ではありません。',
      severity: 'error',
    });
  } else if (input.measurements.length === 0) {
    warnings.push({
      field: 'measurements',
      message: '測定データが空です。',
      severity: 'warning',
    });
  } else {
    input.measurements.forEach((m: unknown, index: number) => {
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

      // Date validation
      if (!meas.date) {
        errors.push({
          field: `measurements[${index}].date`,
          rowIndex: rowNumber,
          message: `${rowNumber}行目: 測定日が指定されていません。`,
          severity: 'error',
        });
      } else {
        const mDate = parseDateValue(meas.date);
        if (!mDate || !isValid(mDate)) {
          errors.push({
            field: `measurements[${index}].date`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 測定日（"${meas.date}"）の日付形式が不正です。`,
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

      // Height validation
      if (meas.height !== undefined && meas.height !== null && meas.height !== '') {
        const heightVal = Number(meas.height);
        if (isNaN(heightVal)) {
          errors.push({
            field: `measurements[${index}].height`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 身長（"${meas.height}"）が数値ではありません。`,
            severity: 'error',
          });
        } else if (heightVal <= 0) {
          errors.push({
            field: `measurements[${index}].height`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 身長は正の値である必要があります（入力値: ${heightVal} cm）。`,
            severity: 'error',
          });
        } else if (heightVal < CLINICAL_LIMITS.HEIGHT.MIN || heightVal > CLINICAL_LIMITS.HEIGHT.MAX) {
          warnings.push({
            field: `measurements[${index}].height`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 身長 (${heightVal} cm) が臨床標準範囲 (${CLINICAL_LIMITS.HEIGHT.MIN}〜${CLINICAL_LIMITS.HEIGHT.MAX} cm) 外です。`,
            severity: 'warning',
          });
        }
      }

      // Weight validation
      if (meas.weight !== undefined && meas.weight !== null && meas.weight !== '') {
        const weightVal = Number(meas.weight);
        if (isNaN(weightVal)) {
          errors.push({
            field: `measurements[${index}].weight`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 体重（"${meas.weight}"）が数値ではありません。`,
            severity: 'error',
          });
        } else if (weightVal <= 0) {
          errors.push({
            field: `measurements[${index}].weight`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 体重は正の値である必要があります（入力値: ${weightVal} kg）。`,
            severity: 'error',
          });
        } else if (weightVal < CLINICAL_LIMITS.WEIGHT.MIN || weightVal > CLINICAL_LIMITS.WEIGHT.MAX) {
          warnings.push({
            field: `measurements[${index}].weight`,
            rowIndex: rowNumber,
            message: `${rowNumber}行目: 体重 (${weightVal} kg) が臨床標準範囲 (${CLINICAL_LIMITS.WEIGHT.MIN}〜${CLINICAL_LIMITS.WEIGHT.MAX} kg) 外です。`,
            severity: 'warning',
          });
        }
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Helper to parse various date formats safely
 */
export function parseDateValue(dateVal: string | Date | unknown): Date | null {
  if (dateVal instanceof Date) return isValid(dateVal) ? dateVal : null;
  if (typeof dateVal !== 'string') return null;

  // Try YYYY/MM/DD
  let parsed = parse(dateVal, 'yyyy/MM/dd', new Date());
  if (isValid(parsed)) return parsed;

  // Try ISO or standard constructor
  parsed = new Date(dateVal);
  if (isValid(parsed)) return parsed;

  return null;
}
