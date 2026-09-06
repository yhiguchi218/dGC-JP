import React, { useState, useMemo } from 'react';
import GrowthChart, { CHART_PRESETS, ChartPreset } from './GrowthChart';
import GrowthForm, { MeasurementEntry } from './GrowthForm';
import { ThemeToggle } from './ThemeToggle';
import { 
  calculateDecimalAge, 
  calculateCorrectedAge, 
  calculateZScore, 
  interpolateLMS,
  calculateObesityIndex,
  calculateObesityIndexByAge,
  calculateFullMonthsAge,
  getCorrectedBirthDate,
  calculateHeightVelocityResults,
  isValidGestationalDays
} from '../lib/growth-utils';
import { 
  HEIGHT_BOYS_LMS, 
  HEIGHT_GIRLS_LMS, 
  WEIGHT_BOYS_LMS, 
  WEIGHT_GIRLS_LMS 
} from '../data/growth-data';
import { FUHYO_BOYS_HEIGHT, FUHYO_GIRLS_HEIGHT } from '../data/fuhyo-growth-data';
import { SUWA_HV_BOYS, SUWA_HV_GIRLS } from '../data/suwa-hv-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Info } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { CLINICAL_LIMITS } from '../lib/constants';

export function getSuwaHVSDSClass(sds: number, sex: '男子' | '女子'): string {
  if (Math.abs(sds) > 2) {
    return 'text-orange-500 dark:text-orange-400 font-bold';
  }

  return sex === '男子'
    ? 'text-blue-500 dark:text-blue-400 font-medium'
    : 'text-pink-500 dark:text-pink-400 font-medium';
}

const GrowthDashboard: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<ChartPreset>(CHART_PRESETS[2]); // Default to 0-18y
  const [obesityMode, setObesityMode] = useState<'height' | 'age'>('height');
  const [formData, setFormData] = useState<{
    childId: string;
    birthDate: Date;
    sex: '男子' | '女子';
    gestationalWeeks: number;
    gestationalDays: number;
    measurements: MeasurementEntry[];
  }>({
    childId: '001',
    birthDate: new Date(2020, 0, 1),
    sex: '男子',
    gestationalWeeks: 40,
    gestationalDays: 0,
    measurements: [
      { id: '1', date: new Date(2020, 0, 1), height: 50.0, weight: 3.3 },
      { id: '2', date: new Date(2021, 0, 1), height: 75.0, weight: 9.5 },
      { id: '3', date: new Date(2022, 0, 1), height: 86.0, weight: 12.0 },
      { id: '4', date: new Date(2023, 0, 1), height: 95.0, weight: 14.2 },
    ]
  });

  const isPreterm = formData.gestationalWeeks < CLINICAL_LIMITS.GESTATION_WEEKS.PRETERM_THRESHOLD;
  const hasValidGestationalDays = isValidGestationalDays(formData.gestationalDays);
  const isPretermCorrectionEligible = isPreterm && hasValidGestationalDays;
  const sexKey: 'male' | 'female' = formData.sex === '男子' ? 'male' : 'female';

  // Selected gender tables
  const heightTable = formData.sex === '男子' ? HEIGHT_BOYS_LMS : HEIGHT_GIRLS_LMS;
  const weightTable = formData.sex === '男子' ? WEIGHT_BOYS_LMS : WEIGHT_GIRLS_LMS;
  const fuhyoTable = formData.sex === '男子' ? FUHYO_BOYS_HEIGHT : FUHYO_GIRLS_HEIGHT;
  const suwaTable = formData.sex === '男子' ? SUWA_HV_BOYS : SUWA_HV_GIRLS;

  // Process data with standard calculations
  const processedData = useMemo(() => {
    return formData.measurements
      .map(m => {
        const age = calculateDecimalAge(formData.birthDate, m.date);
        if (age === null) return null;

        const correctedAge = calculateCorrectedAge(formData.birthDate, m.date, formData.gestationalWeeks, formData.gestationalDays);
        const correctedBirthDate = getCorrectedBirthDate(formData.birthDate, formData.gestationalWeeks, formData.gestationalDays);
        // Corrected age is clinically applied up to 3.0 years
        const showCorrected = isPreterm && correctedAge !== null && correctedBirthDate !== null && age <= CLINICAL_LIMITS.AGE.PRETERM_CORRECTION_MAX_YEARS;

        const heightVal = typeof m.height === 'string' ? parseFloat(m.height) : m.height;
        const weightVal = typeof m.weight === 'string' ? parseFloat(m.weight) : m.weight;

        // Calculate Height SDS (JSPE standard: use month-based table if under 3 years)
        let heightSDS: number | undefined = undefined;
        if (heightVal !== undefined && !isNaN(heightVal)) {
          const effectiveAge = showCorrected && correctedAge !== null ? correctedAge : age;
          if (effectiveAge <= CLINICAL_LIMITS.AGE.PRETERM_CORRECTION_MAX_YEARS) {
            const referenceBirthDate = showCorrected && correctedBirthDate
              ? correctedBirthDate
              : formData.birthDate;
            const months = differenceInMonths(m.date, referenceBirthDate);
            if (months >= 0 && months < fuhyoTable.length) {
              const [mean, sd] = fuhyoTable[months];
              heightSDS = (heightVal - mean) / sd;
            }
          }
          if (heightSDS === undefined) {
            const lms = interpolateLMS(effectiveAge, heightTable);
            heightSDS = calculateZScore(heightVal, lms);
          }
        }

        // Calculate Weight SDS
        let weightSDS: number | undefined = undefined;
        if (weightVal !== undefined && !isNaN(weightVal)) {
          const effectiveAge = showCorrected && correctedAge !== null ? correctedAge : age;
          const lms = interpolateLMS(effectiveAge, weightTable);
          weightSDS = calculateZScore(weightVal, lms);
        }

        // Calculate BMI
        let bmi: number | undefined = undefined;
        if (heightVal && weightVal && !isNaN(heightVal) && !isNaN(weightVal) && heightVal > 0) {
          const hM = heightVal / 100;
          bmi = weightVal / (hM * hM);
        }

        // Calculate Obesity Index
        let obesityIndex: number | null = null;
        let obesityIndexAge: number | null = null;
        if (heightVal && weightVal && !isNaN(heightVal) && !isNaN(weightVal)) {
          obesityIndex = calculateObesityIndex(weightVal, heightVal, age, sexKey);
          obesityIndexAge = calculateObesityIndexByAge(weightVal, heightVal, age, sexKey);
        }

        return {
          id: m.id,
          date: m.date,
          age,
          correctedAge: correctedAge ?? age,
          correctedBirthDate,
          showCorrected,
          height: heightVal,
          weight: weightVal,
          heightSDS,
          weightSDS,
          bmi,
          obesityIndex,
          obesityIndexAge
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [formData, heightTable, weightTable, fuhyoTable, isPreterm, sexKey]);

  // Calculate Height Velocity (HV)
  const heightVelocity = useMemo(() => {
    const valid = processedData
      .filter(d => d.height !== undefined && !isNaN(d.height!))
      .map(d => ({
        date: d.date,
        age: d.age,
        height: d.height!,
      }));
    return calculateHeightVelocityResults(valid, sexKey, suwaTable);
  }, [processedData, suwaTable, sexKey]);

  // Points for D3 Chart
  const heightPoints = useMemo(() => {
    const points: Array<{ age: number; value: number; isCorrected?: boolean; isOutlier?: boolean; zScore?: number }> = [];
    processedData.forEach(d => {
      if (d.height !== undefined && !isNaN(d.height)) {
        points.push({
          age: d.age,
          value: d.height,
          zScore: d.heightSDS,
          isCorrected: false
        });
        if (d.showCorrected) {
          points.push({
            age: d.correctedAge,
            value: d.height,
            zScore: d.heightSDS,
            isCorrected: true
          });
        }
      }
    });
    return points;
  }, [processedData]);

  const weightPoints = useMemo(() => {
    const points: Array<{ age: number; value: number; isCorrected?: boolean; isOutlier?: boolean; zScore?: number }> = [];
    processedData.forEach(d => {
      if (d.weight !== undefined && !isNaN(d.weight)) {
        points.push({
          age: d.age,
          value: d.weight,
          zScore: d.weightSDS,
          isCorrected: false
        });
        if (d.showCorrected) {
          points.push({
            age: d.correctedAge,
            value: d.weight,
            zScore: d.weightSDS,
            isCorrected: true
          });
        }
      }
    });
    return points;
  }, [processedData]);

  return (
    <main id="main-content" tabIndex={-1} className="focus:outline-none max-w-7xl mx-auto p-4 pb-28 md:p-8 space-y-8 print:m-0 print:p-0 print:max-w-none print:overflow-visible">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-zinc-800 pb-4 print:hidden transition-colors">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">dGC-JP</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">日本版デジタル成長曲線プラットフォーム</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="px-3 py-1 bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700">
            フェーズ 1: スタンドアロン版
          </Badge>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block">
        {/* Left Column: Input Forms */}
        <div id="input-section" className="lg:col-span-4 space-y-6 scroll-mt-4 lg:sticky lg:top-8 print:hidden">
          <GrowthForm onDataChange={setFormData} initialData={formData} />
        </div>

        {/* Right Column: Chart and Results */}
        <div className="lg:col-span-8 space-y-8 print:space-y-4 print:m-0 print:p-0">
          {/* Print-only Demographic Header */}
          <div className="hidden print:block border-b-2 border-gray-800 pb-3 mb-4">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-xl font-bold text-gray-900">デジタル成長報告書 (dGC-JP)</h1>
                <p className="text-[10px] text-gray-500">Digital Growth Chart for Japan</p>
              </div>
              <div className="text-right text-[10px] text-gray-500">
                作成日時: {format(new Date(), 'yyyy/MM/dd HH:mm')}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 mt-3 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
              <div>
                <span className="text-gray-500 block text-[9px] uppercase tracking-wider">対象児ID</span>
                <span className="font-bold text-gray-950">{formData.childId || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase tracking-wider">性別</span>
                <span className="font-bold text-gray-950">{formData.sex}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase tracking-wider">生年月日</span>
                <span className="font-bold text-gray-950">{format(formData.birthDate, 'yyyy/MM/dd')}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase tracking-wider">在胎期間</span>
                <span className="font-bold text-gray-950">
                  {hasValidGestationalDays
                    ? `${formData.gestationalWeeks}週${formData.gestationalDays}日`
                    : `${formData.gestationalWeeks}週（在胎日数要確認）`}
                  {isPretermCorrectionEligible && <span className="text-emerald-700 ml-1 text-[9px]">(早産期修正)</span>}
                </span>
              </div>
            </div>
          </div>

          <div id="chart-section" className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-800 gap-4 scroll-mt-4 print:hidden transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">表示範囲:</span>
              <Select 
                value={selectedPreset.id} 
                onValueChange={(id) => {
                  const preset = CHART_PRESETS.find(p => p.id === id);
                  if (preset) setSelectedPreset(preset);
                }}
              >
                <SelectTrigger className="w-full sm:w-[260px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100">
                  <SelectValue placeholder="表示範囲を選択">
                    {selectedPreset.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                  {CHART_PRESETS.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-gray-900 dark:text-zinc-100 focus:bg-gray-100 dark:focus:bg-zinc-700">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-[10px] text-gray-400 dark:text-zinc-500 sm:max-w-[300px] sm:text-right">
              ※ 日本人の標準成長曲線（2000年度版）に基づき、LMS法と3次スプライン補間を用いて算出しています。
            </div>
          </div>

          <div className="print:m-0 print:p-0">
            <GrowthChart 
              sex={formData.sex} 
              heightLmsTable={heightTable} 
              weightLmsTable={weightTable} 
              heightPoints={heightPoints} 
              weightPoints={weightPoints} 
              preset={selectedPreset}
            />
          </div>

          <Card id="results-section" className="border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 scroll-mt-4 print:shadow-none print:border-none print:m-0 print:p-0 transition-colors">
            <div className="hidden print:block font-bold text-sm border-b pb-1 mb-2">評価結果</div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 print:hidden">
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-zinc-100 print:text-base">評価結果</CardTitle>
              <div role="group" aria-label="肥満度の算出基準" className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-md text-[10px] md:text-xs print:hidden">
                <button 
                  onClick={() => setObesityMode('height')}
                  aria-pressed={obesityMode === 'height'}
                  className={cn(
                    "px-2 py-1 rounded transition-colors",
                    obesityMode === 'height' ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm font-bold" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-600"
                  )}
                >
                  性別身長別
                </button>
                <button 
                  onClick={() => setObesityMode('age')}
                  aria-pressed={obesityMode === 'age'}
                  className={cn(
                    "px-2 py-1 rounded transition-colors",
                    obesityMode === 'age' ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm font-bold" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-600"
                  )}
                >
                  性別年齢別
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div role="region" aria-labelledby="results-title" className="hidden overflow-x-auto md:block print:block">
                <table className="w-full text-sm text-left">
                  <caption className="sr-only" id="results-title">
                    お子さんの成長データ評価結果。各行は測定日ごとの測定値、年齢、身長SDS、体重SDS、BMI、肥満度を表示しています。
                  </caption>
                  <thead className="text-xs text-gray-700 dark:text-zinc-300 uppercase bg-gray-50 dark:bg-zinc-800/60 print:bg-transparent print:border-b">
                    <tr>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]" scope="col">測定日</th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]" scope="col">
                        年齢
                        <span className="sr-only">満年齢および満月齢表記。</span>
                      </th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]" scope="col">
                        身長 (SDS)
                        <span className="sr-only">標準偏差値。</span>
                      </th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]" scope="col">
                        体重 (SDS)
                        <span className="sr-only">標準偏差値。</span>
                      </th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]" scope="col">
                        BMI
                        <span className="sr-only">ボディマス指数。</span>
                      </th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]" scope="col">
                        肥満度
                        <span className={cn(
                          "ml-1 text-[8px] normal-case px-1 rounded",
                          formData.sex === '男子' ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300' : 'bg-pink-100 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300'
                        )}>
                          {obesityMode === 'height' ? '身長値ベース' : '年齢別ベース'}
                        </span>
                        <span className="sr-only">パーセント。</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {processedData.map((d, i) => {
                      const currentObesity = obesityMode === 'height' ? d.obesityIndex : d.obesityIndexAge;
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40 print:border-b print:border-gray-100 text-gray-900 dark:text-zinc-100">
                          <td className="px-4 py-3 font-medium print:px-1 print:py-0.5 print:text-[8pt]">{format(d.date, 'yyyy/MM/dd')}</td>
                          <td className="px-4 py-3 print:px-1 print:py-0.5 print:text-[8pt]">
                            <div className="font-semibold">{d.age.toFixed(4)}歳</div>
                            <div className="text-[11px] text-gray-500 dark:text-zinc-400 font-normal mt-0.5 leading-tight print:text-[6.5pt]">
                              {calculateFullMonthsAge(formData.birthDate, d.date)}
                            </div>
                            {d.showCorrected && d.correctedBirthDate && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold print:text-[6pt] mt-1.5 pt-1.5 border-t border-emerald-100/30">
                                <div>修正: {d.correctedAge.toFixed(4)}歳</div>
                                <div className="text-[9px] text-emerald-500 dark:text-emerald-400 font-normal mt-0.5 print:text-[5.5pt]">
                                  {calculateFullMonthsAge(
                                    d.correctedBirthDate,
                                    d.date
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 print:px-1 print:py-0.5 print:text-[8pt]">
                            {d.height ? `${d.height}cm` : '-'}
                            {d.heightSDS !== undefined && (
                              <span className={cn(
                                "ml-2 text-xs print:ml-1 print:text-[7pt]",
                                Math.abs(d.heightSDS) > 2 ? "text-red-500 dark:text-red-400 font-bold" : "text-gray-500 dark:text-zinc-400"
                              )}>
                                ({d.heightSDS.toFixed(2)}SD)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 print:px-1 print:py-0.5 print:text-[8pt]">
                            {d.weight ? `${d.weight}kg` : '-'}
                            {d.weightSDS !== undefined && (
                              <span className={cn(
                                "ml-2 text-xs print:ml-1 print:text-[7pt]",
                                Math.abs(d.weightSDS) > 2 ? "text-red-500 dark:text-red-400 font-bold" : "text-gray-500 dark:text-zinc-400"
                              )}>
                                ({d.weightSDS.toFixed(2)}SD)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 print:px-1 print:py-0.5 print:text-[8pt]">{d.bmi?.toFixed(1) || '-'}</td>
                          <td className="px-4 py-3 text-center print:px-1 print:py-0.5 print:text-[8pt]">
                            {currentObesity !== null ? (
                              <span className={cn(
                                currentObesity > 20 ? "text-orange-500 dark:text-orange-400 font-bold" : currentObesity < -20 ? "text-blue-500 dark:text-blue-400 font-bold" : ""
                              )}>
                                {currentObesity.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-zinc-600 text-[10px] print:text-[6pt]">算出不可</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden print:hidden">
                {processedData.map((d) => {
                  const currentObesity = obesityMode === 'height' ? d.obesityIndex : d.obesityIndexAge;
                  return (
                    <article
                      key={d.id}
                      aria-label={`測定日 ${format(d.date, 'yyyy/MM/dd')} の成長評価結果`}
                      className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <div className="border-b border-gray-100 pb-3 dark:border-zinc-800">
                        <div className="font-semibold">{format(d.date, 'yyyy/MM/dd')}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold">{d.age.toFixed(4)}歳</span>
                          {d.showCorrected && d.correctedBirthDate && (
                            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 dark:text-zinc-200 dark:ring-zinc-600">
                              修正 {d.correctedAge.toFixed(4)}歳
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                          {calculateFullMonthsAge(formData.birthDate, d.date)}
                          {d.showCorrected && (
                            <span>
                              {' / 修正 '}
                              {calculateFullMonthsAge(
                                d.correctedBirthDate,
                                d.date
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                        <dt className="text-gray-500 dark:text-zinc-400">身長</dt>
                        <dd className="text-right font-medium">
                          {d.height ? `${d.height}cm` : '-'}
                          {d.heightSDS !== undefined && (
                            <span className={cn(
                              "ml-2 text-xs",
                              Math.abs(d.heightSDS) > 2 ? "text-red-500 dark:text-red-400 font-bold" : "text-gray-500 dark:text-zinc-400"
                            )}>
                              {d.heightSDS.toFixed(2)}SD
                            </span>
                          )}
                        </dd>
                        <dt className="text-gray-500 dark:text-zinc-400">体重</dt>
                        <dd className="text-right font-medium">
                          {d.weight ? `${d.weight}kg` : '-'}
                          {d.weightSDS !== undefined && (
                            <span className={cn(
                              "ml-2 text-xs",
                              Math.abs(d.weightSDS) > 2 ? "text-red-500 dark:text-red-400 font-bold" : "text-gray-500 dark:text-zinc-400"
                            )}>
                              {d.weightSDS.toFixed(2)}SD
                            </span>
                          )}
                        </dd>
                        <dt className="text-gray-500 dark:text-zinc-400">BMI</dt>
                        <dd className="text-right font-medium">{d.bmi?.toFixed(1) || '-'}</dd>
                        <dt className="text-gray-500 dark:text-zinc-400">
                          肥満度（{obesityMode === 'height' ? '身長値ベース' : '年齢別ベース'}）
                        </dt>
                        <dd className="text-right font-medium">
                          {currentObesity !== null ? (
                            <span className={cn(
                              currentObesity > 20 ? "text-orange-500 dark:text-orange-400 font-bold" : currentObesity < -20 ? "text-blue-500 dark:text-blue-400 font-bold" : ""
                            )}>
                              {currentObesity.toFixed(1)}%
                            </span>
                          ) : <span className="text-[10px] text-gray-300 dark:text-zinc-600">算出不可</span>}
                        </dd>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </CardContent>
          </Card>
 
          {heightVelocity.length > 0 && (
            <Card id="hv-section" className={cn(
              "border-opacity-50 print:border print:border-gray-200 print:bg-white print:p-2 transition-colors", 
              formData.sex === '男子' 
                ? "border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20" 
                : "border-pink-200 dark:border-pink-900 bg-pink-50/30 dark:bg-pink-950/20"
            )}>
              <CardHeader className="print:p-1">
                <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-zinc-100 print:text-xs">
                  <Info className={cn("h-5 w-5 print:h-3 print:w-3", formData.sex === '男子' ? "text-blue-500 dark:text-blue-400" : "text-pink-500 dark:text-pink-400")} />
                  身長速度 (Height Velocity)
                </CardTitle>
              </CardHeader>
              <CardContent className="print:p-1">
                <div className="space-y-4 print:space-y-1">
                  {heightVelocity.map((hv, i) => (
                    <div key={i} className={cn(
                      "p-4 bg-white dark:bg-zinc-900 rounded-lg border shadow-sm print:p-2 print:shadow-none print:border-gray-100 text-xs transition-colors",
                      formData.sex === '男子' ? "border-blue-100 dark:border-blue-900/50" : "border-pink-100 dark:border-pink-900/50"
                    )}>
                      <div className="mb-3 text-right text-xs text-gray-500 dark:text-zinc-400 print:mb-1 print:text-[8px]">
                        測定日: {format(hv.currentDate, 'yyyy/MM/dd')}
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 print:grid-cols-2 print:gap-1">
                        <section aria-labelledby={`raw-hv-${i}`} className="min-w-0 rounded border border-gray-200 p-3 dark:border-zinc-700 print:p-1">
                          <h3 id={`raw-hv-${i}`} className="text-sm font-medium text-gray-500 dark:text-zinc-400 print:text-[8px]">直近HV</h3>
                          {hv.raw ? (
                            <>
                              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100 print:text-sm">{hv.raw.velocity.toFixed(2)} cm/年</div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400 print:text-[8px]">+{hv.raw.heightDiff.toFixed(1)} cm / {hv.raw.intervalDays}日</div>
                            </>
                          ) : (
                            <>
                              <div className="mt-1 text-lg font-bold text-gray-400 dark:text-zinc-500">—</div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400 print:text-[8px]">算出可能な測定間隔がありません</div>
                            </>
                          )}
                        </section>
                        <section aria-labelledby={`suwa-hv-${i}`} className="min-w-0 rounded border border-gray-200 p-3 dark:border-zinc-700 print:p-1">
                          <h3 id={`suwa-hv-${i}`} className="text-sm font-medium text-gray-500 dark:text-zinc-400 print:text-[8px]">12か月HV（Suwa基準）</h3>
                          {hv.suwa ? (
                            <>
                              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100 print:text-sm">{hv.suwa.velocity.toFixed(2)} cm/年</div>
                              {hv.suwa.sds !== null ? (
                                <div className={cn("mt-1 text-xs print:text-[8px]", getSuwaHVSDSClass(hv.suwa.sds, formData.sex))}>HV-SDS: {hv.suwa.sds.toFixed(2)}</div>
                              ) : (
                                <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400 print:text-[8px]">HV-SDS: —</div>
                              )}
                              <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400 print:text-[8px]">+{hv.suwa.heightDiff.toFixed(1)} cm / {hv.suwa.intervalDays}日</div>
                            </>
                          ) : (
                            <>
                              <div className="mt-1 text-lg font-bold text-gray-400 dark:text-zinc-500">—</div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400 print:text-[8px]">HV-SDS: —</div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400 print:text-[8px]">Suwa法によるHV-SDSは約12か月間隔の測定値で算出します</div>
                            </>
                          )}
                        </section>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg flex gap-3 shadow-sm print:hidden transition-colors">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-200 space-y-2">
              <div>
                <p className="font-bold underline mb-1">重要：ご利用にあたっての免責事項</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>本ツールは教育・研究用であり、確定診断には使用しないでください。</li>
                  <li>計算結果の最終的な判断は、必ず主治医の責任において行ってください。</li>
                  <li><strong>プライバシー保護:</strong> 入力された患者データはブラウザ内でのみ一時的に処理され、外部サーバーへ送信・蓄積されることはありません。</li>
                  <li><strong>データ保持:</strong> セキュリティのため、ブラウザをリロード（再読み込み）すると入力データはすべて消去されます。必要に応じて「データ保存」ボタンからJSON形式でバックアップをダウンロードしてください。</li>
                </ul>
              </div>
              
              <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/40">
                <p>※ 基準値外（±5SD超）の場合は外挿値として計算され、グラフ上は「▲」で表示されます。</p>
                <p>※ 肥満度（身長別）は主に乳幼児用、肥満度（年齢別）は5-17歳の学童期用です。</p>
              </div>

              <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/40 text-[9px] text-amber-700/80 dark:text-amber-300/70">
                <p className="font-semibold mb-1">参考文献・出典:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>身長SDS（満月齢基準）: <a href="https://jspe.umin.jp/medical/files/fuhyo1.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900 dark:hover:text-amber-100">日本小児内分泌学会 附表１（平均体重／標準偏差 2000 年）</a></li>
                  <li>成長曲線: Clin Pediatr Endocrinol 25:71-76, 2016</li>
                  <li>肥満度計算: Clin Pediatr Endocrinol 25:77-82, 2016</li>
                  <li>体重SDS計算: Clin Pediatr Endocrinol 25:71-76, 2016</li>
                  <li>成長率計算: Clin Pediatr Endocrinol 1(1):5-13, 1992</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav aria-label="画面内ナビゲーション" className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur md:hidden print:hidden dark:border-zinc-700 dark:bg-zinc-900/95">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          <a href="#input-section" className="flex h-11 items-center justify-center text-sm font-medium text-gray-700 dark:text-zinc-200">入力</a>
          <a href="#chart-section" className="flex h-11 items-center justify-center text-sm font-medium text-gray-700 dark:text-zinc-200">成長曲線</a>
          <a href="#results-section" className="flex h-11 items-center justify-center text-sm font-medium text-gray-700 dark:text-zinc-200">評価結果</a>
          {heightVelocity.length > 0 && (
            <a href="#hv-section" className="flex h-11 items-center justify-center text-sm font-medium text-gray-700 dark:text-zinc-200">HV</a>
          )}
        </div>
      </nav>

      {/* Screen Reader Announcements for Dynamic Data Updates */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {processedData.length > 0 && (
          <p>
            データが更新されました。現在 {processedData.length} 件の測定データがあります。最新の測定データ（測定日: {format(processedData[processedData.length - 1].date, 'yyyy年MM月dd日')}）は、
            {processedData[processedData.length - 1].height ? `身長 ${processedData[processedData.length - 1].height}センチメートル` : ''}
            {processedData[processedData.length - 1].heightSDS !== undefined ? ` (標準偏差SDS: ${processedData[processedData.length - 1].heightSDS.toFixed(2)})` : ''}、
            {processedData[processedData.length - 1].weight ? `体重 ${processedData[processedData.length - 1].weight}キログラム` : ''}
            {processedData[processedData.length - 1].weightSDS !== undefined ? ` (標準偏差SDS: ${processedData[processedData.length - 1].weightSDS.toFixed(2)})` : ''}
            です。
          </p>
        )}
      </div>
    </main>
  );
};

export default GrowthDashboard;
