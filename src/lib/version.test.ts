import { describe, expect, it } from 'vitest';
import {
  APP_VERSION,
  REFERENCE_VERSION,
  CALCULATION_ENGINE_VERSION,
  CLINICAL_REFERENCES,
} from './version';

describe('version metadata', () => {
  it('exports the expected application and reference versions', () => {
    expect(APP_VERSION).toBe('0.1.0-dev');
    expect(REFERENCE_VERSION).toBe('Japan 2000 Growth Standard');
    expect(CALCULATION_ENGINE_VERSION).toBe('2026-09');
  });

  it('exports the expected clinical reference labels', () => {
    expect(CLINICAL_REFERENCES.HEIGHT_WEIGHT_LMS).toContain('Isojima');
    expect(CLINICAL_REFERENCES.FUHYO_MONTHLY).toContain('Attached Table 1');
    expect(CLINICAL_REFERENCES.HEIGHT_VELOCITY).toContain('Suwa');
    expect(CLINICAL_REFERENCES.OBESITY_INDEX).toContain('JSPE');
  });
});
