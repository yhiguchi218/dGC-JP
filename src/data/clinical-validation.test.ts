import { describe, it, expect } from 'vitest';
import { HEIGHT_BOYS_LMS, HEIGHT_GIRLS_LMS, WEIGHT_BOYS_LMS, WEIGHT_GIRLS_LMS } from './growth-data';
import { FUHYO_BOYS_HEIGHT, FUHYO_GIRLS_HEIGHT } from './fuhyo-growth-data';
import { SUWA_HV_BOYS, SUWA_HV_GIRLS } from './suwa-hv-data';

describe('Clinical Pediatric Growth Reference Data Validation', () => {
  
  describe('LMS Growth Curves (Height & Weight)', () => {
    
    it('HEIGHT_BOYS_LMS and HEIGHT_GIRLS_LMS should show monotonic median height increase', () => {
      // Boys Monotonicity
      for (let i = 0; i < HEIGHT_BOYS_LMS.length - 1; i++) {
        expect(HEIGHT_BOYS_LMS[i + 1].M).toBeGreaterThanOrEqual(HEIGHT_BOYS_LMS[i].M);
        expect(HEIGHT_BOYS_LMS[i].age).toBeLessThan(HEIGHT_BOYS_LMS[i + 1].age);
      }
      
      // Girls Monotonicity
      for (let i = 0; i < HEIGHT_GIRLS_LMS.length - 1; i++) {
        expect(HEIGHT_GIRLS_LMS[i + 1].M).toBeGreaterThanOrEqual(HEIGHT_GIRLS_LMS[i].M);
        expect(HEIGHT_GIRLS_LMS[i].age).toBeLessThan(HEIGHT_GIRLS_LMS[i + 1].age);
      }
    });

    it('WEIGHT_BOYS_LMS and WEIGHT_GIRLS_LMS should show monotonic median weight increase', () => {
      // Boys Monotonicity
      for (let i = 0; i < WEIGHT_BOYS_LMS.length - 1; i++) {
        expect(WEIGHT_BOYS_LMS[i + 1].M).toBeGreaterThanOrEqual(WEIGHT_BOYS_LMS[i].M);
        expect(WEIGHT_BOYS_LMS[i].age).toBeLessThan(WEIGHT_BOYS_LMS[i + 1].age);
      }

      // Girls Monotonicity
      for (let i = 0; i < WEIGHT_GIRLS_LMS.length - 1; i++) {
        expect(WEIGHT_GIRLS_LMS[i + 1].M).toBeGreaterThanOrEqual(WEIGHT_GIRLS_LMS[i].M);
        expect(WEIGHT_GIRLS_LMS[i].age).toBeLessThan(WEIGHT_GIRLS_LMS[i + 1].age);
      }
    });

    it('LMS values should stay within clinically plausible physiological ranges', () => {
      // Height Spot Checks
      const bBirthH = HEIGHT_BOYS_LMS[0];
      const bAdultH = HEIGHT_BOYS_LMS[HEIGHT_BOYS_LMS.length - 1];
      expect(bBirthH.M).toBeCloseTo(49.0, 1);
      expect(bAdultH.M).toBeCloseTo(170.7, 1);
      
      const gBirthH = HEIGHT_GIRLS_LMS[0];
      const gAdultH = HEIGHT_GIRLS_LMS[HEIGHT_GIRLS_LMS.length - 1];
      expect(gBirthH.M).toBeCloseTo(48.5, 1);
      expect(gAdultH.M).toBeCloseTo(157.9, 1);

      // Height L parameter should always be 1.0 (Japan pediatric clinical normal distribution assumption)
      HEIGHT_BOYS_LMS.forEach(p => expect(p.L).toBe(1.0));
      HEIGHT_GIRLS_LMS.forEach(p => expect(p.L).toBe(1.0));

      // Weight Spot Checks
      const bBirthW = WEIGHT_BOYS_LMS[0];
      const bAdultW = WEIGHT_BOYS_LMS[WEIGHT_BOYS_LMS.length - 1];
      expect(bBirthW.M).toBeCloseTo(3.00, 1);
      expect(bAdultW.M).toBeCloseTo(60.9, 1);

      const gBirthW = WEIGHT_GIRLS_LMS[0];
      const gAdultW = WEIGHT_GIRLS_LMS[WEIGHT_GIRLS_LMS.length - 1];
      expect(gBirthW.M).toBeCloseTo(2.95, 1);
      expect(gAdultW.M).toBeCloseTo(52.3, 1);

      // Weight L parameter transition (skewness must transition smoothly from right-skewed positive in infancy to left-skewed negative in childhood)
      expect(WEIGHT_BOYS_LMS[0].L).toBeGreaterThan(0.5); // Right-skewed at birth
      expect(WEIGHT_BOYS_LMS[WEIGHT_BOYS_LMS.length - 1].L).toBeLessThan(-1.0); // Left-skewed in adolescence
    });
  });

  describe('Fuhyo Monthly Completed Height Reference (附表1)', () => {
    
    it('Should contain exactly 211 months of continuous data (0 to 17.5 years / 210 completed months)', () => {
      expect(FUHYO_BOYS_HEIGHT.length).toBe(211);
      expect(FUHYO_GIRLS_HEIGHT.length).toBe(211);
    });

    it('Should show monotonic average height growth over age', () => {
      for (let i = 0; i < FUHYO_BOYS_HEIGHT.length - 1; i++) {
        expect(FUHYO_BOYS_HEIGHT[i + 1][0]).toBeGreaterThanOrEqual(FUHYO_BOYS_HEIGHT[i][0]);
      }
      for (let i = 0; i < FUHYO_GIRLS_HEIGHT.length - 1; i++) {
        expect(FUHYO_GIRLS_HEIGHT[i + 1][0]).toBeGreaterThanOrEqual(FUHYO_GIRLS_HEIGHT[i][0]);
      }
    });

    it('Standard deviations should gradually increase with age to reflect increasing variability', () => {
      // Infant SD is tight (~2.1 cm) while adolescent SD is wider (~5.8 cm)
      expect(FUHYO_BOYS_HEIGHT[0][1]).toBeCloseTo(2.1, 1);
      expect(FUHYO_BOYS_HEIGHT[210][1]).toBeCloseTo(5.8, 1);
    });
  });

  describe('Longitudinal Height Velocity Reference (Suwa & Tachibana Standards)', () => {
    
    it('Should contain 71 age intervals for boys and 70 for girls up to late adolescence', () => {
      expect(SUWA_HV_BOYS.length).toBe(71);
      expect(SUWA_HV_GIRLS.length).toBe(70);
    });

    it('Should exhibit physiological infancy deceleration', () => {
      // Growth velocity starts extremely high in infancy and drops rapidly
      const bInfantVelocityFirst = SUWA_HV_BOYS.find(p => p.age === 0.5)?.mean || 0;
      const bInfantVelocitySecond = SUWA_HV_BOYS.find(p => p.age === 1.0)?.mean || 0;
      const bChildVelocity = SUWA_HV_BOYS.find(p => p.age === 5.0)?.mean || 0;

      expect(bInfantVelocityFirst).toBeCloseTo(25.7, 1);
      expect(bInfantVelocitySecond).toBeCloseTo(13.9, 1);
      expect(bChildVelocity).toBeCloseTo(6.3, 1);

      expect(bInfantVelocityFirst).toBeGreaterThan(bInfantVelocitySecond);
      expect(bInfantVelocitySecond).toBeGreaterThan(bChildVelocity);
    });

    it('Should reflect the correct puberty sparts peak timing (girls are earlier, boys have higher peaks)', () => {
      // Find peak pubertal height velocity ages
      // Filter out infancy (first 2 years) to isolate pubertal peak
      const boysPuberty = SUWA_HV_BOYS.filter(p => p.age >= 8 && p.age <= 16);
      const girlsPuberty = SUWA_HV_GIRLS.filter(p => p.age >= 8 && p.age <= 16);

      const maxBoysMean = Math.max(...boysPuberty.map(p => p.mean));
      const maxGirlsMean = Math.max(...girlsPuberty.map(p => p.mean));

      const peakBoysAge = boysPuberty.find(p => p.mean === maxBoysMean)?.age || 0;
      const peakGirlsAge = girlsPuberty.find(p => p.mean === maxGirlsMean)?.age || 0;

      // Girls reach puberty peak earlier
      expect(peakGirlsAge).toBeLessThan(peakBoysAge);
      expect(peakGirlsAge).toBeGreaterThanOrEqual(10.5);
      expect(peakGirlsAge).toBeLessThanOrEqual(12.5);

      // Boys reach puberty peak later, usually between 12.0 and 14.5
      expect(peakBoysAge).toBeGreaterThanOrEqual(12.0);
      expect(peakBoysAge).toBeLessThanOrEqual(14.5);

      // Boys peak height velocity is physiologically higher than girls'
      expect(maxBoysMean).toBeGreaterThan(maxGirlsMean);
    });
  });
});
