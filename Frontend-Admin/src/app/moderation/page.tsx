'use client';

import React from 'react';

import AdminContentModerationCenter from '@/components/AdminContentModerationCenter';
import AdminModulePageShell from '@/components/admin/AdminModulePageShell';

const ACTIVE_MODULE_HREF = '/moderation';

export default function AdminModerationPage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="内容审核"
    >
      <div className="min-h-screen bg-background p-6 text-text-primary">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-8">
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-text-primary">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 shadow-lg shadow-cyan-500/20">
                <span className="text-lg text-white">盾</span>
              </div>
              内容审核
            </h1>
            <p className="text-text-muted">审核概览 · 风险聚焦 · 记录追溯</p>
          </div>

          <AdminContentModerationCenter />
        </div>
      </div>
    </AdminModulePageShell>
  );
}
