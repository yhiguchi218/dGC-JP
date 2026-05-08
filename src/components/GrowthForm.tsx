import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parse, isValid } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Save, FileUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateDecimalAge } from '../lib/growth-utils';

export interface MeasurementEntry {
  id: string;
  date: Date;
  height?: number | string;
  weight?: number | string;
}

const toHalfWidth = (str: string) => {
  return str.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
};

const sanitizeNumericInput = (value: string, allowDecimal: boolean = true) => {
  let sanitized = toHalfWidth(value);
  if (allowDecimal) {
    sanitized = sanitized.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) sanitized = parts[0] + '.' + parts.slice(1).join('');
  } else {
    sanitized = sanitized.replace(/[^0-9]/g, '');
  }
  return sanitized;
};

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
  const [gestationalWeeks, setGestationalWeeks] = useState(initialData?.gestationalWeeks || 40);
  const [gestationalDays, setGestationalDays] = useState(initialData?.gestationalDays || 0);
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>(initialData?.measurements || [
    { id: '1', date: new Date(), height: 100, weight: 15 }
  ]);

  const handleAddMeasurement = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newMeasurements = [
      ...measurements,
      { id: newId, date: new Date(), height: undefined, weight: undefined }
    ];
    setMeasurements(newMeasurements);
    // Trigger focus on the new date input after render
    setTimeout(() => {
      const el = document.getElementById(`date-${newId}`);
      if (el) el.focus();
    }, 10);
  };

  const handleRemoveMeasurement = (id: string) => {
    setMeasurements(measurements.filter(m => m.id !== id));
  };

  const updateMeasurement = (id: string, field: keyof MeasurementEntry, value: any) => {
    const newMeasurements = measurements.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    );
    setMeasurements(newMeasurements);
    onDataChange({ childId, birthDate, sex, gestationalWeeks, gestationalDays, measurements: newMeasurements });
  };

  const triggerChange = (updates: any) => {
    const final = { childId, birthDate, sex, gestationalWeeks, gestationalDays, measurements, ...updates };
    onDataChange(final);
  };

  const isMale = sex === '男子';
  const primaryColorClass = isMale ? 'blue' : 'red';
  const primaryTextClass = isMale ? 'text-blue-700' : 'text-red-700';
  const primaryBgClass = isMale ? 'bg-blue-50/30' : 'bg-red-50/30';
  const primaryBorderClass = isMale ? 'border-blue-200' : 'border-red-200';
  const primaryFocusClass = isMale ? 'focus:border-blue-500 focus:ring-blue-500' : 'focus:border-red-500 focus:ring-red-500';
  const primaryUnitClass = isMale ? 'text-blue-300' : 'text-red-300';

  const handleSaveJSON = () => {
    const data = {
      childId,
      birthDate: format(birthDate, "yyyy/MM/dd"),
      sex,
      gestationalWeeks,
      gestationalDays,
      measurements: measurements.map(m => ({
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

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        // Handle migration from old 'male'/'female' to Japanese if needed
        let loadedSex = data.sex;
        if (loadedSex === 'male') loadedSex = '男子';
        if (loadedSex === 'female') loadedSex = '女子';

        // Try parsing different formats for robustness
        const parseDate = (dateStr: string) => {
          // Try YYYY/MM/DD
          let d = parse(dateStr, "yyyy/MM/dd", new Date());
          if (isValid(d)) return d;
          // Try YYYY-MM-DD (ISO)
          d = new Date(dateStr);
          if (isValid(d)) return d;
          return new Date();
        };

        const loadedBirthDate = parseDate(data.birthDate);
        const loadedMeasurements = data.measurements.map((m: any) => ({
          ...m,
          date: parseDate(m.date)
        }));

        setChildId(data.childId);
        setBirthDate(loadedBirthDate);
        setSex(loadedSex);
        setGestationalWeeks(data.gestationalWeeks);
        setGestationalDays(data.gestationalDays);
        setMeasurements(loadedMeasurements);

        onDataChange({
          childId: data.childId,
          birthDate: loadedBirthDate,
          sex: loadedSex,
          gestationalWeeks: data.gestationalWeeks,
          gestationalDays: data.gestationalDays,
          measurements: loadedMeasurements
        });
      } catch (err) {
        console.error("Failed to parse JSON", err);
        alert("ファイルの読み込みに失敗しました。正しい形式のJSONファイルを選択してください。");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold">基本情報</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveJSON}>
              <Save className="mr-2 h-4 w-4" />
              データ保存
            </Button>
            <div className="relative">
              <label 
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}
              >
                <FileUp className="mr-2 h-4 w-4" />
                データ読込
                <input type="file" accept=".json" className="hidden" onChange={handleLoadJSON} />
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <Label htmlFor="childId">管理ID</Label>
            <Input
              id="childId"
              value={childId}
              onChange={(e) => {
                setChildId(e.target.value);
                triggerChange({ childId: e.target.value });
              }}
              placeholder="例: 001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">生年月日</Label>
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">性別</Label>
            <Select value={sex} onValueChange={(v: '男子' | '女子') => {
              setSex(v);
              triggerChange({ sex: v });
            }}>
              <SelectTrigger id="sex">
                <SelectValue placeholder="性別を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="男子">男子</SelectItem>
                <SelectItem value="女子">女子</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gestationalWeeks">在胎期間 (週)</Label>
            <Input 
              id="gestationalWeeks"
              type="text" 
              inputMode="numeric"
              value={gestationalWeeks} 
              onChange={(e) => {
                const sanitized = sanitizeNumericInput(e.target.value, false);
                const v = parseInt(sanitized) || 0;
                setGestationalWeeks(v);
                triggerChange({ gestationalWeeks: v });
              }} 
              className={cn((gestationalWeeks < 22 || gestationalWeeks >= 44) && "border-amber-500 bg-amber-50")}
            />
            {gestationalWeeks < 22 && (
              <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Info className="h-3 w-3" /> 22週未満は22週0日として計算されます
              </p>
            )}
            {gestationalWeeks >= 44 && (
              <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Info className="h-3 w-3" /> 44週以降は44週0日として計算されます
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gestationalDays">在胎期間 (日)</Label>
            <Input 
              id="gestationalDays"
              type="text" 
              inputMode="numeric"
              value={gestationalDays} 
              onChange={(e) => {
                const sanitized = sanitizeNumericInput(e.target.value, false);
                const v = parseInt(sanitized) || 0;
                setGestationalDays(v);
                triggerChange({ gestationalDays: v });
              }} 
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold">測定データ</CardTitle>
          <Button variant="outline" size="sm" onClick={handleAddMeasurement}>
            <PlusCircle className="mr-2 h-4 w-4" />
            追加
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {measurements.map((m, index) => {
              const age = calculateDecimalAge(birthDate, m.date);
              
              return (
                <div key={m.id} className={cn(
                  "grid grid-cols-1 gap-6 p-6 md:p-8 border-2 rounded-xl relative group items-end bg-white shadow-sm transition-colors",
                  age < 0 ? "border-red-500 bg-red-50/10" : 
                  age > 18 ? "border-amber-400 bg-amber-50/10" : 
                  "border-gray-100"
                )}>
                  {age < 0 && (
                    <div className="col-span-full text-red-500 text-xs font-bold flex items-center gap-1">
                      <Info className="h-3 w-3" /> 測定日が生年月日より前です
                    </div>
                  )}
                  {age > 18 && (
                    <div className="col-span-full text-amber-600 text-xs font-bold flex items-center gap-1">
                      <Info className="h-3 w-3" /> 18歳を超えています（17.5歳のデータを参照します）
                    </div>
                  )}
                  <div className="space-y-2">
                  <Label htmlFor={`date-${m.id}`} className="text-sm font-medium text-gray-500">測定日</Label>
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
                        updateMeasurement(m.id, 'date', date);
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
                    className="h-12 md:h-16 text-lg bg-gray-50 border-gray-200"
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
                      onChange={(e) => {
                        const sanitized = sanitizeNumericInput(e.target.value);
                        updateMeasurement(m.id, 'height', sanitized);
                      }} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const nextEl = document.getElementById(`weight-${m.id}`);
                          if (nextEl) nextEl.focus();
                        }
                      }}
                      className={cn(
                        "h-20 md:h-32 text-4xl md:text-6xl font-black text-center", 
                        primaryBgClass, 
                        primaryBorderClass, 
                        primaryFocusClass,
                        Number(m.height || 0) < 0 && "border-red-500 bg-red-50"
                      )}
                      placeholder="000.0"
                    />
                    <div className={cn("absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-xl md:text-2xl", primaryUnitClass)}>
                      cm
                    </div>
                  </div>
                  {Number(m.height || 0) < 0 && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                      <Info className="h-3 w-3" /> 身長に負の値は入力できません
                    </p>
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
                      onChange={(e) => {
                        const sanitized = sanitizeNumericInput(e.target.value);
                        updateMeasurement(m.id, 'weight', sanitized);
                      }} 
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
                      className={cn(
                        "h-20 md:h-32 text-4xl md:text-6xl font-black text-center", 
                        primaryBgClass, 
                        primaryBorderClass, 
                        primaryFocusClass,
                        Number(m.weight || 0) < 0 && "border-red-500 bg-red-50"
                      )}
                      placeholder="00.00"
                    />
                    <div className={cn("absolute inset-y-0 right-4 flex items-center pointer-events-none font-bold text-xl md:text-2xl", primaryUnitClass)}>
                      kg
                    </div>
                  </div>
                  {Number(m.weight || 0) < 0 && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                      <Info className="h-3 w-3" /> 体重に負の値は入力できません
                    </p>
                  )}
                </div>
                <div className="flex justify-end pt-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-12 w-12 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-full"
                    onClick={() => handleRemoveMeasurement(m.id)}
                  >
                    <Trash2 className="h-6 w-6" />
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
