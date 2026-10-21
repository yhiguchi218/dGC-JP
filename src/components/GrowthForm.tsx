import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parse, isValid } from 'date-fns';
import { PlusCircle, Trash2, Save, FileUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateDecimalAge, isValidGestationalDays, isValidGestationalWeeks } from '../lib/growth-utils';
import { CLINICAL_LIMITS, FILE_LIMITS } from '../lib/constants';
import { validateGrowthJSON, parseMeasurementValue, MeasurementValueParse } from '../lib/validation-utils';

const describeInvalidValue = (label: string, range: string, result: MeasurementValueParse) =>
  result.status === 'invalid' && result.issue === 'non-positive'
    ? `${label}は正の値を入力してください（推奨範囲: ${range}）。`
    : `${label}は正の数値で入力してください（例: ${label === '身長' ? '100.5' : '15.2'}）。不正な値の間は評価・保存を保留します。`;

const generateUniqueId = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
};

export interface MeasurementEntry {
  id: string;
  date: Date;
  height?: number | string;
  weight?: number | string;
}

const toHalfWidth = (str: string) => {
  return str.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
};

// Typed text is kept as entered (only full-width characters become their half-width equivalents);
// validity is judged by parseMeasurementValue, never by deleting characters.

interface GrowthFormProps {
  initialData?: {
    childId: string;
    birthDate: Date;
    sex: '男子' | '女子';
    gestationalWeeks: number;
    gestationalDays: number;
    measurements: MeasurementEntry[];
  };
  onDataChange: (data: {
    childId: string;
    birthDate: Date;
    sex: '男子' | '女子';
    gestationalWeeks: number;
    gestationalDays: number;
    measurements: MeasurementEntry[];
  }) => void;
}

const GrowthForm: React.FC<GrowthFormProps> = ({ onDataChange, initialData }) => {
  const [childId, setChildId] = useState(initialData?.childId || '001');
  const [birthDate, setBirthDate] = useState<Date>(initialData?.birthDate || new Date(2020, 0, 1));
  const [sex, setSex] = useState<'男子' | '女子'>(initialData?.sex || '男子');
  const [gestationalWeeks, setGestationalWeeks] = useState(initialData?.gestationalWeeks ?? CLINICAL_LIMITS.GESTATION_WEEKS.DEFAULT);
  const [gestationalWeeksInput, setGestationalWeeksInput] = useState(String(initialData?.gestationalWeeks ?? CLINICAL_LIMITS.GESTATION_WEEKS.DEFAULT));
  const [gestationalDays, setGestationalDays] = useState(initialData?.gestationalDays ?? CLINICAL_LIMITS.GESTATION_DAYS.DEFAULT);
  const [gestationalDaysInput, setGestationalDaysInput] = useState(String(initialData?.gestationalDays ?? 0));
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>(initialData?.measurements || [
    { id: '1', date: new Date(), height: 100, weight: 15 }
  ]);
  // Rows added for further input that the user has not edited yet; they are neither saved nor a reason to block saving.
  const [spareRowIds, setSpareRowIds] = useState<ReadonlySet<string>>(new Set());
  // While an IME is composing, the field text is stored untouched so that the composition is not rewritten.
  const composingRef = React.useRef(false);
  const numericInputProps = (id: string, field: 'height' | 'weight') => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const composing = composingRef.current || (e.nativeEvent as InputEvent).isComposing === true;
      updateMeasurement(id, field, composing ? e.target.value : toHalfWidth(e.target.value));
    },
    onCompositionStart: () => { composingRef.current = true; },
    onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      updateMeasurement(id, field, toHalfWidth(e.currentTarget.value));
    },
  });

  const handleAddMeasurement = () => {
    const newId = generateUniqueId();
    const newMeasurements = [
      ...measurements,
      { id: newId, date: new Date(), height: undefined, weight: undefined }
    ];
    setMeasurements(newMeasurements);
    setSpareRowIds(prev => new Set(prev).add(newId));
    // Trigger focus on the new date input after render
    setTimeout(() => {
      const el = document.getElementById(`date-${newId}`);
      if (el) el.focus();
    }, 10);
  };

  const handleRemoveMeasurement = (id: string) => {
    const newMeasurements = measurements.filter(m => m.id !== id);
    setMeasurements(newMeasurements);
    onDataChange({ childId, birthDate, sex, gestationalWeeks, gestationalDays, measurements: newMeasurements });
  };

  const updateMeasurement = (id: string, field: keyof MeasurementEntry, value: any) => {
    const newMeasurements = measurements.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    );
    setMeasurements(newMeasurements);
    setSpareRowIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onDataChange({ childId, birthDate, sex, gestationalWeeks, gestationalDays, measurements: newMeasurements });
  };

  const triggerChange = (updates: any) => {
    const final = { childId, birthDate, sex, gestationalWeeks, gestationalDays, measurements, ...updates };
    onDataChange(final);
  };

  const confirmGestationalWeeks = (value: string) => {
    const normalized = toHalfWidth(value).trim();
    const weeks = /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
    const confirmedWeeks = isValidGestationalWeeks(weeks) ? weeks : Number.NaN;
    setGestationalWeeksInput(toHalfWidth(value));
    setGestationalWeeks(confirmedWeeks);
    triggerChange({ gestationalWeeks: confirmedWeeks });
  };

  const isMale = sex === '男子';
  const primaryTextClass = isMale ? 'text-blue-700 dark:text-blue-400' : 'text-pink-700 dark:text-pink-400';
  const primaryBgClass = isMale ? 'bg-blue-50/30 dark:bg-blue-950/20' : 'bg-pink-50/30 dark:bg-pink-950/20';
  const primaryBorderClass = isMale ? 'border-blue-200 dark:border-blue-800' : 'border-pink-200 dark:border-pink-800';
  const primaryFocusClass = isMale ? 'focus:border-blue-500 focus:ring-blue-500' : 'focus:border-pink-500 focus:ring-pink-500';
  const primaryUnitClass = isMale ? 'text-blue-400 dark:text-blue-300' : 'text-pink-400 dark:text-pink-300';

  const handleSaveJSON = () => {
    if (!isValidGestationalWeeks(gestationalWeeks)) {
      alert('在胎週数を有限の整数に修正してからデータを保存してください。');
      return;
    }
    if (!isValidGestationalDays(gestationalDays)) {
      alert('在胎日数を0〜6日の整数に修正してからデータを保存してください。');
      return;
    }
    const rowsToSave = measurements
      .map((m, index) => ({ m, rowNumber: index + 1 }))
      .filter(({ m }) => !spareRowIds.has(m.id));
    const problems = rowsToSave.flatMap(({ m, rowNumber }) => {
      const label = `${rowNumber}行目（${m.date ? format(m.date, 'yyyy/MM/dd') : '未指定日'}）`;
      const height = parseMeasurementValue(m.height);
      const weight = parseMeasurementValue(m.weight);
      const rowProblems: string[] = [];
      if (height.status === 'invalid') rowProblems.push(`${label}: 身長の入力値が不正です`);
      if (weight.status === 'invalid') rowProblems.push(`${label}: 体重の入力値が不正です`);
      if (height.status === 'missing' && weight.status === 'missing') rowProblems.push(`${label}: 身長・体重のどちらも未入力です`);
      return rowProblems;
    });
    if (problems.length > 0) {
      alert(`測定データを修正してから保存してください。\n\n${problems.slice(0, 5).map(p => `・${p}`).join('\n')}`);
      return;
    }

    const data = {
      childId,
      birthDate: format(birthDate, "yyyy/MM/dd"),
      sex,
      gestationalWeeks,
      gestationalDays,
      measurements: rowsToSave.map(({ m }) => ({
        ...m,
        date: format(m.date, "yyyy/MM/dd")
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${childId}_成長データ.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > FILE_LIMITS.MAX_JSON_SIZE_BYTES) {
      alert(`ファイルサイズが大きすぎます。${FILE_LIMITS.MAX_JSON_SIZE_BYTES / (1024 * 1024)}MB以下のJSONファイルを選択してください。`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result as string;
        let data: unknown;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error("ファイルの内容がJSON構文として解析できませんでした。");
        }

        // Detailed schema and clinical validation
        const validation = validateGrowthJSON(data);
        if (!validation.isValid) {
          const errorSummary = validation.errors
            .slice(0, 5)
            .map(e => `・${e.message}`)
            .join('\n');
          const moreText = validation.errors.length > 5 ? `\n...他 ${validation.errors.length - 5} 件のエラー` : '';
          alert(`ファイルの読み込みに失敗しました:\n\n${errorSummary}${moreText}`);
          return;
        }

        const parsedDates = validation.parsedDates;
        if (!parsedDates.birthDate || parsedDates.measurements.some(date => date === null)) {
          alert('ファイルの読み込みに失敗しました: 生年月日または測定日を YYYY/MM/DD または YYYY-MM-DD で指定してください。');
          return;
        }

        const gestationalWeekWarnings = validation.warnings.filter(warning => warning.field === 'gestationalWeeks');
        if (gestationalWeekWarnings.length > 0) {
          alert(`読み込み時の在胎週数の確認事項:\n\n${gestationalWeekWarnings.map(warning => `・${warning.message}`).join('\n')}`);
        }
        const otherWarnings = validation.warnings.filter(warning => warning.field !== 'gestationalWeeks');
        if (otherWarnings.length > 0) {
          const warningSummary = otherWarnings
            .slice(0, 3)
            .map(warning => `・${warning.message}`)
            .join('\n');
          console.warn("JSON Import Warnings:\n" + warningSummary);
        }

        // Sex and measurement values come from validation; no separate conversion here.
        const importData = data as Record<string, unknown>;
        const loadedSex = validation.sex;
        if (loadedSex === null) {
          alert('ファイルの読み込みに失敗しました: 性別を確認してください。');
          return;
        }

        const loadedBirthDate = parsedDates.birthDate;
        const importedMeasurements = importData.measurements as unknown[];
        const loadedMeasurements: MeasurementEntry[] = importedMeasurements.map((row, index) => {
          const measurement = row as Record<string, unknown>;
          const values = validation.measurementValues[index];
          return {
            id: typeof measurement.id === 'string' && measurement.id ? measurement.id : generateUniqueId(),
            date: parsedDates.measurements[index] as Date,
            height: values?.height ?? undefined,
            weight: values?.weight ?? undefined,
          };
        });

        const loadedChildId = importData.childId === undefined || importData.childId === null || importData.childId === ''
          ? '001'
          : String(importData.childId);
        setChildId(loadedChildId);
        setBirthDate(loadedBirthDate);
        setSex(loadedSex);
        setGestationalWeeks(validation.gestationalAge.weeks);
        setGestationalWeeksInput(String(validation.gestationalAge.weeks));
        setGestationalDays(validation.gestationalAge.days);
        setGestationalDaysInput(String(validation.gestationalAge.days));
        setMeasurements(loadedMeasurements);
        setSpareRowIds(new Set());

        onDataChange({
          childId: loadedChildId,
          birthDate: loadedBirthDate,
          sex: loadedSex,
          gestationalWeeks: validation.gestationalAge.weeks,
          gestationalDays: validation.gestationalAge.days,
          measurements: loadedMeasurements
        });
      } catch (err) {
        console.error("Failed to parse JSON", err);
        alert(`ファイルの読み込みに失敗しました: ${err instanceof Error ? err.message : '正しい形式のJSONファイルを選択してください。'}`);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <Card className="border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-zinc-100">基本情報</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSaveJSON}
              className="border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
              aria-label="現在の入力データをJSONファイル形式でパソコンにダウンロード保存します"
            >
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              データ保存
            </Button>
            <div className="relative">
              <label 
                htmlFor="load-json-file"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer inline-flex")}
                aria-label="JSON形式のデータファイルをアップロードしてお子さんの成長データを読み込みます"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('load-json-file')?.click();
                  }
                }}
              >
                <FileUp className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>データ読込</span>
                <input 
                  id="load-json-file" 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={handleLoadJSON} 
                  aria-label="成長データJSONファイルを選択"
                />
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <Label htmlFor="childId" className="text-gray-700 dark:text-zinc-300">管理ID</Label>
            <Input
              id="childId"
              value={childId}
              onChange={(e) => {
                setChildId(e.target.value);
                triggerChange({ childId: e.target.value });
              }}
              placeholder="例: 001"
              className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate" className="text-gray-700 dark:text-zinc-300">生年月日</Label>
            <Input
              id="birthDate"
              key={`birth-${birthDate.getTime()}`}
              type="text"
              placeholder="YYYY/MM/DD"
              defaultValue={birthDate ? format(birthDate, "yyyy/MM/dd") : ""}
              onBlur={(e) => {
                const val = e.target.value;
                const date = parse(val, "yyyy/MM/dd", new Date());
                if (isValid(date)) {
                  setBirthDate(date);
                  triggerChange({ birthDate: date });
                } else {
                  // Revert to current birthDate if invalid
                  e.target.value = birthDate ? format(birthDate, "yyyy/MM/dd") : "";
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex" className="text-gray-700 dark:text-zinc-300">性別</Label>
            <Select value={sex} onValueChange={(v: '男子' | '女子') => {
              setSex(v);
              triggerChange({ sex: v });
            }}>
              <SelectTrigger id="sex" className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100">
                <SelectValue placeholder="性別を選択" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectItem value="男子" className="text-gray-900 dark:text-zinc-100 focus:bg-gray-100 dark:focus:bg-zinc-700">男子</SelectItem>
                <SelectItem value="女子" className="text-gray-900 dark:text-zinc-100 focus:bg-gray-100 dark:focus:bg-zinc-700">女子</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gestationalWeeks" className="text-gray-700 dark:text-zinc-300">在胎期間 (週)</Label>
            <Input 
              id="gestationalWeeks"
              type="text" 
              inputMode="numeric"
              value={gestationalWeeksInput}
              onChange={(e) => {
                const value = toHalfWidth(e.target.value);
                setGestationalWeeksInput(value);
                setGestationalWeeks(Number.NaN);
                triggerChange({ gestationalWeeks: Number.NaN });
              }}
              onBlur={(e) => confirmGestationalWeeks(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmGestationalWeeks(e.currentTarget.value);
                }
              }}
              aria-invalid={!isValidGestationalWeeks(gestationalWeeks) || gestationalWeeks < 22 || gestationalWeeks >= 44}
              aria-describedby={
                !isValidGestationalWeeks(gestationalWeeks) ? 'weeks-warning-invalid' :
                gestationalWeeks < 22 ? 'weeks-warning-low' :
                gestationalWeeks >= 44 ? 'weeks-warning-high' : 
                undefined
              }
              className={cn(
                "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100",
                (!isValidGestationalWeeks(gestationalWeeks) || gestationalWeeks < 22 || gestationalWeeks >= 44) && "border-amber-600 bg-amber-50 dark:bg-amber-950/40"
              )}
            />
            {!isValidGestationalWeeks(gestationalWeeks) && (
              <div id="weeks-warning-invalid" role="alert" aria-live="polite" aria-atomic="true" className="text-xs text-amber-900 dark:text-amber-200 font-bold bg-amber-100 dark:bg-amber-950/60 p-2 rounded border-l-4 border-amber-800 dark:border-amber-500 flex items-center gap-1 mt-1">
                <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>在胎週数は空欄にせず、有限の整数で入力して確定してください。評価と保存は保留されます。</span>
              </div>
            )}
            {isValidGestationalWeeks(gestationalWeeks) && gestationalWeeks < 22 && (
              <div 
                id="weeks-warning-low"
                role="alert"
                aria-live="polite"
                aria-atomic="true"
                className="text-xs text-amber-900 dark:text-amber-200 font-bold bg-amber-100 dark:bg-amber-950/60 p-2 rounded border-l-4 border-amber-800 dark:border-amber-500 flex items-center gap-1 mt-1"
              >
                <Info className="h-3 w-3 shrink-0" aria-hidden="true" /> 
                <span>22週未満は22週0日として計算されます</span>
              </div>
            )}
            {isValidGestationalWeeks(gestationalWeeks) && gestationalWeeks >= 44 && (
              <div 
                id="weeks-warning-high"
                role="alert"
                aria-live="polite"
                aria-atomic="true"
                className="text-xs text-amber-900 dark:text-amber-200 font-bold bg-amber-100 dark:bg-amber-950/60 p-2 rounded border-l-4 border-amber-800 dark:border-amber-500 flex items-center gap-1 mt-1"
              >
                <Info className="h-3 w-3 shrink-0" aria-hidden="true" /> 
                <span>44週以上は44週0日として計算されます</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gestationalDays" className="text-gray-700 dark:text-zinc-300">在胎期間 (日)</Label>
            <Input 
              id="gestationalDays"
              type="text" 
              inputMode="numeric"
              value={gestationalDaysInput}
              onChange={(e) => {
                const value = toHalfWidth(e.target.value);
                const normalized = value.trim();
                const days = /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
                setGestationalDaysInput(value);
                setGestationalDays(days);
                triggerChange({ gestationalDays: days });
              }}
              aria-invalid={!isValidGestationalDays(gestationalDays)}
              aria-describedby={!isValidGestationalDays(gestationalDays) ? 'days-warning' : undefined}
              className={cn(
                "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100",
                !isValidGestationalDays(gestationalDays) && "border-amber-600 bg-amber-50 dark:bg-amber-950/40"
              )}
            />
            {!isValidGestationalDays(gestationalDays) && (
              <div
                id="days-warning"
                role="alert"
                aria-live="polite"
                aria-atomic="true"
                className="text-xs text-amber-900 dark:text-amber-200 font-bold bg-amber-100 dark:bg-amber-950/60 p-2 rounded border-l-4 border-amber-800 dark:border-amber-500 flex items-center gap-1 mt-1"
              >
                <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>在胎日数は0〜6日の整数で入力してください</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-zinc-100">測定データ</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddMeasurement}
            className="border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            追加
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {measurements.map((m, index) => {
              const age = calculateDecimalAge(birthDate, m.date);
              const heightCheck = parseMeasurementValue(m.height);
              const weightCheck = parseMeasurementValue(m.weight);
              const heightInvalid = heightCheck.status === 'invalid';
              const weightInvalid = weightCheck.status === 'invalid';
              
              return (
                <div key={m.id} className={cn(
                  "grid grid-cols-1 gap-6 p-6 md:p-8 border-2 rounded-xl relative group items-end bg-white dark:bg-zinc-900 shadow-sm transition-colors",
                  age === null ? "border-red-500 bg-red-50/10 dark:bg-red-950/20" : 
                  age > CLINICAL_LIMITS.AGE.MAX ? "border-amber-400 bg-amber-50/10 dark:bg-amber-950/20" : 
                  "border-gray-100 dark:border-zinc-800"
                )}>
                  {age === null && (
                    <div 
                      role="alert"
                      aria-live="assertive"
                      aria-atomic="true"
                      className="col-span-full text-red-900 dark:text-red-200 font-bold bg-red-100 dark:bg-red-950/60 p-2 rounded border-l-4 border-red-600 flex items-center gap-1 text-xs"
                    >
                      <Info className="h-3 w-3 shrink-0" aria-hidden="true" /> 測定日が生年月日より前です
                    </div>
                  )}
                  {age !== null && age > CLINICAL_LIMITS.AGE.MAX && (
                    <div 
                      role="alert"
                      aria-live="polite"
                      aria-atomic="true"
                      className="col-span-full text-amber-900 dark:text-amber-200 font-bold bg-amber-100 dark:bg-amber-950/60 p-2 rounded border-l-4 border-amber-800 flex items-center gap-1 text-xs"
                    >
                      <Info className="h-3 w-3 shrink-0" aria-hidden="true" /> 18歳を超えています（17.5歳のデータを参照します）
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`date-${m.id}`} className="text-sm font-medium text-gray-500 dark:text-zinc-400">測定日</Label>
                    <Input
                      id={`date-${m.id}`}
                      key={`date-${m.id}-${m.date.getTime()}`}
                      type="text"
                      placeholder="YYYY/MM/DD"
                      defaultValue={m.date ? format(m.date, "yyyy/MM/dd") : ""}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const date = parse(val, "yyyy/MM/dd", new Date());
                        if (isValid(date)) {
                          // Merely focusing and leaving a spare row's date must not turn it into a measurement row.
                          const untouchedSpareRow = spareRowIds.has(m.id) && format(date, "yyyy/MM/dd") === format(m.date, "yyyy/MM/dd");
                          if (!untouchedSpareRow) updateMeasurement(m.id, 'date', date);
                        } else {
                          // Revert to current date if invalid
                          e.target.value = m.date ? format(m.date, "yyyy/MM/dd") : "";
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                          const nextEl = document.getElementById(`height-${m.id}`);
                          if (nextEl) nextEl.focus();
                        }
                      }}
                      aria-label={`測定日を入力（YYYY/MM/DD形式）`}
                      className="h-12 md:h-16 text-lg bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor={`height-${m.id}`} className={cn("text-lg md:text-xl font-bold", primaryTextClass)}>身長 (cm)</Label>
                    <div className="relative">
                      <Input 
                        id={`height-${m.id}`}
                        type="text" 
                        inputMode="decimal"
                        value={m.height ?? ''} 
                        {...numericInputProps(m.id, 'height')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const nextEl = document.getElementById(`weight-${m.id}`);
                            if (nextEl) nextEl.focus();
                          }
                        }}
                        aria-invalid={heightInvalid}
                        aria-describedby={heightInvalid ? `height-error-${m.id}` : undefined}
                        className={cn(
                          "h-20 md:h-32 text-4xl md:text-6xl font-black text-center text-gray-900 dark:text-zinc-100", 
                          primaryBgClass, 
                          primaryBorderClass, 
                          primaryFocusClass,
                          heightInvalid && "border-red-500 bg-red-50 dark:bg-red-950/40"
                        )}
                        placeholder="000.0"
                      />
                      <div className={cn("absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-xl md:text-2xl", primaryUnitClass)}>
                        cm
                      </div>
                    </div>
                    {heightInvalid && (
                      <div 
                        id={`height-error-${m.id}`}
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                        className="text-xs text-red-900 dark:text-red-200 font-bold bg-red-100 dark:bg-red-950/60 p-2 rounded border-l-4 border-red-600 flex items-center gap-1 mt-1"
                      >
                        <Info className="h-3 w-3 shrink-0" aria-hidden="true" /> {describeInvalidValue('身長', '50～200 cm', heightCheck)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor={`weight-${m.id}`} className={cn("text-lg md:text-xl font-bold", primaryTextClass)}>体重 (kg)</Label>
                    <div className="relative">
                      <Input 
                        id={`weight-${m.id}`}
                        type="text" 
                        inputMode="decimal"
                        value={m.weight ?? ''} 
                        {...numericInputProps(m.id, 'weight')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (index === measurements.length - 1) {
                              handleAddMeasurement();
                            } else {
                              const nextId = measurements[index + 1].id;
                              const nextEl = document.getElementById(`date-${nextId}`);
                              if (nextEl) nextEl.focus();
                            }
                          }
                        }}
                        aria-invalid={weightInvalid}
                        aria-describedby={weightInvalid ? `weight-error-${m.id}` : undefined}
                        className={cn(
                          "h-20 md:h-32 text-4xl md:text-6xl font-black text-center text-gray-900 dark:text-zinc-100", 
                          primaryBgClass, 
                          primaryBorderClass, 
                          primaryFocusClass,
                          weightInvalid && "border-red-500 bg-red-50 dark:bg-red-950/40"
                        )}
                        placeholder="00.00"
                      />
                      <div className={cn("absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-xl md:text-2xl", primaryUnitClass)}>
                        kg
                      </div>
                    </div>
                    {weightInvalid && (
                      <div 
                        id={`weight-error-${m.id}`}
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                        className="text-xs text-red-900 dark:text-red-200 font-bold bg-red-100 dark:bg-red-950/60 p-2 rounded border-l-4 border-red-600 flex items-center gap-1 mt-1"
                      >
                        <Info className="h-3 w-3 shrink-0" aria-hidden="true" /> {describeInvalidValue('体重', '2～100 kg', weightCheck)}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-12 w-12 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 rounded-full"
                      onClick={() => handleRemoveMeasurement(m.id)}
                      aria-label={`${m.date ? format(m.date, "yyyy/MM/dd") : '未指定日'}の測定データを削除`}
                    >
                      <Trash2 className="h-6 w-6" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GrowthForm;
