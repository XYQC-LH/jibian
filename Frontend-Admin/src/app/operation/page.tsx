'use client';

import React from 'react';

import AdminModulePageShell from '@/components/admin/AdminModulePageShell';
import OperationSettingsPanel from '@/components/admin/operation/OperationSettingsPanel';

const ACTIVE_MODULE_HREF = '/operation';

export default function OperationSettingsPage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="设置运营"
    >
      <div className="min-h-screen bg-background p-6 text-text-primary">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-text-primary">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-orange-600 shadow-lg shadow-rose-500/20">
                  <span className="text-lg text-white">运</span>
                </div>
                设置运营
              </h1>
              <p className="text-text-muted">首页轮播 · 模板跳转 · 小程序运营位</p>
            </div>
          </div>

          <OperationSettingsPanel />
        </div>
      </div>
    </AdminModulePageShell>
  );
}
