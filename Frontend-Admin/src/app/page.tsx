import React from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import AdminAppShell from '@/components/admin/AdminAppShell';

export default function AdminPage() {
  return (
    <AdminAppShell>
        <AdminDashboard />
    </AdminAppShell>
  );
}
