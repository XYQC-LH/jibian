'use client';

import React from 'react';
import { Users } from 'lucide-react';

import AdminModulePageShell from '@/components/admin/AdminModulePageShell';
import UserManagement from '@/components/UserManagement';

const ACTIVE_MODULE_HREF = '/users';

export default function UsersPage() {
  return (
    <AdminModulePageShell
      activeModuleHref={ACTIVE_MODULE_HREF}
      activeModuleName="用户管理"
    >
      <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary mb-2 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Users className="text-white w-6 h-6" />
            </div>
            用户管理
          </h1>
          <p className="text-text-muted">用户列表 · 余额状态 · 使用记录</p>
        </div>

        <div className="card-primary p-6">
          <UserManagement />
        </div>
      </div>
    </AdminModulePageShell>
  );
}
