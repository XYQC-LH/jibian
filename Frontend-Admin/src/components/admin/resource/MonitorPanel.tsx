'use client';

import React from 'react';

import MonitorTab from '@/components/admin/resource/MonitorTab';
import { useAdminMonitor } from '@/components/admin/resource/useAdminMonitor';

export default function MonitorPanel() {
  const monitor = useAdminMonitor('monitor');

  return (
    <MonitorTab
      systemMonitoringData={monitor.systemMonitoringData}
      trendPoints={monitor.monitorTrendPoints}
      monitorLoaded={monitor.monitorLoaded}
      monitorRange={monitor.monitorRange}
      onMonitorRangeChange={monitor.setMonitorRange}
      onUpdateContainerServiceResources={monitor.updateContainerServiceResources}
    />
  );
}
