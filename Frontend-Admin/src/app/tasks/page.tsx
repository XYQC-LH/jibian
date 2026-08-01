'use client';

import React, { Suspense } from 'react';

import AdminTaskCenter from '@/components/AdminTaskCenter';
import AdminModulePageShell from '@/components/admin/AdminModulePageShell';

const ACTIVE_MODULE_HREF = '/tasks';

/**
 * 管理员端任务与运维中心页面
 *
 * 说明：
 * - 这里不再使用任何本地 mock 数据，而是完全复用 `AdminTaskCenter`，
 *   由该组件通过真实的后端接口（任务列表、统计数据等）进行数据拉取与展示。
 * - `AdminTaskCenter` 已内置生产级的运维视图：任务状态统计、趋势图、模型负载、
 *   最近任务列表等，并使用统一的 `apiClient` 与 `/api/v1/tasks`、`/api/v1/admin/statistics`
 *   等接口对接。
 */
export default function AdminTasksPage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="生成任务"
    >
      <Suspense fallback={<div className="p-6 text-text-muted">正在加载生成任务...</div>}>
        <AdminTaskCenter />
      </Suspense>
    </AdminModulePageShell>
  );
}
