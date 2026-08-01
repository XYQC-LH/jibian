'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import {
  adminSidebarModules,
  findAdminSidebarModuleByHref,
  findAdminSidebarModuleByName,
} from '@/components/admin/adminSidebarConfig';
import Sidebar from '@/components/dashboard/Sidebar';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { isAdmin } from '@/lib/auth';
import { canAccessAdminHref } from '@/lib/adminRoutePermission';
import { Skeleton } from '@/components/ui/Skeleton';

const ADMIN_ACTIVE_MODULE_KEY = 'admin:activeModule';
const DEFAULT_CONTENT_CLASS_NAME = 'flex-1 overflow-y-auto custom-scrollbar';

type AdminModulePageShellProps = {
  activeModuleHref: string;
  activeModuleName: string;
  contentClassName?: string;
  children: ReactNode;
};

const LoadingState = () => (
  <div className="min-h-screen bg-background p-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[240px,1fr]">
        <Skeleton className="h-[70vh] rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-[60vh] w-full rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

export default function AdminModulePageShell({
  activeModuleHref,
  activeModuleName,
  contentClassName = DEFAULT_CONTENT_CLASS_NAME,
  children,
}: AdminModulePageShellProps) {
  const { user, loading, isAuthenticated, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAllowed =
    Boolean(isAuthenticated) &&
    Boolean(user) &&
    isAdmin(user) &&
    canAccessAdminHref(user, activeModuleHref);
  const resolvedActiveModuleName =
    findAdminSidebarModuleByHref(activeModuleHref)?.name || activeModuleName;

  useEffect(() => {
    if (!loading && !isAllowed) {
      router.push('/');
    }
  }, [isAllowed, loading, router]);

  if (loading || !isAllowed || !user) {
    return <LoadingState />;
  }

  const onModuleChange = (moduleName: string) => {
    const target = findAdminSidebarModuleByName(moduleName);
    if (!target) {
      return;
    }
    if (target.href === pathname) {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(ADMIN_ACTIVE_MODULE_KEY, target.name);
      } catch (e: unknown) {        console.error("Unexpected error in AdminModulePageShell:", e);

        // ignore storage errors and keep navigation working
      }
    }

    router.push(target.href);
  };

  return (
    <div className="min-h-screen flex bg-background text-text-primary">
      <Sidebar
        user={user}
        activeModule={resolvedActiveModuleName}
        adminModules={adminSidebarModules}
        onModuleChange={onModuleChange}
        onLogout={logout}
      />
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
