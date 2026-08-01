'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Activity, LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: number
  trendLabel?: string
  color?: 'purple' | 'green' | 'blue' | 'orange' | 'red' | 'yellow'
  description?: string
}

const COLOR_CLASSES = {
  purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
  green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
  blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
  orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
  red: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400',
  yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400',
} as const

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel = '',
  color = 'purple',
  description,
}) => {
  const trendColor = trend && trend > 0 ? 'text-green-400' : trend && trend < 0 ? 'text-red-400' : 'text-text-muted'
  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Activity

  return (
    <div className="group card-primary p-4 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-white/20">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-xs font-medium text-text-muted mb-1">{title}</h3>
          <p className="text-xl font-bold text-text-primary group-hover:text-accent transition-colors">
            {value}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${COLOR_CLASSES[color]} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {trend !== undefined && (
        <div className="flex items-center text-xs">
          <TrendIcon className={`w-3 h-3 mr-1 ${trendColor}`} />
          <span className={trendColor}>{Math.abs(trend)}%</span>
          <span className="ml-1 text-text-muted">{trendLabel}</span>
        </div>
      )}

      {description && !trend && (
        <p className="text-xs text-text-muted mt-1">{description}</p>
      )}
    </div>
  )
}

export default StatCard
