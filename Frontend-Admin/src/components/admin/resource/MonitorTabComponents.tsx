'use client';

import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { MetricTrendCardProps, ResourceTrendSectionProps, TrendDatum, ZoomDomain } from './MonitorTabTypes';
import type { MonitorRange } from './MonitorTabTypes';
import {
  formatChartTime,
  formatChartDateTime,
  chartTooltipStyle,
  TREND_SYNC_ID,
  monitorRangeOptions,
} from './MonitorTabFormatters';

const MonitorRangeSwitch: React.FC<{
  value: MonitorRange;
  onChange: (range: MonitorRange) => void;
}> = ({ value, onChange }) => {
  return (
    <div className="inline-flex rounded-lg bg-white/5 border border-white/10 p-1">
      {monitorRangeOptions.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            value === item.value
              ? 'bg-blue-500 text-white'
              : 'text-text-muted hover:text-text-primary hover:bg-white/10'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

const MetricTrendCard: React.FC<MetricTrendCardProps> = ({
  title,
  data,
  dataKey,
  lineColor,
  legendName,
  syncId,
  zoomDomain,
  zoomStart,
  zoomEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick,
}) => {
  const xDomain: [number | 'dataMin', number | 'dataMax'] = zoomDomain
    ? [zoomDomain.start, zoomDomain.end]
    : ['dataMin', 'dataMax'];

  const selectingStart =
    zoomStart !== null && zoomEnd !== null ? Math.min(zoomStart, zoomEnd) : null;
  const selectingEnd =
    zoomStart !== null && zoomEnd !== null ? Math.max(zoomStart, zoomEnd) : null;

  return (
    <div className="card-primary p-6 min-w-0">
      <h4 className="text-lg font-semibold text-text-primary mb-4">{title}</h4>
      {data.length > 1 ? (
        <div onDoubleClick={onDoubleClick} className="w-full">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data}
              syncId={syncId}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="timestampMs"
                type="number"
                scale="time"
                domain={xDomain}
                stroke="#9ca3af"
                minTickGap={24}
                tickFormatter={formatChartTime}
              />
              <YAxis
                stroke="#9ca3af"
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => formatChartDateTime(Number(label))}
                cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
                formatter={(value: number | undefined, name: string | undefined) => [`${Number(value ?? 0).toFixed(2)}%`, name ?? '']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={lineColor}
                strokeWidth={2}
                name={legendName}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              {selectingStart !== null && selectingEnd !== null && (
                <ReferenceArea
                  x1={selectingStart}
                  x2={selectingEnd}
                  fill={lineColor}
                  fillOpacity={0.18}
                  strokeOpacity={0.2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-sm text-text-muted">
          实时数据接入中，曲线将在当前范围内持续刷新
        </div>
      )}
    </div>
  );
};

const ResourceTrendSection: React.FC<ResourceTrendSectionProps> = ({
  trendPoints,
  monitorRange,
  onMonitorRangeChange,
}) => {
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [zoomDomain, setZoomDomain] = useState<ZoomDomain>(null);

  const trendData = useMemo<TrendDatum[]>(() => {
    return trendPoints
      .map((point) => {
        const timestampMs = new Date(point.timestamp).getTime();
        if (!Number.isFinite(timestampMs)) {
          return null;
        }
        return {
          ...point,
          timestampMs,
        };
      })
      .filter((point): point is TrendDatum => Boolean(point))
      .sort((a, b) => a.timestampMs - b.timestampMs);
  }, [trendPoints]);

  const beginZoom = (event: { activeLabel?: unknown }) => {
    const activeLabel = event.activeLabel;
    if (typeof activeLabel !== 'number' || !Number.isFinite(activeLabel)) {
      return;
    }
    setZoomStart(activeLabel);
    setZoomEnd(activeLabel);
  };

  const updateZoom = (event: { activeLabel?: unknown }) => {
    if (zoomStart === null) {
      return;
    }
    const activeLabel = event?.activeLabel;
    if (typeof activeLabel !== 'number' || !Number.isFinite(activeLabel)) {
      return;
    }
    setZoomEnd(activeLabel);
  };

  const applyZoom = () => {
    if (zoomStart === null || zoomEnd === null) {
      setZoomStart(null);
      setZoomEnd(null);
      return;
    }
    const start = Math.min(zoomStart, zoomEnd);
    const end = Math.max(zoomStart, zoomEnd);
    if (end - start < 2000) {
      setZoomStart(null);
      setZoomEnd(null);
      return;
    }
    setZoomDomain({ start, end });
    setZoomStart(null);
    setZoomEnd(null);
  };

  const resetZoom = () => {
    setZoomDomain(null);
    setZoomStart(null);
    setZoomEnd(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-text-primary">CPU / 内存趋势</h4>
          <p className="text-xs text-text-muted mt-1">支持联动悬浮、拖拽缩放、双击重置缩放区间</p>
        </div>
        <MonitorRangeSwitch value={monitorRange} onChange={onMonitorRangeChange} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MetricTrendCard
          title="CPU 使用率趋势"
          data={trendData}
          dataKey="cpu_usage"
          lineColor="#3b82f6"
          legendName="CPU使用率 (%)"
          syncId={TREND_SYNC_ID}
          zoomDomain={zoomDomain}
          zoomStart={zoomStart}
          zoomEnd={zoomEnd}
          onMouseDown={beginZoom}
          onMouseMove={updateZoom}
          onMouseUp={applyZoom}
          onDoubleClick={resetZoom}
        />
        <MetricTrendCard
          title="内存使用率趋势"
          data={trendData}
          dataKey="memory_usage"
          lineColor="#10b981"
          legendName="内存使用率 (%)"
          syncId={TREND_SYNC_ID}
          zoomDomain={zoomDomain}
          zoomStart={zoomStart}
          zoomEnd={zoomEnd}
          onMouseDown={beginZoom}
          onMouseMove={updateZoom}
          onMouseUp={applyZoom}
          onDoubleClick={resetZoom}
        />
      </div>
    </section>
  );
};

export { MonitorRangeSwitch, MetricTrendCard, ResourceTrendSection };
