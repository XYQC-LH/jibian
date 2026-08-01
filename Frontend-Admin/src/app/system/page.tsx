'use client';

import React from 'react';

import SystemConfigPanel from '@/components/admin/resource/SystemConfigPanel';
import AdminModulePageShell from '@/components/admin/AdminModulePageShell';

const ACTIVE_MODULE_HREF = '/system';

export default function AdminSystemConfigPage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="系统配置"
    >
      <div className="min-h-screen bg-background p-6 text-text-primary">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-8">
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-text-primary">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-500/20">
                <span className="text-lg text-white">设</span>
              </div>
              系统配置
            </h1>
            <p className="text-text-muted">任务超时 · 清理间隔 · 注册奖励 · 内部密钥</p>
          </div>

          <SystemConfigPanel />
        </div>
      </div>
    </AdminModulePageShell>
  );
}
