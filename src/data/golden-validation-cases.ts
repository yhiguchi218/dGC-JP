export interface GoldenValidationCase {
  label: string;
  sex: 'male' | 'female';
  age: number;
  expectedHeight: number;
  expectedWeight: number;
}

export const GOLDEN_VALIDATION_CASES: GoldenValidationCase[] = [
  { label: 'boys birth', sex: 'male', age: 0, expectedHeight: 49.0, expectedWeight: 3.0 },
  { label: 'boys 3 months', sex: 'male', age: 0.25, expectedHeight: 61.5, expectedWeight: 6.31 },
  { label: 'boys 6 months', sex: 'male', age: 0.5, expectedHeight: 67.7, expectedWeight: 7.93 },
  { label: 'boys 1 year', sex: 'male', age: 1.0, expectedHeight: 74.8, expectedWeight: 9.38 },
  { label: 'boys 2 years', sex: 'male', age: 2.0, expectedHeight: 85.8, expectedWeight: 11.5 },
  { label: 'boys 3 years', sex: 'male', age: 3.0, expectedHeight: 93.5, expectedWeight: 13.5 },
  { label: 'boys 6 years', sex: 'male', age: 6.0, expectedHeight: 113.3, expectedWeight: 19.6 },
  { label: 'boys 10 years', sex: 'male', age: 10.0, expectedHeight: 135.9, expectedWeight: 31.4 },
  { label: 'boys 17.5 years', sex: 'male', age: 17.5, expectedHeight: 170.7, expectedWeight: 60.9 },
  { label: 'girls birth', sex: 'female', age: 0, expectedHeight: 48.5, expectedWeight: 2.95 },
  { label: 'girls 3 months', sex: 'female', age: 0.25, expectedHeight: 60.1, expectedWeight: 5.86 },
  { label: 'girls 6 months', sex: 'female', age: 0.5, expectedHeight: 66.2, expectedWeight: 7.32 },
  { label: 'girls 1 year', sex: 'female', age: 1.0, expectedHeight: 73.5, expectedWeight: 8.72 },
  { label: 'girls 2 years', sex: 'female', age: 2.0, expectedHeight: 84.6, expectedWeight: 11.0 },
  { label: 'girls 3 years', sex: 'female', age: 3.0, expectedHeight: 91.8, expectedWeight: 13.1 },
  { label: 'girls 6 years', sex: 'female', age: 6.0, expectedHeight: 112.7, expectedWeight: 19.4 },
  { label: 'girls 10 years', sex: 'female', age: 10.0, expectedHeight: 137.2, expectedWeight: 31.2 },
  { label: 'girls 17.5 years', sex: 'female', age: 17.5, expectedHeight: 157.9, expectedWeight: 52.3 },
];
