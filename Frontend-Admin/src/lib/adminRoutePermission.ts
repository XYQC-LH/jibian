import type { User } from '@/types';
import { findAdminSidebarModuleByHref } from '@/components/admin/adminSidebarConfig';

export const canAccessAdminHref = (user: User | null, href: string): boolean => {
  if (!user) {
    return false;
  }

  const matchedModule = findAdminSidebarModuleByHref(href);
  return Boolean(matchedModule);
};
