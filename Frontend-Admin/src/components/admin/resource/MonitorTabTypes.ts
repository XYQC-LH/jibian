import type { MonitorTrendPoint, MonitorRange, SystemMonitoringData } from './types';

export type MonitorTabProps = {
  systemMonitoringData: SystemMonitoringData | null;
  trendPoints: MonitorTrendPoint[];
  monitorLoaded: boolean;
  monitorRange: MonitorRange;
  onMonitorRangeChange: (range: MonitorRange) => void;
  onUpdateContainerServiceResources: (
    service: string,
    memoryLimitMb: number,
    workerConcurrency: number | null
  ) => Promise<void>;
};

export type TrendDatum = MonitorTrendPoint & {
  timestampMs: number;
};

export type ZoomDomain = {
  start: number;
  end: number;
} | null;

export type MetricTrendCardProps = {
  title: string;
  data: TrendDatum[];
  dataKey: 'cpu_usage' | 'memory_usage';
  lineColor: string;
  legendName: string;
  syncId: string;
  zoomDomain: ZoomDomain;
  zoomStart: number | null;
  zoomEnd: number | null;
  onMouseDown: (event: { activeLabel?: unknown }) => void;
  onMouseMove: (event: { activeLabel?: unknown }) => void;
  onMouseUp: () => void;
  onDoubleClick: () => void;
};

export type ResourceTrendSectionProps = {
  trendPoints: MonitorTrendPoint[];
  monitorRange: MonitorRange;
  onMonitorRangeChange: (range: MonitorRange) => void;
};

export type { MonitorRange };
