import React from 'react';
import { AdminAuthProvider } from '@/lib/useAdminAuth';
import AdminLayout from '@/components/AdminLayout';

export default function AdminAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return React.createElement(
    AdminAuthProvider,
    null,
    React.createElement(
      AdminLayout,
      null,
      children
    )
  );
}
