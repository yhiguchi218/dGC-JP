import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { toPng } from 'html-to-image';
import { Printer, Download } from 'lucide-react';
import { LMSPoint, interpolateLMS, calculateMeasurementFromZ } from '../lib/growth-utils';
import { calculatePointVisualMode, getChartThemeColors } from '../lib/chart-utils';
import { useTheme } from '../context/ThemeContext';
import { Button } from '@/components/ui/button';

export interface ChartPreset {
  id: string;
  name: string;
  xRange: [number, number]; // [min, max] in years
  yHeightRange: [number, number]; // [min, max] in cm
  yWeightRange: [number, number]; // [min, max] in kg
}

export const CHART_PRESETS: ChartPreset[] = [
  {
    id: '0〜24ヶ月',
    name: '0〜24ヶ月',
    xRange: [0, 2],
    yHeightRange: [30, 100],
    yWeightRange: [0, 35], 
  },
  {
    id: '0歳〜6歳',
    name: '0歳〜6歳',
    xRange: [0, 6],
    yHeightRange: [30, 130],
    yWeightRange: [0, 100], // Aligned with height range (130-30=100)
  },
  {
    id: '0歳〜18歳',
    name: '0歳〜18歳',
    xRange: [0, 18],
    yHeightRange: [30, 190],
    yWeightRange: [0, 160], // Aligned with height range (190-30=160)
  }
];

interface GrowthChartProps {
  sex: '男子' | '女子';
  heightLmsTable: LMSPoint[];
  weightLmsTable: LMSPoint[];
  heightPoints: Array<{
    age: number;
    value: number;
    isCorrected?: boolean;
    isOutlier?: boolean;
    zScore?: number;
  }>;
  weightPoints: Array<{
    age: number;
    value: number;
    isCorrected?: boolean;
    isOutlier?: boolean;
    zScore?: number;
  }>;
  preset: ChartPreset;
}

const GrowthChart: React.FC<GrowthChartProps> = ({
  sex,
  heightLmsTable,
  weightLmsTable,
  heightPoints,
  weightPoints,
  preset,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 1280 });
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handlePrint = () => {
    // Focus and print - in some iframe environments, this is the most reliable way
    window.focus();
    window.print();
  };

  const handleExportTIFF = async () => {
    if (!chartAreaRef.current) return;
    setIsExporting(true);
    try {
      // html-to-image generates high-resolution PNG with clean white background
      const dataUrl = await toPng(chartAreaRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `成長曲線-${sex}-${preset.name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          const isPrintMedia = window.matchMedia('print').matches;
          const isPrintActive = isPrintMedia || isPrinting;
          const targetWidth = isPrintActive ? Math.min(width, 480) : width;
          setDimensions({
            width: targetWidth,
            height: isPrintActive ? targetWidth * 0.72 : width * 1.4
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isPrinting]);

  const { width, height } = dimensions;

  // In print mode, always force standard light colors regardless of user dark mode
  const effectiveIsDark = isPrinting ? false : theme === 'dark';
  const colors = useMemo(() => getChartThemeColors(effectiveIsDark, sex), [effectiveIsDark, sex]);

  const margin = useMemo(() => ({ 
    top: height * 0.03, 
    right: width * 0.12, 
    bottom: height * 0.1, 
    left: width * 0.1 
  }), [width, height]);

  const innerWidth = useMemo(() => width - margin.left - margin.right, [width, margin]);
  const innerHeight = useMemo(() => height - margin.top - margin.bottom, [height, margin]);

  const sdsLevels = [-2, -1, 0, 1, 2];

  const xScale = useMemo(() => {
    return d3.scaleLinear()
      .domain(preset.xRange)
      .range([0, innerWidth]);
  }, [innerWidth, preset.xRange]);

  const yScaleHeight = useMemo(() => {
    return d3.scaleLinear()
      .domain(preset.yHeightRange)
      .range([innerHeight, 0]);
  }, [innerHeight, preset.yHeightRange]);

  const yScaleWeight = useMemo(() => {
    return d3.scaleLinear()
      .domain(preset.yWeightRange)
      .range([innerHeight, 0]);
  }, [innerHeight, preset.yWeightRange]);

  const isSafari = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    if (!svgRef.current || innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Chart inner canvas background
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', colors.background);

    const xTicks = d3.range(preset.xRange[0], preset.xRange[1] + (preset.id === '0〜24ヶ月' ? 0.25 : 1), preset.id === '0〜24ヶ月' ? 0.25 : 1);
    
    // Grid lines (vertical)
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xTicks).tickSize(-innerHeight).tickFormat(() => ''))
      .style('stroke', colors.gridLine)
      .style('stroke-dasharray', '2,2');

    // Grid lines (horizontal)
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScaleHeight)
        .tickValues(d3.range(preset.yHeightRange[0], preset.yHeightRange[1] + 10, 10))
        .tickSize(-innerWidth)
        .tickFormat(() => '')
      )
      .style('stroke', colors.gridLine)
      .style('stroke-dasharray', '2,2');

    // Bottom X-Axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat(d => {
          if (preset.id === '0〜24ヶ月') {
            return Math.round(Number(d) * 12).toString();
          }
          return Math.round(Number(d)).toString();
        })
      );
    
    xAxis.selectAll('text')
      .style('font-size', `${Math.max(10, width * 0.015)}px`)
      .style('font-family', 'var(--font-mono)')
      .style('fill', colors.axisText);

    // Left Height Y-Axis
    const heightAxis = g.append('g')
      .call(d3.axisLeft(yScaleHeight)
        .tickValues(d3.range(preset.yHeightRange[0], preset.yHeightRange[1] + 10, 10))
      )
      .style('color', colors.axisTitle);
    
    heightAxis.selectAll('text')
      .style('font-size', `${Math.max(10, width * 0.015)}px`)
      .style('font-family', 'var(--font-mono)')
      .style('fill', colors.axisTitle);

    const weightTickStep = preset.id === '0〜24ヶ月' ? 5 : 10;
    const maxWeightLabel = preset.id === '0〜24ヶ月' 
      ? 20 
      : (preset.id === '0歳〜6歳' 
        ? 60 
        : (sex === '女子' ? 100 : 120));
    
    // Right Weight Y-Axis
    const weightAxis = g.append('g')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(d3.axisRight(yScaleWeight)
        .tickValues(d3.range(preset.yWeightRange[0], preset.yWeightRange[1] + weightTickStep, weightTickStep))
        .tickPadding(6)
        .tickFormat((d) => (d as number) <= maxWeightLabel ? `${d}` : '')
      )
      .style('color', colors.axisTitle);
    
    weightAxis.selectAll('text')
      .style('font-size', `${Math.max(10, width * 0.015)}px`)
      .style('font-family', 'var(--font-mono)')
      .style('fill', colors.axisTitle);

    // X Axis Title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + margin.bottom * 0.7)
      .attr('text-anchor', 'middle')
      .style('font-size', `${Math.max(12, width * 0.018)}px`)
      .style('font-weight', '600')
      .style('fill', colors.axisText)
      .text(preset.id === '0〜24ヶ月' ? '月齢 (ヶ月)' : '年齢 (歳)');

    // Y Axis Title (Left: Height)
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -margin.left * 0.7)
      .attr('text-anchor', 'middle')
      .style('font-size', `${Math.max(12, width * 0.018)}px`)
      .style('font-weight', '700')
      .style('fill', colors.axisTitle)
      .text('身長 (cm)');

    // Y Axis Title (Right: Weight)
    g.append('text')
      .attr('transform', 'rotate(90)')
      .attr('x', innerHeight / 2)
      .attr('y', -innerWidth - margin.right * 0.75)
      .attr('text-anchor', 'middle')
      .style('font-size', `${Math.max(12, width * 0.018)}px`)
      .style('font-weight', '700')
      .style('fill', colors.axisTitle)
      .text('体重 (kg)');

    // Chart border bounding box
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('stroke', colors.border)
      .attr('stroke-width', 1.5);

    const step = (preset.xRange[1] - preset.xRange[0]) / 100;
    const ages = d3.range(preset.xRange[0], preset.xRange[1] + step, step);
    
    // Height SD Curves
    const heightSDSLevels = [-3, -2.5, -2, -1, 0, 1, 2];
    heightSDSLevels.forEach(sds => {
      const lineData = ages.map(age => {
        const lms = interpolateLMS(age, heightLmsTable);
        return { age, value: calculateMeasurementFromZ(sds, lms) };
      });
      const line = d3.line<{ age: number; value: number }>()
        .x(d => xScale(d.age))
        .y(d => yScaleHeight(d.value))
        .curve(d3.curveNatural);
      
      const isExtra = sds === -2.5 || sds === -3;
      
      g.append('path')
        .datum(lineData)
        .attr('fill', 'none')
        .attr('stroke', sds === 0 ? colors.genderColor : colors.genderLightColor)
        .attr('stroke-width', sds === 0 ? Math.max(1.5, width * 0.003) : Math.max(0.8, width * 0.0015))
        .attr('stroke-opacity', sds === 0 ? 1 : 0.85)
        .attr('stroke-dasharray', isExtra ? '4,4' : null)
        .attr('d', line);

      // Add label immediately beneath the line, contained inside the chart fields
      const lastPoint = lineData[lineData.length - 1];
      if (lastPoint && lastPoint.value >= preset.yHeightRange[0] && lastPoint.value <= preset.yHeightRange[1]) {
        const isYoungPreset = preset.id === '0〜24ヶ月' || preset.id === '0歳〜6歳';
        const yOffset = isYoungPreset ? 6 : 2;
        const dyVal = isYoungPreset ? '1.05em' : '0.85em';

        g.append('text')
          .attr('x', xScale(lastPoint.age) - 4)
          .attr('y', yScaleHeight(lastPoint.value) + yOffset)
          .attr('dy', dyVal)
          .attr('text-anchor', 'end')
          .style('font-size', `${Math.max(8.5, width * 0.012)}px`)
          .style('font-weight', '600')
          .style('fill', colors.labelText)
          .style('stroke', colors.labelBgStroke)
          .style('stroke-width', '2px')
          .style('paint-order', 'stroke fill')
          .text(sds === 0 ? '平均' : `${sds > 0 ? '+' : ''}${sds.toFixed(1)}SD`);
      }
    });

    // Weight SD Curves
    sdsLevels.forEach(sds => {
      const lineData = ages.map(age => {
        const lms = interpolateLMS(age, weightLmsTable);
        return { age, value: calculateMeasurementFromZ(sds, lms) };
      });
      const line = d3.line<{ age: number; value: number }>()
        .x(d => xScale(d.age))
        .y(d => yScaleWeight(d.value))
        .curve(d3.curveNatural);
      g.append('path')
        .datum(lineData)
        .attr('fill', 'none')
        .attr('stroke', sds === 0 ? colors.genderColor : colors.genderLightColor)
        .attr('stroke-width', sds === 0 ? Math.max(1.5, width * 0.003) : Math.max(0.8, width * 0.0015))
        .attr('stroke-opacity', sds === 0 ? 1 : 0.85)
        .attr('d', line);

      // Add label immediately beneath the line, contained inside the chart fields
      const lastPoint = lineData[lineData.length - 1];
      if (lastPoint && lastPoint.value >= preset.yWeightRange[0] && lastPoint.value <= preset.yWeightRange[1]) {
        const isYoungPreset = preset.id === '0〜24ヶ月' || preset.id === '0歳〜6歳';
        const yOffset = isYoungPreset ? 6 : 2;
        const dyVal = isYoungPreset ? '1.05em' : '0.85em';

        g.append('text')
          .attr('x', xScale(lastPoint.age) - 4)
          .attr('y', yScaleWeight(lastPoint.value) + yOffset)
          .attr('dy', dyVal)
          .attr('text-anchor', 'end')
          .style('font-size', `${Math.max(8.5, width * 0.012)}px`)
          .style('font-weight', '600')
          .style('fill', colors.labelText)
          .style('stroke', colors.labelBgStroke)
          .style('stroke-width', '2px')
          .style('paint-order', 'stroke fill')
          .text(sds === 0 ? '平均' : `${sds > 0 ? '+' : ''}${sds.toFixed(1)}SD`);
      }
    });

    // Height Plotted Points
    heightPoints.forEach(d => {
      if (d.age < preset.xRange[0] || d.age > preset.xRange[1]) return;
      
      const { isOutlier, plottedValue, marker, color } = calculatePointVisualMode(
        d.value,
        d.zScore,
        preset.yHeightRange,
        d.isCorrected,
        colors.genderColor,
        colors.outlierColor,
        colors.correctedColor
      );
      
      g.append('text')
        .attr('x', xScale(d.age))
        .attr('y', yScaleHeight(plottedValue))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', isOutlier 
          ? Math.max(22, width * 0.035) * (isSafari ? 1.5 : 1) 
          : Math.max(18, width * 0.028) * (isSafari ? 1.5 : 1))
        .style('fill', color)
        .style('stroke', isOutlier ? 'none' : colors.background)
        .style('stroke-width', '1px')
        .style('font-weight', 'bold')
        .text(marker);
    });

    // Weight Plotted Points
    weightPoints.forEach(d => {
      if (d.age < preset.xRange[0] || d.age > preset.xRange[1]) return;
      
      const { isOutlier, plottedValue, marker, color } = calculatePointVisualMode(
        d.value,
        d.zScore,
        preset.yWeightRange,
        d.isCorrected,
        colors.genderColor,
        colors.outlierColor,
        colors.correctedColor
      );
      
      g.append('text')
        .attr('x', xScale(d.age))
        .attr('y', yScaleWeight(plottedValue))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', isOutlier 
          ? Math.max(22, width * 0.035) * (isSafari ? 1.5 : 1) 
          : Math.max(18, width * 0.028) * (isSafari ? 1.5 : 1))
        .style('fill', color)
        .style('stroke', isOutlier ? 'none' : colors.background)
        .style('stroke-width', '1px')
        .style('font-weight', 'bold')
        .text(marker);
    });
  }, [preset, heightLmsTable, weightLmsTable, heightPoints, weightPoints, xScale, yScaleHeight, yScaleWeight, innerHeight, innerWidth, margin, width, height, colors, isSafari]);

  return (
    <div id="printable-chart-area-wrapper" className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-xl shadow-md border border-gray-100 dark:border-zinc-800 print:shadow-none print:border-none print:p-0 print:m-0 print:overflow-visible transition-colors">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 print:hidden">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-zinc-100">
          {sex} 成長曲線 ({preset.name})
        </h3>
        <div className="flex gap-2">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="flex items-center gap-2 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
            aria-label="成長曲線を印刷する"
            title="Ctrl+P でも印刷できます"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>印刷</span>
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={handleExportTIFF}
            disabled={isExporting}
            className="flex items-center gap-2 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
            aria-label="成長曲線をPNG画像としてダウンロードする"
            aria-busy={isExporting}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{isExporting ? '出力中...' : '画像出力'}</span>
          </Button>
        </div>
      </div>

      <div ref={chartAreaRef} id="printable-chart-area" className="bg-white dark:bg-zinc-900 p-2 print:bg-white print:p-0">
        <div ref={containerRef} className="relative w-full bg-gray-50 dark:bg-zinc-950/70 rounded-lg p-1 md:p-4 print:bg-white print:p-0 print:break-inside-avoid transition-colors">
          <div id="chart-description" className="sr-only">
            <h4>成長曲線データの詳細</h4>
            <p>このグラフは、日本人の標準成長曲線（{preset.name}）を表示しています。</p>
            <p>青色（男子）またはピンク色（女子）の実線は中央値（0SD）、他の実線は基準偏差の範囲を示しています。</p>
            <p>通常測定点は丸記号、在胎週数補正後の測定値は緑色の丸記号、標準偏差から極端に離れた異常値はオレンジ色の三角記号でプロットされます。</p>
            <p>測定データ点数: 身長 {heightPoints.length} 件, 体重 {weightPoints.length} 件。</p>
          </div>
          <svg 
            ref={svgRef} 
            width={width} 
            height={height} 
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full h-auto block"
            role="img"
            aria-label={`${sex}の成長曲線（${preset.name}）。標準成長曲線基準線、および入力された測定データのプロットを表示しています。`}
            aria-describedby="chart-description"
          />
        </div>
        
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-[10px] md:text-xs text-gray-600 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-800 pt-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className={`w-3 md:w-4 h-0.5 ${sex === '男子' ? 'bg-blue-600 dark:bg-blue-500' : 'bg-pink-600 dark:bg-pink-500'}`}></span>
            <span>身長 中央値 (0SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 md:w-4 h-0.5 ${sex === '男子' ? 'bg-blue-600 dark:bg-blue-500' : 'bg-pink-600 dark:bg-pink-500'}`}></span>
            <span>体重 中央値 (0SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 md:w-4 h-0.5 bg-gray-300 dark:bg-zinc-600"></span>
            <span>基準線 (±SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 md:w-4 h-0.5 bg-gray-300 dark:bg-zinc-600 border-t border-dashed border-gray-400 dark:border-zinc-500"></span>
            <span>身長 -2.5/-3.0SD (点線)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`${sex === '男子' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'} font-bold`}>●</span>
            <span>通常測定点 (身長/体重)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-500 dark:text-orange-400 font-bold">▲</span>
            <span>異常値 (±5SD超/範囲外)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 dark:text-emerald-400 font-bold">●</span>
            <span>修正年齢</span>
          </div>
        </div>

        {/* Screen Reader Alternative: Data Tables list */}
        <details className="mt-6 border border-gray-200 dark:border-zinc-800 rounded-lg p-3 bg-gray-50/50 dark:bg-zinc-950/40 print:hidden transition-all">
          <summary className="cursor-pointer font-semibold text-gray-700 dark:text-zinc-300 text-sm hover:text-gray-950 dark:hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1 inline-block select-none">
            測定データをテーブル形式で表示（代替テキスト・音声読み上げ用）
          </summary>
          <div className="mt-4 overflow-x-auto rounded border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" role="region" aria-label="測定データ代替テーブル">
            <table className="min-w-full border-collapse text-xs">
              <caption className="sr-only">測定点（年齢、身長、体重）の一覧</caption>
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300">
                  <th className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center" scope="col">年齢</th>
                  <th className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center" scope="col">身長 (cm)</th>
                  <th className="p-2 text-center" scope="col">体重 (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {heightPoints.length === 0 && weightPoints.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-400 dark:text-zinc-500">測定データが登録されていません。</td>
                  </tr>
                ) : (
                  <>
                    {heightPoints.map((point, idx) => {
                      const matchingWeight = weightPoints.find(w => Math.abs(w.age - point.age) < 0.001 && w.isCorrected === point.isCorrected);
                      return (
                        <tr key={`h-${idx}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="border-r border-gray-200 dark:border-zinc-700 p-2 font-medium text-center text-gray-800 dark:text-zinc-200">
                            {point.age.toFixed(4)}歳
                            {point.isCorrected && <span className="ml-1 text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 rounded">修正年齢</span>}
                          </td>
                          <td className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center text-gray-700 dark:text-zinc-300">{point.value !== null ? `${point.value.toFixed(1)} cm` : '-'}</td>
                          <td className="p-2 text-center text-gray-700 dark:text-zinc-300">{matchingWeight ? `${matchingWeight.value.toFixed(2)} kg` : '-'}</td>
                        </tr>
                      );
                    })}
                    {weightPoints.filter(w => !heightPoints.some(h => Math.abs(h.age - w.age) < 0.001 && h.isCorrected === w.isCorrected)).map((point, idx) => (
                      <tr key={`w-${idx}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="border-r border-gray-200 dark:border-zinc-700 p-2 font-medium text-center text-gray-800 dark:text-zinc-200">
                          {point.age.toFixed(4)}歳
                          {point.isCorrected && <span className="ml-1 text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 rounded">修正年齢</span>}
                        </td>
                        <td className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center text-gray-700 dark:text-zinc-300">-</td>
                        <td className="p-2 text-center text-gray-700 dark:text-zinc-300">{point.value.toFixed(2)} kg</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
};

export default GrowthChart;
