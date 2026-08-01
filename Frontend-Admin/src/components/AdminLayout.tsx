'use client';

import React, { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * 纯展示用的布局组件
 *
 * 管理员权限的校验逻辑统一放在 `AdminDashboard` 里处理，
 * 这样未登录 / 非管理员用户访问时可以看到专门的管理员登录页，
 * 不会被这里的「需要管理员权限」页面拦截住。
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}