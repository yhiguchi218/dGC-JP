import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { format } from 'date-fns';
import { toPng } from 'html-to-image';
import { Printer, Download } from 'lucide-react';
import { getChartThemeColors } from '../lib/chart-utils';
import { getWeightForHeightSdLine } from '../lib/achondroplasia-weight-for-height';
import { CLINICAL_LIMITS, DEFAULT_GROWTH_REFERENCE, GROWTH_REFERENCE_LABELS, type GrowthReference } from '../lib/constants';
import type { WeightForHeightStatus } from '../lib/measurement-evaluation';
import { useTheme } from '../context/ThemeContext';
import { Button } from '@/components/ui/button';

/**
 * Fixed axes of the weight-for-height chart (not derived from the entered data, and not shared with the age-axis
 * presets). All SD lines (-3 to +2) of both sexes lie within weight 1.86-85.77 kg over their valid heights
 * (boys 50-140 cm, girls 50-134 cm); the axes leave room around them for the end-of-line labels and for
 * measurements just outside the valid height range.
 */
export const WEIGHT_FOR_HEIGHT_CHART_AXES = {
  xRange: [40, 150] as [number, number],
  yRange: [0, 90] as [number, number],
  xTickStep: 10,
  yTickStep: 10,
} as const;

const SD_LEVELS = [-3, -2.5, -2, -1, 0, 1, 2] as const;

export interface WeightForHeightChartPoint {
  id: string;
  date: Date;
  /** Height (cm) and weight (kg) of the same measurement row. */
  height: number;
  weight: number;
  sds: number | undefined;
  status: WeightForHeightStatus;
}

interface WeightForHeightChartProps {
  growthReference?: GrowthReference;
  sex: '男子' | '女子';
  childId: string;
  /** Measurements with both height and weight, in measurement-date order. */
  points: WeightForHeightChartPoint[];
}

export function describeWeightForHeightStatus(point: Pick<WeightForHeightChartPoint, 'sds' | 'status'>): string {
  if (point.status === 'ok' && point.sds !== undefined) return `${point.sds.toFixed(2)}SD`;
  if (point.status === 'out-of-range') return '基準の身長範囲外のためSDS算出不可';
  return 'SDS算出不可';
}

const isInsideAxes = (p: { height: number; weight: number }) =>
  p.height >= WEIGHT_FOR_HEIGHT_CHART_AXES.xRange[0] && p.height <= WEIGHT_FOR_HEIGHT_CHART_AXES.xRange[1]
  && p.weight >= WEIGHT_FOR_HEIGHT_CHART_AXES.yRange[0] && p.weight <= WEIGHT_FOR_HEIGHT_CHART_AXES.yRange[1];

const WeightForHeightChart: React.FC<WeightForHeightChartProps> = ({
  growthReference = DEFAULT_GROWTH_REFERENCE,
  sex,
  childId,
  points,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 720 });
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { theme } = useTheme();
  const referenceLabel = GROWTH_REFERENCE_LABELS[growthReference];
  const sexKey: 'male' | 'female' = sex === '男子' ? 'male' : 'female';
  const offChartCount = points.filter(p => !isInsideAxes(p)).length;

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
    window.focus();
    window.print();
  };

  const handleExportPng = async () => {
    if (!chartAreaRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(chartAreaRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: node => !(node instanceof HTMLElement && node.dataset.exportExclude === 'true'),
      });
      const link = document.createElement('a');
      link.download = `身長別体重-${referenceLabel}-${sex}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          const isPrintActive = window.matchMedia('print').matches || isPrinting;
          const targetWidth = isPrintActive ? Math.min(width, 480) : width;
          setDimensions({ width: targetWidth, height: isPrintActive ? targetWidth * 0.85 : width * 0.9 });
        }
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isPrinting]);

  const { width, height } = dimensions;
  const effectiveIsDark = isPrinting ? false : theme === 'dark';
  const colors = useMemo(() => getChartThemeColors(effectiveIsDark, sex), [effectiveIsDark, sex]);

  const margin = useMemo(() => ({
    top: height * 0.03,
    right: width * 0.04,
    bottom: height * 0.13,
    left: width * 0.11,
  }), [width, height]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  useEffect(() => {
    if (!svgRef.current || innerWidth <= 0 || innerHeight <= 0) return;
    const { xRange, yRange, xTickStep, yTickStep } = WEIGHT_FOR_HEIGHT_CHART_AXES;
    const xScale = d3.scaleLinear().domain(xRange).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain(yRange).range([innerHeight, 0]);
    const xTicks = d3.range(xRange[0], xRange[1] + xTickStep, xTickStep);
    const yTicks = d3.range(yRange[0], yRange[1] + yTickStep, yTickStep);
    const fontSize = Math.max(10, width * 0.015);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('rect').attr('width', innerWidth).attr('height', innerHeight).attr('fill', colors.background);

    g.append('g').attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xTicks).tickSize(-innerHeight).tickFormat(() => ''))
      .style('stroke', colors.gridLine).style('stroke-dasharray', '2,2');
    g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickValues(yTicks).tickSize(-innerWidth).tickFormat(() => ''))
      .style('stroke', colors.gridLine).style('stroke-dasharray', '2,2');

    const xAxis = g.append('g').attr('data-testid', 'wfh-x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xTicks));
    xAxis.selectAll('text').style('font-size', `${fontSize}px`).style('font-family', 'var(--font-mono)').style('fill', colors.axisText);

    const yAxis = g.append('g').attr('data-testid', 'wfh-y-axis')
      .call(d3.axisLeft(yScale).tickValues(yTicks))
      .style('color', colors.axisTitle);
    yAxis.selectAll('text').style('font-size', `${fontSize}px`).style('font-family', 'var(--font-mono)').style('fill', colors.axisTitle);

    g.append('text')
      .attr('x', innerWidth / 2).attr('y', innerHeight + margin.bottom * 0.78)
      .attr('text-anchor', 'middle')
      .style('font-size', `${Math.max(12, width * 0.018)}px`).style('font-weight', '600').style('fill', colors.axisText)
      .text('身長・体長 (cm)');
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2).attr('y', -margin.left * 0.75)
      .attr('text-anchor', 'middle')
      .style('font-size', `${Math.max(12, width * 0.018)}px`).style('font-weight', '700').style('fill', colors.axisTitle)
      .text('体重 (kg)');

    g.append('rect').attr('width', innerWidth).attr('height', innerHeight)
      .attr('fill', 'none').attr('stroke', colors.border).attr('stroke-width', 1.5);

    // Background lines: straight segments between the integer-cm rows, the same linear interpolation as the SDS.
    SD_LEVELS.forEach(sds => {
      const lineData = getWeightForHeightSdLine(sexKey, sds);
      const line = d3.line<{ heightCm: number; value: number }>()
        .x(d => xScale(d.heightCm)).y(d => yScale(d.value)).curve(d3.curveLinear);
      const isExtra = sds === -2.5 || sds === -3;
      g.append('path')
        .datum(lineData)
        .attr('data-testid', 'wfh-sd-line').attr('data-sds', String(sds))
        .attr('fill', 'none')
        .attr('stroke', sds === 0 ? colors.genderColor : colors.genderLightColor)
        .attr('stroke-width', sds === 0 ? Math.max(1.5, width * 0.003) : Math.max(0.8, width * 0.0015))
        .attr('stroke-opacity', sds === 0 ? 1 : 0.85)
        .attr('stroke-dasharray', isExtra ? '4,4' : null)
        .attr('d', line);

      const lastPoint = lineData[lineData.length - 1];
      if (lastPoint && lastPoint.value >= yRange[0] && lastPoint.value <= yRange[1]) {
        g.append('text')
          .attr('data-testid', 'wfh-sd-label')
          .attr('x', xScale(lastPoint.heightCm) - 4)
          .attr('y', yScale(lastPoint.value) + 2)
          .attr('dy', '0.85em')
          .attr('text-anchor', 'end')
          .style('font-size', `${Math.max(8.5, width * 0.012)}px`).style('font-weight', '600')
          .style('fill', colors.labelText).style('stroke', colors.labelBgStroke)
          .style('stroke-width', '2px').style('paint-order', 'stroke fill')
          .text(sds === 0 ? '平均' : `${sds > 0 ? '+' : ''}${sds.toFixed(1)}SD`);
      }
    });

    // Measured points are joined in measurement-date order. A segment is drawn only between consecutive
    // measurements that are both inside the axes; nothing is pinned to an edge or invented for a missing point.
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (!isInsideAxes(a) || !isInsideAxes(b)) continue;
      g.append('line')
        .attr('data-testid', 'wfh-point-connector')
        .attr('x1', xScale(a.height)).attr('y1', yScale(a.weight))
        .attr('x2', xScale(b.height)).attr('y2', yScale(b.weight))
        .attr('stroke', colors.genderColor).attr('stroke-width', Math.max(1, width * 0.002)).attr('stroke-opacity', 0.6);
    }

    const markerSize = Math.max(4, width * 0.008);
    points.forEach(p => {
      if (!isInsideAxes(p)) return;
      const cx = xScale(p.height);
      const cy = yScale(p.weight);
      const isOutlier = p.status !== 'ok' || (p.sds !== undefined && Math.abs(p.sds) > CLINICAL_LIMITS.SD_OUTLIER_THRESHOLD);
      const marker = g.append('g').attr('data-testid', 'wfh-point').attr('data-point-id', p.id);
      marker.append('title').text(
        `${format(p.date, 'yyyy/MM/dd')} 身長 ${p.height}cm 体重 ${p.weight}kg 身長別体重SDS: ${describeWeightForHeightStatus(p)}`
      );
      if (isOutlier) {
        const r = markerSize * 1.4;
        marker.append('polygon')
          .attr('points', `${cx},${cy - r} ${cx - r},${cy + r * 0.8} ${cx + r},${cy + r * 0.8}`)
          .attr('fill', colors.outlierColor).attr('stroke', colors.background).attr('stroke-width', 1);
      } else {
        marker.append('circle')
          .attr('cx', cx).attr('cy', cy).attr('r', markerSize)
          .attr('fill', colors.genderColor).attr('stroke', colors.background).attr('stroke-width', 1);
      }
    });
  }, [points, sexKey, innerWidth, innerHeight, margin, width, colors]);

  return (
    <div id="printable-chart-area-wrapper" className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-xl shadow-md border border-gray-100 dark:border-zinc-800 print:shadow-none print:border-none print:p-0 print:m-0 print:overflow-visible transition-colors">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 print:hidden">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-zinc-100">
          {sex} 身長別体重 {referenceLabel}
        </h3>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-2 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
            aria-label="身長別体重のグラフを印刷する"
            title="Ctrl+P でも印刷できます"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>印刷</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPng}
            disabled={isExporting}
            className="flex items-center gap-2 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
            aria-label="身長別体重のグラフをPNG画像としてダウンロードする"
            aria-busy={isExporting}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{isExporting ? '出力中...' : '画像出力'}</span>
          </Button>
        </div>
      </div>

      <div ref={chartAreaRef} id="printable-chart-area" className="bg-white dark:bg-zinc-900 p-2 print:bg-white print:p-0">
        <p className="mb-2 text-xs font-semibold text-gray-800 dark:text-zinc-200 print:text-[8pt] print:text-gray-900" data-testid="wfh-chart-caption">
          成長基準: {referenceLabel}　グラフ: 身長別体重　{sex}　対象児ID: {childId || '-'}
        </p>
        <div ref={containerRef} className="relative w-full bg-gray-50 dark:bg-zinc-950/70 rounded-lg p-1 md:p-4 print:bg-white print:p-0 print:break-inside-avoid transition-colors">
          <div id="chart-description" className="sr-only">
            <h4>身長別体重グラフの詳細</h4>
            <p>このグラフは、軟骨無形成症の成長基準（{referenceLabel}）の身長別体重を表示しています。横軸は身長・体長（cm）、縦軸は体重（kg）です。</p>
            <p>青色（男子）またはピンク色（女子）の実線は平均（0SD）、他の線は補足表の身長ごとの平均とSDから算出したSD線（−3.0・−2.5SDは点線）で、身長ごとの点を直線で結んでいます。論文のパーセンタイル曲線の再現ではありません。</p>
            <p>測定点は測定日順に線で結んでいます。基準の身長範囲外の測定点は三角記号で示し、SDSは算出しません。</p>
            <p>測定データ点数: {points.length} 件（グラフの表示範囲外: {offChartCount} 件）。</p>
          </div>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto block"
            role="img"
            aria-label={`${sex}の身長別体重グラフ（${referenceLabel}）。SD線、および入力された測定データのプロットを表示しています。`}
            aria-describedby="chart-description"
            data-testid="wfh-chart-svg"
          />
        </div>
        {offChartCount > 0 && (
          <p className="mt-2 text-xs text-gray-700 dark:text-zinc-300 print:text-[8pt]" data-testid="wfh-off-chart-note">
            {offChartCount}件の測定点は、このグラフの表示範囲（身長{WEIGHT_FOR_HEIGHT_CHART_AXES.xRange[0]}〜{WEIGHT_FOR_HEIGHT_CHART_AXES.xRange[1]}cm、体重{WEIGHT_FOR_HEIGHT_CHART_AXES.yRange[0]}〜{WEIGHT_FOR_HEIGHT_CHART_AXES.yRange[1]}kg）外のため描画していません（端への固定表示はしていません）。
          </p>
        )}

        <div data-testid="chart-legend" data-export-exclude="true" className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-[10px] md:text-xs text-gray-600 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-800 pt-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className={`w-3 md:w-4 h-0.5 ${sex === '男子' ? 'bg-blue-600 dark:bg-blue-500' : 'bg-pink-600 dark:bg-pink-500'}`}></span>
            <span>体重 平均 (0SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 md:w-4 h-0.5 bg-gray-300 dark:bg-zinc-600"></span>
            <span>基準線 (±SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 md:w-4 h-0.5 bg-gray-300 dark:bg-zinc-600 border-t border-dashed border-gray-400 dark:border-zinc-500"></span>
            <span>-2.5/-3.0SD (点線)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`${sex === '男子' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'} font-bold`}>●</span>
            <span>測定点（測定日順に線で連結）</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-500 dark:text-orange-400 font-bold">▲</span>
            <span>基準の身長範囲外 / ±5SD超</span>
          </div>
        </div>

        <details className="mt-6 border border-gray-200 dark:border-zinc-800 rounded-lg p-3 bg-gray-50/50 dark:bg-zinc-950/40 print:hidden transition-all">
          <summary className="cursor-pointer font-semibold text-gray-700 dark:text-zinc-300 text-sm hover:text-gray-950 dark:hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1 inline-block select-none">
            測定データをテーブル形式で表示（代替テキスト・音声読み上げ用）
          </summary>
          <div className="mt-4 overflow-x-auto rounded border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" role="region" aria-label="身長別体重の測定データ代替テーブル">
            <table className="min-w-full border-collapse text-xs" data-testid="wfh-data-table">
              <caption className="sr-only">測定点（測定日、身長、体重、身長別体重SDS）の一覧</caption>
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300">
                  <th className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center" scope="col">測定日</th>
                  <th className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center" scope="col">身長 (cm)</th>
                  <th className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center" scope="col">体重 (kg)</th>
                  <th className="p-2 text-center" scope="col">身長別体重SDS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {points.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-400 dark:text-zinc-500">身長と体重がそろった測定データがありません。</td>
                  </tr>
                ) : points.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="border-r border-gray-200 dark:border-zinc-700 p-2 font-medium text-center text-gray-800 dark:text-zinc-200">{format(p.date, 'yyyy/MM/dd')}</td>
                    <td className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center text-gray-700 dark:text-zinc-300">{p.height}</td>
                    <td className="border-r border-gray-200 dark:border-zinc-700 p-2 text-center text-gray-700 dark:text-zinc-300">{p.weight}</td>
                    <td className="p-2 text-center text-gray-700 dark:text-zinc-300">{describeWeightForHeightStatus(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
};

export default WeightForHeightChart;
