'use client';

import React from 'react';

import SystemConfigTab from '@/components/admin/resource/SystemConfigTab';
import { useAdminSystemConfig } from '@/components/admin/resource/useAdminSystemConfig';

export default function SystemConfigPanel() {
  const systemConfig = useAdminSystemConfig('system', 0);

  return (
    <SystemConfigTab
      systemConfig={systemConfig.systemConfig}
      setSystemConfig={systemConfig.setSystemConfig}
      updateSystemConfig={systemConfig.updateSystemConfig}
    />
  );
}
