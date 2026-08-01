import React from 'react';
import AdminAppShell from '@/components/admin/AdminAppShell';

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return React.createElement(AdminAppShell, null, children);
}
