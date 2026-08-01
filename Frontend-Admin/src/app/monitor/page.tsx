'use client';

import React from 'react';

import MonitorPanel from '@/components/admin/resource/MonitorPanel';
import AdminModulePageShell from '@/components/admin/AdminModulePageShell';

const ACTIVE_MODULE_HREF = '/monitor';

export default function AdminMonitorPage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="资源监控"
    >
      <div className="min-h-screen bg-background p-6 text-text-primary">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-8">
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-text-primary">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 shadow-lg shadow-teal-500/20">
                <span className="text-lg text-white">监</span>
              </div>
              资源监控
            </h1>
            <p className="text-text-muted">主机指标 · 容器状态 · 趋势分析</p>
          </div>

          <MonitorPanel />
        </div>
      </div>
    </AdminModulePageShell>
  );
}
