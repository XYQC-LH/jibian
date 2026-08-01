'use client'

import React from 'react'
import { Search } from 'lucide-react'

interface ResourceFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
}

const ResourceFilters: React.FC<ResourceFiltersProps> = ({
  searchTerm,
  onSearchChange,
}) => {
  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="搜索模型、提供商..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input-primary pl-10 pr-4 py-2 w-64"
          />
        </div>
      </div>
    </div>
  )
}

export default ResourceFilters
