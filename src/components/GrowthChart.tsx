import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { toPng } from 'html-to-image';
import { Printer, Download } from 'lucide-react';
import { LMSPoint, interpolateLMS, calculateMeasurementFromZ } from '../lib/growth-utils';
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
      // html-to-image doesn't support TIFF directly, so we generate PNG first
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
          setDimensions({
            width,
            height: (isPrintMedia || isPrinting) ? width * 1.15 : width * 1.4
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isPrinting]);

  const { width, height } = dimensions;

  const genderColor = sex === '男子' ? '#2563eb' : '#db2777';
  const genderLightColor = sex === '男子' ? '#60a5fa' : '#f472b6';

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

    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#ffffff');

    const xTicks = d3.range(preset.xRange[0], preset.xRange[1] + (preset.id === '0〜24ヶ月' ? 0.25 : 1), preset.id === '0〜24ヶ月' ? 0.25 : 1);
    
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xTicks).tickSize(-innerHeight).tickFormat(() => ''))
      .style('stroke', '#f3f4f6')
      .style('stroke-dasharray', '2,2');

    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScaleHeight)
        .tickValues(d3.range(preset.yHeightRange[0], preset.yHeightRange[1] + 10, 10))
        .tickSize(-innerWidth)
        .tickFormat(() => '')
      )
      .style('stroke', '#f3f4f6')
      .style('stroke-dasharray', '2,2');

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
      .style('font-family', 'var(--font-mono)');

    const heightAxis = g.append('g')
      .call(d3.axisLeft(yScaleHeight)
        .tickValues(d3.range(preset.yHeightRange[0], preset.yHeightRange[1] + 10, 10))
      )
      .style('color', genderColor);
    
    heightAxis.selectAll('text')
      .style('font-size', `${Math.max(10, width * 0.015)}px`)
      .style('font-family', 'var(--font-mono)');

    const weightTickStep = preset.id === '0〜24ヶ月' ? 5 : 10;
    const maxWeightLabel = preset.id === '0〜24ヶ月' 
      ? 20 
      : (preset.id === '0歳〜6歳' 
        ? 60 
        : (sex === '女子' ? 100 : 120));
    
    const weightAxis = g.append('g')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(d3.axisRight(yScaleWeight)
        .tickValues(d3.range(preset.yWeightRange[0], preset.yWeightRange[1] + weightTickStep, weightTickStep))
        .tickPadding(6)
        .tickFormat((d) => (d as number) <= maxWeightLabel ? `${d}` : '')
      )
      .style('color', genderColor);
    
    weightAxis.selectAll('text')
      .style('font-size', `${Math.max(10, width * 0.015)}px`)
      .style('font-family', 'var(--font-mono)');

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + margin.bottom * 0.7)
      .attr('text-anchor', 'middle')
      .style('font-size', `${Math.max(12, width * 0.018)}px`)
      .style('font-weight', '600')
      .text(preset.id === '0〜24ヶ月' ? '月齢 (ヶ月)' : '年齢 (歳)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -margin.left * 0.7)
      .attr('text-anchor', 'middle')
      .style('font-size', `${Math.max(12, width * 0.018)}px`)
      .style('font-weight', '700')
      .style('fill', genderColor)
      .text('身長 (cm)');

    g.append('text')
      .attr('transform', 'rotate(90)')
      .attr('x', innerHeight / 2)
      .attr('y', -innerWidth - margin.right * 0.75)
      .attr('text-anchor', 'middle')
      .style('font-size', `${Math.max(12, width * 0.018)}px`)
      .style('font-weight', '700')
      .style('fill', genderColor)
      .text('体重 (kg)');

    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1.5);

    const step = (preset.xRange[1] - preset.xRange[0]) / 100;
    const ages = d3.range(preset.xRange[0], preset.xRange[1] + step, step);
    
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
        .attr('stroke', sds === 0 ? genderColor : genderLightColor)
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
          .style('fill', '#374151')
          .style('stroke', '#ffffff')
          .style('stroke-width', '2px')
          .style('paint-order', 'stroke fill')
          .text(sds === 0 ? '平均' : `${sds > 0 ? '+' : ''}${sds.toFixed(1)}SD`);
      }
    });

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
        .attr('stroke', sds === 0 ? genderColor : genderLightColor)
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
          .style('fill', '#374151')
          .style('stroke', '#ffffff')
          .style('stroke-width', '2px')
          .style('paint-order', 'stroke fill')
          .text(sds === 0 ? '平均' : `${sds > 0 ? '+' : ''}${sds.toFixed(1)}SD`);
      }
    });

    heightPoints.forEach(d => {
      if (d.age < preset.xRange[0] || d.age > preset.xRange[1]) return;
      
      const isExtremeZ = Math.abs(d.zScore || 0) > 5;
      const isOffChart = d.value < preset.yHeightRange[0] || d.value > preset.yHeightRange[1];
      const isOutlier = isExtremeZ || isOffChart;
      
      // Clamp value for visual plotting if it's off chart
      const plottedValue = Math.max(preset.yHeightRange[0], Math.min(preset.yHeightRange[1], d.value));
      
      const marker = isOutlier ? '▲' : '●';
      const color = isOutlier ? '#f97316' : (d.isCorrected ? '#10b981' : genderColor);
      
      g.append('text')
        .attr('x', xScale(d.age))
        .attr('y', yScaleHeight(plottedValue))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', isOutlier 
          ? Math.max(22, width * 0.035) * (isSafari ? 1.5 : 1) 
          : Math.max(18, width * 0.028) * (isSafari ? 1.5 : 1))
        .style('fill', color)
        .style('stroke', isOutlier ? 'none' : 'white')
        .style('stroke-width', '1px')
        .style('font-weight', 'bold')
        .text(marker);
    });

    weightPoints.forEach(d => {
      if (d.age < preset.xRange[0] || d.age > preset.xRange[1]) return;
      
      const isExtremeZ = Math.abs(d.zScore || 0) > 5;
      const isOffChart = d.value < preset.yWeightRange[0] || d.value > preset.yWeightRange[1];
      const isOutlier = isExtremeZ || isOffChart;

      // Clamp value for visual plotting if it's off chart
      const plottedValue = Math.max(preset.yWeightRange[0], Math.min(preset.yWeightRange[1], d.value));

      const marker = isOutlier ? '▲' : '●';
      const color = isOutlier ? '#f97316' : (d.isCorrected ? '#10b981' : genderColor);
      
      g.append('text')
        .attr('x', xScale(d.age))
        .attr('y', yScaleWeight(plottedValue))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', isOutlier 
          ? Math.max(22, width * 0.035) * (isSafari ? 1.5 : 1) 
          : Math.max(18, width * 0.028) * (isSafari ? 1.5 : 1))
        .style('fill', color)
        .style('stroke', isOutlier ? 'none' : 'white')
        .style('stroke-width', '1px')
        .style('font-weight', 'bold')
        .text(marker);
    });
  }, [preset, heightLmsTable, weightLmsTable, heightPoints, weightPoints, xScale, yScaleHeight, yScaleWeight, innerHeight, innerWidth, margin, width, height, genderColor, genderLightColor, isSafari]);

  return (
    <div id="printable-chart-area-wrapper" className="bg-white p-3 md:p-6 rounded-xl shadow-md border border-gray-100 print:shadow-none print:border-none print:p-0 print:m-0 print:overflow-visible">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 print:hidden">
        <h3 className="text-lg md:text-xl font-bold text-gray-900">
          {sex} 成長曲線 ({preset.name})
        </h3>
        <div className="flex gap-2">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="flex items-center gap-2"
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
            className="flex items-center gap-2"
            aria-label="成長曲線をPNG画像としてダウンロードする"
            aria-busy={isExporting}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{isExporting ? '出力中...' : '画像出力'}</span>
          </Button>
        </div>
      </div>

      <div ref={chartAreaRef} id="printable-chart-area" className="bg-white p-2">
        <div ref={containerRef} className="relative w-full bg-gray-50 rounded-lg p-1 md:p-4 print:bg-white print:p-0 print:break-inside-avoid">
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
        
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-[10px] md:text-xs text-gray-600 border-t pt-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className={`w-3 md:w-4 h-0.5 ${sex === '男子' ? 'bg-blue-600' : 'bg-pink-600'}`}></span>
            <span>身長 中央値 (0SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 md:w-4 h-0.5 ${sex === '男子' ? 'bg-blue-600' : 'bg-pink-600'}`}></span>
            <span>体重 中央値 (0SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 md:w-4 h-0.5 bg-gray-200"></span>
            <span>基準線 (±SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 md:w-4 h-0.5 bg-gray-200 border-t border-dashed border-gray-400"></span>
            <span>身長 -2.5/-3.0SD (点線)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`${sex === '男子' ? 'text-blue-600' : 'text-pink-600'} font-bold`}>●</span>
            <span>通常測定点 (身長/体重)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-500 font-bold">▲</span>
            <span>異常値 (±5SD超/範囲外)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">●</span>
            <span>修正年齢</span>
          </div>
        </div>

        {/* Screen Reader Alternative: Data Tables list */}
        <details className="mt-6 border border-gray-200 rounded-lg p-3 bg-gray-50/50 print:hidden transition-all">
          <summary className="cursor-pointer font-semibold text-gray-700 text-sm hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1 inline-block select-none">
            測定データをテーブル形式で表示（代替テキスト・音声読み上げ用）
          </summary>
          <div className="mt-4 overflow-x-auto rounded border border-gray-200 bg-white" role="region" aria-label="測定データ代替テーブル">
            <table className="min-w-full border-collapse text-xs">
              <caption className="sr-only">測定点（年齢、身長、体重）の一覧</caption>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <th className="border-r border-gray-200 p-2 text-center" scope="col">年齢</th>
                  <th className="border-r border-gray-200 p-2 text-center" scope="col">身長 (cm)</th>
                  <th className="p-2 text-center" scope="col">体重 (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {heightPoints.length === 0 && weightPoints.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-400">測定データが登録されていません。</td>
                  </tr>
                ) : (
                  <>
                    {heightPoints.map((point, idx) => {
                      const matchingWeight = weightPoints.find(w => Math.abs(w.age - point.age) < 0.001 && w.isCorrected === point.isCorrected);
                      return (
                        <tr key={`h-${idx}`} className="hover:bg-gray-50 transition-colors">
                          <td className="border-r border-gray-200 p-2 font-medium text-center">
                            {point.age.toFixed(4)}歳
                            {point.isCorrected && <span className="ml-1 text-[9px] text-emerald-600 bg-emerald-50 px-1 rounded">修正年齢</span>}
                          </td>
                          <td className="border-r border-gray-200 p-2 text-center">{point.value !== null ? `${point.value.toFixed(1)} cm` : '-'}</td>
                          <td className="p-2 text-center">{matchingWeight ? `${matchingWeight.value.toFixed(2)} kg` : '-'}</td>
                        </tr>
                      );
                    })}
                    {weightPoints.filter(w => !heightPoints.some(h => Math.abs(h.age - w.age) < 0.001 && h.isCorrected === w.isCorrected)).map((point, idx) => (
                      <tr key={`w-${idx}`} className="hover:bg-gray-50 transition-colors">
                        <td className="border-r border-gray-200 p-2 font-medium text-center">
                          {point.age.toFixed(4)}歳
                          {point.isCorrected && <span className="ml-1 text-[9px] text-emerald-600 bg-emerald-50 px-1 rounded">修正年齢</span>}
                        </td>
                        <td className="border-r border-gray-200 p-2 text-center">-</td>
                        <td className="p-2 text-center">{point.value.toFixed(2)} kg</td>
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
