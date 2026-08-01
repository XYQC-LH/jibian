'use client';

import React, { Suspense } from 'react';

import AdminFinanceCenter from '@/components/AdminFinanceCenter';
import AdminModulePageShell from '@/components/admin/AdminModulePageShell';

const ACTIVE_MODULE_HREF = '/finance';

export default function FinancePage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="积分与兑换"
    >
      <Suspense fallback={<div className="p-6 text-text-muted">正在加载积分与兑换...</div>}>
        <AdminFinanceCenter />
      </Suspense>
    </AdminModulePageShell>
  );
}
