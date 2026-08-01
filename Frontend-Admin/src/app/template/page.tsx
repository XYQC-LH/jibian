'use client';

import React from 'react';

import AdminResourceCenter from '@/components/AdminResourceCenter';
import AdminModulePageShell from '@/components/admin/AdminModulePageShell';

const ACTIVE_MODULE_HREF = '/template';

export default function ResourcesPage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="模板与模型"
    >
      <AdminResourceCenter />
    </AdminModulePageShell>
  );
}
