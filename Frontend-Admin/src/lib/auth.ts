import { User } from '@/types';

/**
 * Check if user is admin
 * 简化：不再依赖 role 字段，所有 admin 接口走 cookie 鉴权
 */
export function isAdmin(user: User | null): boolean {
  return user !== null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(user: User | null): boolean {
  return user !== null;
}

/**
 * Require admin role - throws error if not admin
 */
export function requireAdmin(user: User | null): void {
  if (!isAdmin(user)) {
    throw new Error('Admin access required');
  }
}


















