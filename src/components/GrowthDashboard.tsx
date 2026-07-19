import React, { useState, useMemo } from 'react';
import GrowthChart, { CHART_PRESETS, ChartPreset } from './GrowthChart';
import GrowthForm, { MeasurementEntry } from './GrowthForm';
import { 
  calculateDecimalAge, 
  calculateCorrectedAge, 
  calculateZScore, 
  interpolateLMS,
  calculateObesityIndex,
  calculateObesityIndexByAge,
  calculateHVSDS,
  calculateFullMonthsAge,
  getCorrectedBirthDate
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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Info, Printer, FileDown } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { cn } from '@/lib/utils';

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
      { id: '1', date: new Date(), height: 100, weight: 15 }
    ]
  });

  const heightTable = formData.sex === '男子' ? HEIGHT_BOYS_LMS : HEIGHT_GIRLS_LMS;
  const weightTable = formData.sex === '男子' ? WEIGHT_BOYS_LMS : WEIGHT_GIRLS_LMS;
  const hvRefTable = formData.sex === '男子' ? SUWA_HV_BOYS : SUWA_HV_GIRLS;

  const processedData = useMemo(() => {
    const results = formData.measurements.map(m => {
      const h = typeof m.height === 'string' ? parseFloat(m.height) : m.height;
      const w = typeof m.weight === 'string' ? parseFloat(m.weight) : m.weight;
      
      const age = calculateDecimalAge(formData.birthDate, m.date);
      const correctedAge = calculateCorrectedAge(
        formData.birthDate, 
        m.date, 
        formData.gestationalWeeks, 
        formData.gestationalDays
      );

      // Height SDS
      let heightSDS = undefined;
      // Safety guard: height must be significantly positive for meaningful SDS/BMI
      if (h && !isNaN(h) && h > 0) {
        const useCorrected = formData.gestationalWeeks < 37 && correctedAge !== null && correctedAge <= 3;
        const refBirthDate = useCorrected
          ? getCorrectedBirthDate(formData.birthDate, formData.gestationalWeeks, formData.gestationalDays)
          : formData.birthDate;

        const months = differenceInMonths(m.date, refBirthDate);
        const clampedMonths = Math.max(0, Math.min(210, months));
        const table = formData.sex === '男子' ? FUHYO_BOYS_HEIGHT : FUHYO_GIRLS_HEIGHT;
        const [mean, sd] = table[clampedMonths];
        heightSDS = (h - mean) / sd;
      }

      // Weight SDS
      let weightSDS = undefined;
      let obesityIndex = null;
      let obesityIndexAge = null;
      // obesity index sex check
      if (w && !isNaN(w) && w > 0 && age !== null) {
        const lms = interpolateLMS(age, weightTable);
        weightSDS = calculateZScore(w, lms);
        if (h && !isNaN(h) && h > 0) {
          const lmsSex = formData.sex === '男子' ? 'male' : 'female';
          obesityIndex = calculateObesityIndex(w, h, age, lmsSex);
          obesityIndexAge = calculateObesityIndexByAge(w, h, age, lmsSex);
        }
      }

      // BMI
      let bmi = undefined;
      if (h && w && !isNaN(h) && !isNaN(w) && h > 0) {
        bmi = w / Math.pow(h / 100, 2);
      }

      return {
        ...m,
        height: h,
        weight: w,
        age,
        correctedAge,
        heightSDS,
        weightSDS,
        bmi,
        obesityIndex,
        obesityIndexAge,
        isPremature: formData.gestationalWeeks < 37,
        showCorrected: formData.gestationalWeeks < 37 && correctedAge !== null && correctedAge <= 3
      };
    }).sort((a, b) => {
      if (a.age === null && b.age === null) return 0;
      if (a.age === null) return 1;
      if (b.age === null) return -1;
      return a.age - b.age;
    });

    return results;
  }, [formData, heightTable, weightTable]);

  // Height Velocity Calculation (Chained, non-overlapping intervals)
  const heightVelocity = useMemo(() => {
    const velocities = [];
    let i = 0;
    while (i < processedData.length - 1) {
      let found = false;
      const p1 = processedData[i];
      if (!p1.height) {
        i++;
        continue;
      }
      for (let j = i + 1; j < processedData.length; j++) {
        const p2 = processedData[j];
        if (p2.height) {
          if (p1.age === null || p2.age === null) continue;
          const ageDiff = p2.age - p1.age;
          if (ageDiff >= 0.95) { // Approx 1 year
            const hv = (p2.height - p1.height) / ageDiff;
            const midAge = (p1.age + p2.age) / 2;
            const hvSex = formData.sex === '男子' ? 'male' : 'female';
            const hvSDS = calculateHVSDS(hv, midAge, hvSex, hvRefTable);
            
            velocities.push({
              midAge,
              value: hv,
              hvSDS,
              p1,
              p2,
              ageDiffDays: Math.round(ageDiff * 365.25),
              heightDiff: p2.height - p1.height
            });
            i = j; // Advance pointer to the end of the current interval
            found = true;
            break;
          }
        }
      }
      if (!found) {
        i++;
      }
    }
    return velocities;
  }, [processedData, formData.sex, hvRefTable]);

  const heightPoints = useMemo(() => {
    const points: any[] = [];
    processedData.forEach(d => {
      if (d.height && d.age !== null) {
        points.push({
          age: d.age,
          value: d.height,
          zScore: d.heightSDS,
          isCorrected: false
        });
        if (d.showCorrected && d.correctedAge !== null) {
          points.push({
            age: d.correctedAge,
            value: d.height,
            zScore: d.heightSDS, // Note: Z-score should ideally be recalculated for corrected age
            isCorrected: true
          });
        }
      }
    });
    return points;
  }, [processedData]);

  const weightPoints = useMemo(() => {
    const points: any[] = [];
    processedData.forEach(d => {
      if (d.weight && d.age !== null) {
        points.push({
          age: d.age,
          value: d.weight,
          zScore: d.weightSDS,
          isCorrected: false
        });
        if (d.showCorrected && d.correctedAge !== null) {
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
    <main id="main-content" tabIndex={-1} className="focus:outline-none max-w-7xl mx-auto p-4 md:p-8 space-y-8 print:m-0 print:p-0 print:max-w-none print:overflow-visible">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">dGC-JP</h1>
          <p className="text-gray-500 text-sm mt-1">日本版デジタル成長曲線プラットフォーム</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="px-3 py-1 bg-gray-50 text-gray-700 border-gray-200">
            フェーズ 1: スタンドアロン版
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block">
        {/* Left Column: Input Forms */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8 print:hidden">
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
                <span className="font-bold">{formData.childId || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase tracking-wider">性別</span>
                <span className="font-bold">{formData.sex}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase tracking-wider">生年月日</span>
                <span className="font-bold">{format(formData.birthDate, 'yyyy/MM/dd')}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase tracking-wider">在胎期間</span>
                <span className="font-bold">
                  {formData.gestationalWeeks}週{formData.gestationalDays}日
                  {formData.gestationalWeeks < 37 && <span className="text-emerald-600 ml-1 text-[9px]">(早産期修正)</span>}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-100 gap-4 print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-medium text-gray-700">表示範囲:</span>
              <Select 
                value={selectedPreset.id} 
                onValueChange={(id) => {
                  const preset = CHART_PRESETS.find(p => p.id === id);
                  if (preset) setSelectedPreset(preset);
                }}
              >
                <SelectTrigger className="w-full sm:w-[260px]">
                  <SelectValue placeholder="表示範囲を選択">
                    {selectedPreset.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CHART_PRESETS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-[10px] text-gray-400 sm:max-w-[300px] sm:text-right">
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

          <Card className="print:shadow-none print:border-none print:m-0 print:p-0">
            <div className="hidden print:block font-bold text-sm border-b pb-1 mb-2">評価結果</div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 print:hidden">
              <CardTitle className="text-xl font-semibold print:text-base">評価結果</CardTitle>
              <div className="flex bg-gray-100 p-1 rounded-md text-[10px] md:text-xs print:hidden">
                <button 
                  onClick={() => setObesityMode('height')}
                  className={cn(
                    "px-2 py-1 rounded transition-colors",
                    obesityMode === 'height' ? "bg-white shadow-sm font-bold" : "text-gray-500 hover:bg-gray-200"
                  )}
                >
                  性別身長別
                </button>
                <button 
                  onClick={() => setObesityMode('age')}
                  className={cn(
                    "px-2 py-1 rounded transition-colors",
                    obesityMode === 'age' ? "bg-white shadow-sm font-bold" : "text-gray-500 hover:bg-gray-200"
                  )}
                >
                  性別年齢別
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div role="region" aria-labelledby="results-title" className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <caption className="sr-only" id="results-title">
                    お子さんの成長データ評価結果。各行は測定日ごとの測定値、年齢、身長SDS、体重SDS、BMI、肥満度を表示しています。
                  </caption>
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 print:bg-transparent print:border-b">
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
                          formData.sex === '男子' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                        )}>
                          {obesityMode === 'height' ? '身長値ベース' : '年齢別ベース'}
                        </span>
                        <span className="sr-only">パーセント。</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedData.map((d, i) => {
                      const currentObesity = obesityMode === 'height' ? d.obesityIndex : d.obesityIndexAge;
                      return (
                        <tr key={i} className="border-b hover:bg-gray-50 print:border-b print:border-gray-100">
                          <td className="px-4 py-3 font-medium print:px-1 print:py-0.5 print:text-[8pt]">{format(d.date, 'yyyy/MM/dd')}</td>
                          <td className="px-4 py-3 print:px-1 print:py-0.5 print:text-[8pt]">
                            <div className="font-semibold">{d.age.toFixed(4)}歳</div>
                            <div className="text-[11px] text-gray-500 font-normal mt-0.5 leading-tight print:text-[6.5pt]">
                              {calculateFullMonthsAge(formData.birthDate, d.date)}
                            </div>
                            {d.showCorrected && (
                              <div className="text-[10px] text-emerald-600 font-semibold print:text-[6pt] mt-1.5 pt-1.5 border-t border-emerald-100/30">
                                <div>修正: {d.correctedAge.toFixed(4)}歳</div>
                                <div className="text-[9px] text-emerald-500 font-normal mt-0.5 print:text-[5.5pt]">
                                  {calculateFullMonthsAge(
                                    getCorrectedBirthDate(formData.birthDate, formData.gestationalWeeks, formData.gestationalDays),
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
                                Math.abs(d.heightSDS) > 2 ? "text-red-500 font-bold" : "text-gray-500"
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
                                Math.abs(d.weightSDS) > 2 ? "text-red-500 font-bold" : "text-gray-500"
                              )}>
                                ({d.weightSDS.toFixed(2)}SD)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 print:px-1 print:py-0.5 print:text-[8pt]">{d.bmi?.toFixed(1) || '-'}</td>
                          <td className="px-4 py-3 text-center print:px-1 print:py-0.5 print:text-[8pt]">
                            {currentObesity !== null ? (
                              <span className={cn(
                                currentObesity > 20 ? "text-orange-500 font-bold" : currentObesity < -20 ? "text-blue-500 font-bold" : ""
                              )}>
                                {currentObesity.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-300 text-[10px] print:text-[6pt]">算出不可</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
 
          {heightVelocity.length > 0 && (
            <Card className={cn("border-opacity-50 print:border print:border-gray-200 print:bg-white print:p-2", formData.sex === '男子' ? "border-blue-100 bg-blue-50/30" : "border-pink-100 bg-pink-50/30")}>
              <CardHeader className="print:p-1">
                <CardTitle className="text-xl font-semibold flex items-center gap-2 print:text-xs">
                  <Info className={cn("h-5 w-5 print:h-3 print:w-3", formData.sex === '男子' ? "text-blue-500" : "text-pink-500")} />
                  身長速度 (Height Velocity)
                </CardTitle>
              </CardHeader>
              <CardContent className="print:p-1">
                <div className="space-y-4 print:space-y-1">
                  {heightVelocity.map((hv, i) => (
                    <div key={i} className={cn("flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm print:p-2 print:shadow-none print:border-gray-100 text-xs", formData.sex === '男子' ? "border-blue-100" : "border-pink-100")}>
                      <div>
                        <div className="text-sm text-gray-500 print:text-[8px]">評価期間の中間年齢: {hv.midAge.toFixed(2)}歳</div>
                        <div className={cn("text-2xl font-bold flex items-baseline gap-2 print:text-sm", formData.sex === '男子' ? "text-blue-600" : "text-pink-600")}>
                          HV: {hv.value.toFixed(2)} cm/年
                          {hv.hvSDS !== null && (
                            <span className={cn(
                              "text-sm print:text-[9px]",
                              Math.abs(hv.hvSDS) > 2 ? "text-orange-500 font-bold" : (formData.sex === '男子' ? "text-blue-500 font-medium" : "text-pink-500 font-medium")
                            )}>
                              (SDS: {hv.hvSDS.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500 print:text-[8px]">
                        根拠: +{hv.heightDiff.toFixed(1)} cm / {hv.ageDiffDays}日
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 shadow-sm print:hidden">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-800 space-y-2">
              <div>
                <p className="font-bold underline mb-1">重要：ご利用にあたっての免責事項</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>本ツールは教育・研究用であり、確定診断には使用しないでください。</li>
                  <li>計算結果の最終的な判断は、必ず主治医の責任において行ってください。</li>
                  <li><strong>プライバシー保護:</strong> 入力された患者データはブラウザ内でのみ一時的に処理され、外部サーバーへ送信・蓄積されることはありません。</li>
                  <li><strong>データ保持:</strong> セキュリティのため、ブラウザをリロード（再読み込み）すると入力データはすべて消去されます。必要に応じて「データ保存」ボタンからJSON形式でバックアップをダウンロードしてください。</li>
                </ul>
              </div>
              
              <div className="pt-2 border-t border-amber-200/50">
                <p>※ 基準値外（±5SD超）の場合は外挿値として計算され、グラフ上は「▲」で表示されます。</p>
                <p>※ 肥満度（身長別）は主に乳幼児用、肥満度（年齢別）は5-17歳の学童期用です。</p>
              </div>

              <div className="pt-2 border-t border-amber-200/50 text-[9px] text-amber-700/80">
                <p className="font-semibold mb-1">参考文献・出典:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>身長SDS（満月齢基準）: <a href="https://jspe.umin.jp/medical/files/fuhyo1.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">日本小児内分泌学会 附表１（平均体重／標準偏差 2000 年）</a></li>
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
