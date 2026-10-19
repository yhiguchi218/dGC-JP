export interface MonthlyWeightSDSGoldenCase {
  label: string;
  sex: 'male' | 'female';
  birthDate: string;
  measurementDate: string;
  weight: number;
  completedMonths: number;
  lmsSupportPoints: Array<[number, number, number, number]>;
  expectedSDS: number;
  expectedDisplay: string;
}

// Fixed expectations were calculated independently from the current LMS table data using Catmull-Rom
// interpolation at completedMonths / 12 and the LMS z-score equation. They are calculation-path goldens,
// not a row-by-row verification of the LMS reference data against its original source.
export const MONTHLY_WEIGHT_SDS_GOLDEN_CASES: MonthlyWeightSDSGoldenCase[] = [
  { label: 'M 152 months', sex: 'male', birthDate: '2012-09-10', measurementDate: '2025-05-20', weight: 72.7, completedMonths: 152, lmsSupportPoints: [[12, -0.764, 40.7, 0.206], [12.5, -0.686, 43.6, 0.205], [13, -0.636, 46.3, 0.201], [13.5, -0.619, 49, 0.196]], expectedSDS: 2.0519677640041505, expectedDisplay: '2.05' },
  { label: 'F 31 months', sex: 'female', birthDate: '2022-09-25', measurementDate: '2025-05-23', weight: 10.4, completedMonths: 31, lmsSupportPoints: [[2, -0.602, 11, 0.105], [2.5, -0.646, 12.1, 0.11], [3, -0.677, 13.1, 0.114], [3.5, -0.718, 14, 0.118]], expectedSDS: -1.5797642974625408, expectedDisplay: '-1.58' },
  { label: 'M 189 months', sex: 'male', birthDate: '2008-05-06', measurementDate: '2024-03-04', weight: 44, completedMonths: 189, lmsSupportPoints: [[15, -0.809, 55.9, 0.169], [15.5, -0.952, 57.5, 0.161], [16, -1.127, 58.8, 0.155], [16.5, -1.325, 59.7, 0.151]], expectedSDS: -2.055740301266539, expectedDisplay: '-2.06' },
  { label: 'F 179 months', sex: 'female', birthDate: '2010-03-11', measurementDate: '2025-03-04', weight: 42, completedMonths: 179, lmsSupportPoints: [[14, -0.653, 48.8, 0.154], [14.5, -0.83, 49.8, 0.147], [15, -0.976, 50.6, 0.142], [15.5, -1.012, 51.2, 0.139]], expectedSDS: -1.4094716640323128, expectedDisplay: '-1.41' },
  { label: 'M 59 months', sex: 'male', birthDate: '2021-04-22', measurementDate: '2026-04-03', weight: 15, completedMonths: 59, lmsSupportPoints: [[4, -0.804, 15.5, 0.123], [4.5, -0.913, 16.5, 0.127], [5, -1.026, 17.5, 0.131], [5.5, -1.136, 18.5, 0.134]], expectedSDS: -1.1936356068881744, expectedDisplay: '-1.19' },
  { label: 'M 43 months', sex: 'male', birthDate: '2022-12-03', measurementDate: '2026-07-05', weight: 18, completedMonths: 43, lmsSupportPoints: [[3, -0.607, 13.5, 0.113], [3.5, -0.703, 14.5, 0.119], [4, -0.804, 15.5, 0.123], [4.5, -0.913, 16.5, 0.127]], expectedSDS: 1.5897302534145443, expectedDisplay: '1.59' },
  { label: 'M 172 months', sex: 'male', birthDate: '2011-03-11', measurementDate: '2025-08-02', weight: 52, completedMonths: 172, lmsSupportPoints: [[13.5, -0.619, 49, 0.196], [14, -0.642, 51.6, 0.187], [14.5, -0.705, 54, 0.178], [15, -0.809, 55.9, 0.169]], expectedSDS: -0.1317170910108102, expectedDisplay: '-0.13' },
  { label: 'M 130 months', sex: 'male', birthDate: '2010-05-06', measurementDate: '2021-03-29', weight: 78, completedMonths: 130, lmsSupportPoints: [[10, -1.191, 31.4, 0.189], [10.5, -1.084, 33.4, 0.195], [11, -0.971, 35.6, 0.2], [11.5, -0.862, 38.1, 0.204]], expectedSDS: 2.780190083953677, expectedDisplay: '2.78' },
  { label: 'M 48 months', sex: 'male', birthDate: '2018-05-31', measurementDate: '2022-06-09', weight: 19.1, completedMonths: 48, lmsSupportPoints: [[3, -0.607, 13.5, 0.113], [3.5, -0.703, 14.5, 0.119], [4, -0.804, 15.5, 0.123], [4.5, -0.913, 16.5, 0.127]], expectedSDS: 1.5630536078858583, expectedDisplay: '1.56' },
  { label: 'M 202 months', sex: 'male', birthDate: '2003-05-21', measurementDate: '2020-04-03', weight: 76.3, completedMonths: 202, lmsSupportPoints: [[16, -1.127, 58.8, 0.155], [16.5, -1.325, 59.7, 0.151], [17, -1.534, 60.4, 0.147], [17.5, -1.739, 60.9, 0.141]], expectedSDS: 1.3495287414579886, expectedDisplay: '1.35' },
  { label: 'F 47 months', sex: 'female', birthDate: '2022-04-05', measurementDate: '2026-04-03', weight: 18.9, completedMonths: 47, lmsSupportPoints: [[3, -0.677, 13.1, 0.114], [3.5, -0.718, 14, 0.118], [4, -0.778, 15.1, 0.122], [4.5, -0.861, 16.1, 0.127]], expectedSDS: 1.7832311622963255, expectedDisplay: '1.78' },
  { label: 'F 35 months', sex: 'female', birthDate: '2021-06-07', measurementDate: '2024-06-03', weight: 12.1, completedMonths: 35, lmsSupportPoints: [[2, -0.602, 11, 0.105], [2.5, -0.646, 12.1, 0.11], [3, -0.677, 13.1, 0.114], [3.5, -0.718, 14, 0.118]], expectedSDS: -0.6058987778439364, expectedDisplay: '-0.61' },
  { label: 'F 73 months', sex: 'female', birthDate: '2020-04-05', measurementDate: '2026-06-03', weight: 14.5, completedMonths: 73, lmsSupportPoints: [[5.5, -1.068, 18.2, 0.137], [6, -1.171, 19.4, 0.142], [6.5, -1.259, 20.6, 0.148], [7, -1.319, 21.9, 0.154]], expectedSDS: -2.534194313206918, expectedDisplay: '-2.53' },
  { label: 'F 24 months', sex: 'female', birthDate: '2024-06-07', measurementDate: '2026-07-06', weight: 11.1, completedMonths: 24, lmsSupportPoints: [[1.5, -0.506, 9.82, 0.102], [1.75, -0.563, 10.4, 0.104], [2, -0.602, 11, 0.105], [2.5, -0.646, 12.1, 0.11]], expectedSDS: 0.08595455685908822, expectedDisplay: '0.09' },
  { label: 'F 99 months', sex: 'female', birthDate: '2013-05-02', measurementDate: '2021-08-09', weight: 32.1, completedMonths: 99, lmsSupportPoints: [[7.5, -1.344, 23.2, 0.159], [8, -1.328, 24.5, 0.164], [8.5, -1.269, 25.9, 0.169], [9, -1.169, 27.4, 0.174]], expectedSDS: 1.248717257559167, expectedDisplay: '1.25' },
  { label: 'F 76 months', sex: 'female', birthDate: '2018-06-04', measurementDate: '2024-10-12', weight: 19.1, completedMonths: 76, lmsSupportPoints: [[5.5, -1.068, 18.2, 0.137], [6, -1.171, 19.4, 0.142], [6.5, -1.259, 20.6, 0.148], [7, -1.319, 21.9, 0.154]], expectedSDS: -0.39447295981431674, expectedDisplay: '-0.39' },
];