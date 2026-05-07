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
  calculateHVSDS
} from '../lib/growth-utils';
import { 
  HEIGHT_BOYS_LMS, 
  HEIGHT_GIRLS_LMS, 
  WEIGHT_BOYS_LMS, 
  WEIGHT_GIRLS_LMS 
} from '../data/growth-data';
import { SUWA_HV_BOYS, SUWA_HV_GIRLS } from '../data/suwa-hv-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const GrowthDashboard: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<ChartPreset>(CHART_PRESETS[2]); // Default to 0-18y
  const [obesityMode, setObesityMode] = useState<'height' | 'age'>('height');
  const [formData, setFormData] = useState<{
    childId: string;
    birthDate: Date;
    sex: 'male' | 'female';
    gestationalWeeks: number;
    gestationalDays: number;
    measurements: MeasurementEntry[];
  }>({
    childId: '001',
    birthDate: new Date(2020, 0, 1),
    sex: 'male',
    gestationalWeeks: 40,
    gestationalDays: 0,
    measurements: [
      { id: '1', date: new Date(), height: 100, weight: 15 }
    ]
  });

  const heightTable = formData.sex === 'male' ? HEIGHT_BOYS_LMS : HEIGHT_GIRLS_LMS;
  const weightTable = formData.sex === 'male' ? WEIGHT_BOYS_LMS : WEIGHT_GIRLS_LMS;
  const hvRefTable = formData.sex === 'male' ? SUWA_HV_BOYS : SUWA_HV_GIRLS;

  const processedData = useMemo(() => {
    const results = formData.measurements.map(m => {
      const age = calculateDecimalAge(formData.birthDate, m.date);
      const correctedAge = calculateCorrectedAge(
        formData.birthDate, 
        m.date, 
        formData.gestationalWeeks, 
        formData.gestationalDays
      );

      // Height SDS
      let heightSDS = undefined;
      if (m.height) {
        const lms = interpolateLMS(age, heightTable);
        heightSDS = calculateZScore(m.height, lms);
      }

      // Weight SDS
      let weightSDS = undefined;
      let obesityIndex = null;
      let obesityIndexAge = null;
      if (m.weight) {
        const lms = interpolateLMS(age, weightTable);
        weightSDS = calculateZScore(m.weight, lms);
        if (m.height) {
          obesityIndex = calculateObesityIndex(m.weight, m.height, age, formData.sex);
          obesityIndexAge = calculateObesityIndexByAge(m.weight, m.height, age, formData.sex);
        }
      }

      // BMI
      let bmi = undefined;
      if (m.height && m.weight) {
        bmi = m.weight / Math.pow(m.height / 100, 2);
      }

      return {
        ...m,
        age,
        correctedAge,
        heightSDS,
        weightSDS,
        bmi,
        obesityIndex,
        obesityIndexAge,
        isPremature: formData.gestationalWeeks < 37,
        showCorrected: formData.gestationalWeeks < 37 && correctedAge <= 3
      };
    }).sort((a, b) => a.age - b.age);

    return results;
  }, [formData, heightTable, weightTable]);

  // Height Velocity Calculation
  const heightVelocity = useMemo(() => {
    const velocities = [];
    for (let i = 0; i < processedData.length - 1; i++) {
      for (let j = i + 1; j < processedData.length; j++) {
        const p1 = processedData[i];
        const p2 = processedData[j];
        if (p1.height && p2.height) {
          const ageDiff = p2.age - p1.age;
          if (ageDiff >= 0.95) { // Approx 1 year
            const hv = (p2.height - p1.height) / ageDiff;
            const midAge = (p1.age + p2.age) / 2;
            const hvSDS = calculateHVSDS(hv, midAge, formData.sex, hvRefTable);
            
            velocities.push({
              midAge,
              value: hv,
              hvSDS,
              p1,
              p2,
              ageDiffDays: Math.round(ageDiff * 365.25),
              heightDiff: p2.height - p1.height
            });
          }
        }
      }
    }
    return velocities;
  }, [processedData]);

  const heightPoints = useMemo(() => {
    const points: any[] = [];
    processedData.forEach(d => {
      if (d.height) {
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
      if (d.weight) {
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
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 print:m-0 print:p-0 print:max-w-none">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">dGC-JP</h1>
          <p className="text-gray-500">日本版デジタル成長曲線プラットフォーム</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1">Phase 1: Standalone</Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block">
        {/* Left Column: Input Forms */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8 print:hidden">
          <GrowthForm onDataChange={setFormData} initialData={formData} />
        </div>

        {/* Right Column: Chart and Results */}
        <div className="lg:col-span-8 space-y-8 print:space-y-2 print:m-0 print:p-0">
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
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="曲線を選択" />
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 print:bg-transparent print:border-b">
                    <tr>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]">測定日</th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]">年齢</th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]">身長 (SDS)</th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]">体重 (SDS)</th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]">BMI</th>
                      <th className="px-4 py-3 print:px-1 print:py-0.5 print:text-[7pt]">
                        肥満度
                        <span className={cn(
                          "ml-1 text-[8px] normal-case px-1 rounded",
                          formData.sex === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        )}>
                          {obesityMode === 'height' ? '身長値ベース' : '年齢別ベース'}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedData.map((d, i) => {
                      const currentObesity = obesityMode === 'height' ? d.obesityIndex : d.obesityIndexAge;
                      const isLast = i === processedData.length - 1;
                      return (
                        <tr key={i} className={cn("border-b hover:bg-gray-50 print:border-b-0", !isLast && "print:hidden")}>
                          <td className="px-4 py-3 font-medium print:px-1 print:py-0.5 print:text-[8pt]">{format(d.date, 'yyyy/MM/dd')}</td>
                          <td className="px-4 py-3 print:px-1 print:py-0.5 print:text-[8pt]">
                            {d.age.toFixed(4)}歳
                            {d.showCorrected && (
                              <div className="text-[10px] text-emerald-600 print:text-[6pt]">
                                (修正: {d.correctedAge.toFixed(4)}歳)
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
            <Card className={cn("border-opacity-50 print:hidden", formData.sex === 'male' ? "border-blue-100 bg-blue-50/30" : "border-red-100 bg-red-50/30")}>
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Info className={cn("h-5 w-5", formData.sex === 'male' ? "text-blue-500" : "text-red-500")} />
                  身長速度 (Height Velocity)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {heightVelocity.map((hv, i) => (
                    <div key={i} className={cn("flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm", formData.sex === 'male' ? "border-blue-100" : "border-red-100")}>
                      <div>
                        <div className="text-sm text-gray-500">評価期間の中間年齢: {hv.midAge.toFixed(2)}歳</div>
                        <div className={cn("text-2xl font-bold flex items-baseline gap-2", formData.sex === 'male' ? "text-blue-600" : "text-red-600")}>
                          HV: {hv.value.toFixed(2)} cm/年
                          {hv.hvSDS !== null && (
                            <span className={cn(
                              "text-sm",
                              Math.abs(hv.hvSDS) > 2 ? "text-orange-500 font-bold" : (formData.sex === 'male' ? "text-blue-500 font-medium" : "text-red-500 font-medium")
                            )}>
                              (SDS: {hv.hvSDS.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
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
                <p>※ 基準値外（±5SD超）の場合は外挿値として計算され、グラフ上は「△」で表示されます。</p>
                <p>※ 肥満度（身長別）は主に乳幼児用、肥満度（年齢別）は5-17歳の学童期用です。</p>
              </div>

              <div className="pt-2 border-t border-amber-200/50 text-[9px] text-amber-700/80">
                <p className="font-semibold mb-1">参考文献・出典:</p>
                <ul className="list-disc list-inside space-y-0.5">
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
    </div>
  );
};

export default GrowthDashboard;
