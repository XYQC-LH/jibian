'use client'

import React from 'react'

import AdminTaskCenterView from '@/components/admin/task-center/AdminTaskCenterView'
import { useAdminTaskCenterData } from '@/components/admin/task-center/useAdminTaskCenterData'
import { DashboardSkeleton } from '@/components/ui/Skeleton'

export default function AdminTaskCenter() {
  const data = useAdminTaskCenterData()

  if (data.authLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <DashboardSkeleton />
      </div>
    )
  }

  if (!data.isAuthorized) {
    return null
  }

  const { authLoading, isAuthorized, ...viewProps } = data

  return <AdminTaskCenterView {...viewProps} />
}
