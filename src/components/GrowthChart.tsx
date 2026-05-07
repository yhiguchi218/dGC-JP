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
    id: '0-24m',
    name: '0-24ヶ月',
    xRange: [0, 2],
    yHeightRange: [30, 100],
    yWeightRange: [0, 70], // Aligned with height range (100-30=70)
  },
  {
    id: '0-6y',
    name: '0-6歳',
    xRange: [0, 6],
    yHeightRange: [30, 130],
    yWeightRange: [0, 100], // Aligned with height range (130-30=100)
  },
  {
    id: '0-18y',
    name: '0-18歳',
    xRange: [0, 18],
    yHeightRange: [30, 200],
    yWeightRange: [0, 170], // Aligned with height range (200-30=170), allows plotting up to 150kg
  }
];

interface GrowthChartProps {
  sex: 'male' | 'female';
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
      
      // Create a link to download as PNG (TIFF is not natively supported by browsers for easy export without heavy libs)
      // Note: User specifically asked for TIFF, but since canvas-to-tiff failed to install, 
      // we provide PNG as a high-quality alternative and explain.
      const link = document.createElement('a');
      link.download = `growth-chart-${sex}-${preset.id}.png`;
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
          const isPrinting = window.matchMedia('print').matches;
          setDimensions({
            width,
            height: isPrinting ? width * 1.2 : width * 1.4
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const { width, height } = dimensions;

  const genderColor = sex === 'male' ? '#2563eb' : '#dc2626';
  const genderLightColor = sex === 'male' ? '#bfdbfe' : '#fecaca';

  const margin = { 
    top: height * 0.03, 
    right: width * 0.12, 
    bottom: height * 0.05, 
    left: width * 0.1 
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

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

    const xTicks = d3.range(preset.xRange[0], preset.xRange[1] + (preset.id === '0-24m' ? 0.25 : 1), preset.id === '0-24m' ? 0.25 : 1);
    
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
          if (preset.id === '0-24m') {
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

    const weightAxis = g.append('g')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(d3.axisRight(yScaleWeight)
        .tickValues(d3.range(preset.yWeightRange[0], preset.yWeightRange[1] + 10, 10).filter(v => v <= 90))
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
      .text(preset.id === '0-24m' ? '月齢 (ヶ月)' : '年齢 (歳)');

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
        .attr('stroke-opacity', sds === 0 ? 1 : 0.7)
        .attr('stroke-dasharray', isExtra ? '4,4' : null)
        .attr('d', line);
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
        .attr('stroke-opacity', sds === 0 ? 1 : 0.7)
        .attr('d', line);
    });

    heightPoints.forEach(d => {
      if (d.age < preset.xRange[0] || d.age > preset.xRange[1]) return;
      if (d.value < preset.yHeightRange[0] || d.value > preset.yHeightRange[1]) return;
      const isOutlier = Math.abs(d.zScore || 0) > 5;
      const marker = isOutlier ? '△' : '●';
      const color = isOutlier ? '#ef4444' : (d.isCorrected ? '#10b981' : genderColor);
      g.append('text')
        .attr('x', xScale(d.age))
        .attr('y', yScaleHeight(d.value))
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .style('font-size', isOutlier ? `${Math.max(18, width * 0.028)}px` : `${Math.max(12, width * 0.02)}px`)
        .style('fill', color)
        .style('stroke', 'white')
        .style('stroke-width', '1px')
        .style('font-weight', 'bold')
        .text(marker);
    });

    weightPoints.forEach(d => {
      if (d.age < preset.xRange[0] || d.age > preset.xRange[1]) return;
      if (d.value < preset.yWeightRange[0] || d.value > preset.yWeightRange[1]) return;
      const isOutlier = Math.abs(d.zScore || 0) > 5;
      const marker = isOutlier ? '△' : '●';
      const color = isOutlier ? '#ef4444' : (d.isCorrected ? '#10b981' : genderColor);
      g.append('text')
        .attr('x', xScale(d.age))
        .attr('y', yScaleWeight(d.value))
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .style('font-size', isOutlier ? `${Math.max(18, width * 0.028)}px` : `${Math.max(12, width * 0.02)}px`)
        .style('fill', color)
        .style('stroke', 'white')
        .style('stroke-width', '1px')
        .style('font-weight', 'bold')
        .text(marker);
    });
  }, [preset, heightLmsTable, weightLmsTable, heightPoints, weightPoints, xScale, yScaleHeight, yScaleWeight, innerHeight, innerWidth, margin, width, height]);

  return (
    <div id="printable-chart-area-wrapper" className="bg-white p-3 md:p-6 rounded-xl shadow-md border border-gray-100 overflow-hidden print:shadow-none print:border-none print:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 print:hidden">
        <h3 className="text-lg md:text-xl font-bold text-gray-900">
          {sex === 'male' ? '男子' : '女子'} 成長曲線 ({preset.name})
        </h3>
        <div className="flex gap-2">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            印刷
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={handleExportTIFF}
            disabled={isExporting}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isExporting ? '出力中...' : '画像出力'}
          </Button>
        </div>
      </div>

      <h3 className="hidden print:block text-lg font-bold mb-2 text-center text-gray-900 border-b pb-2">
        {sex === 'male' ? '男子' : '女子'} 成長曲線 ({preset.name})
      </h3>

      <div ref={chartAreaRef} id="printable-chart-area" className="bg-white p-2">
        <div ref={containerRef} className="relative w-full bg-gray-50 rounded-lg p-1 md:p-4 print:bg-white print:p-0">
          <svg ref={svgRef} width={width} height={height} className="w-full h-auto" />
        </div>
        
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-[10px] md:text-xs text-gray-600 border-t pt-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className={`w-3 md:w-4 h-0.5 ${sex === 'male' ? 'bg-blue-600' : 'bg-red-600'}`}></span>
            <span>身長 中央値 (0SD)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 md:w-4 h-0.5 ${sex === 'male' ? 'bg-blue-600' : 'bg-red-600'}`}></span>
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
            <span className={`${sex === 'male' ? 'text-blue-600' : 'text-red-600'} font-bold`}>●</span>
            <span>身長 測定点</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`${sex === 'male' ? 'text-blue-600' : 'text-red-600'} font-bold`}>●</span>
            <span>体重 測定点</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">●</span>
            <span>修正年齢</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrowthChart;
