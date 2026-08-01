'use client';

import React from 'react';

import ModelDispatchTab from '@/components/admin/resource/ModelDispatchTab';
import AdminModulePageShell from '@/components/admin/AdminModulePageShell';

const ACTIVE_MODULE_HREF = '/dispatch';

export default function AdminDispatchPage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="源头监控与调度"
    >
      <div className="min-h-screen bg-background p-6 text-text-primary">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-8">
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-text-primary">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 shadow-lg shadow-fuchsia-500/20">
                <span className="text-lg text-white">源</span>
              </div>
              源头监控与调度
            </h1>
            <p className="text-text-muted">模型路由 · 源头运行状态 · 调度统计</p>
          </div>

          <ModelDispatchTab />
        </div>
      </div>
    </AdminModulePageShell>
  );
}
