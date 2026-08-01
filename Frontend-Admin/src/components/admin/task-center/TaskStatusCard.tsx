import React from 'react'
import { TrendingUp } from 'lucide-react'

export type TaskStatusCardProps = {
  title: string
  value: string | number
  color: string
  icon: React.ComponentType<{ className?: string }>
  trend?: number
  subtitle?: string
}

export default function TaskStatusCard({
  title,
  value,
  color,
  icon: Icon,
  trend,
  subtitle,
}: TaskStatusCardProps) {
  return (
    <div className={`admin-stat-card p-6 rounded-2xl border border-white/10 ${color}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-1">{title}</h3>
          <p className="text-3xl font-bold text-text-primary">{value}</p>
          {subtitle && (
            <p className="text-xs text-text-muted mt-1">{subtitle}</p>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon className="w-6 h-6 text-accent" />
        </div>
      </div>

      {trend !== undefined && (
        <div className="flex items-center text-xs">
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
          ) : (
            <TrendingUp className="w-4 h-4 text-red-400 mr-1 rotate-180" />
          )}
          <span className={trend > 0 ? 'text-green-400' : 'text-red-400'}>
            {Math.abs(trend)}%
          </span>
          <span className="ml-1 text-text-muted">vs 上小时</span>
        </div>
      )}
    </div>
  )
}

