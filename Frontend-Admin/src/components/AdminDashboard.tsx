'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { isAdmin } from '@/lib/auth';
import AdminLogin from '@/components/AdminLogin';
import AdminMainDashboard from '@/components/AdminMainDashboard';
import { getErrorMessage } from '@/lib/http/errors';
import toast from 'react-hot-toast';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

export default function AdminDashboard() {
  const { user, loading, isAuthenticated, login } = useAdminAuth();
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <DashboardSkeleton />
      </div>
    );
  }

  // 如果未登录或不是管理员，显示登录页面
  if (!isAuthenticated || !user || !isAdmin(user)) {
    return (
      <AdminLogin
        onLogin={async (username: string, password: string) => {
          setIsLoggingIn(true);
          try {
            await login(username, password);
            toast.success('登录成功');
            // 登录成功后刷新页面以确保权限状态正确
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } catch (error: unknown) {
            toast.error(getErrorMessage(error, '登录失败'));
          } finally {
            setIsLoggingIn(false);
          }
        }}
        loading={isLoggingIn}
      />
    );
  }

  // 已登录的管理员，显示管理仪表盘
  return <AdminMainDashboard />;
}
