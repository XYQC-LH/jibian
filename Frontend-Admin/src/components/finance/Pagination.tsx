'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100]
}) => {
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  // 生成页码数组
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 始终显示第一页
      pages.push(1);
      
      if (page > 3) {
        pages.push('...');
      }
      
      // 显示当前页附近的页码
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      if (page < totalPages - 2) {
        pages.push('...');
      }
      
      // 始终显示最后一页
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
      {/* 左侧：显示信息 */}
      <div className="flex items-center gap-4 text-sm text-text-muted">
        <span>
          显示 {startItem}-{endItem} 条，共 {total} 条
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="input-primary px-2 py-1 text-sm"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>条</span>
          </div>
        )}
      </div>

      {/* 右侧：分页控件 */}
      <div className="flex items-center gap-1">
        {/* 首页 */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={`p-2 rounded-lg transition-colors ${
            page === 1
              ? 'text-text-muted cursor-not-allowed'
              : 'text-text-primary hover:bg-white/10'
          }`}
          title="首页"
        >
          <ChevronsLeft size={16} />
        </button>

        {/* 上一页 */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`p-2 rounded-lg transition-colors ${
            page === 1
              ? 'text-text-muted cursor-not-allowed'
              : 'text-text-primary hover:bg-white/10'
          }`}
          title="上一页"
        >
          <ChevronLeft size={16} />
        </button>

        {/* 页码 */}
        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map((pageNum, index) => (
            <React.Fragment key={index}>
              {pageNum === '...' ? (
                <span className="px-2 text-text-muted">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(pageNum as number)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                      : 'text-text-primary hover:bg-white/10'
                  }`}
                >
                  {pageNum}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 下一页 */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`p-2 rounded-lg transition-colors ${
            page === totalPages
              ? 'text-text-muted cursor-not-allowed'
              : 'text-text-primary hover:bg-white/10'
          }`}
          title="下一页"
        >
          <ChevronRight size={16} />
        </button>

        {/* 末页 */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={`p-2 rounded-lg transition-colors ${
            page === totalPages
              ? 'text-text-muted cursor-not-allowed'
              : 'text-text-primary hover:bg-white/10'
          }`}
          title="末页"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;