'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Image as ImageIcon, X } from 'lucide-react';
import clsx from 'clsx';

import type { AdminTemplate } from '@/lib/api-clients/clients/templateClient';
import { InlineSkeleton } from '@/components/ui/Skeleton';

interface TemplatePickerProps {
  /** 当前绑定值(后台模板 UUID;旧数据可能为短 id) */
  value: string;
  /** 父组件已加载的模板列表 */
  templates: AdminTemplate[];
  /** 列表加载中 */
  loading?: boolean;
  /** 选中写入 template.id;清除写入 '' */
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const statusBadge = (status: string) => {
  if (status === 'published') return { label: '已发布', className: 'bg-green-500/15 text-green-300' };
  if (status === 'draft') return { label: '草稿', className: 'bg-amber-500/15 text-amber-300' };
  return { label: status, className: 'bg-white/5 text-text-muted' };
};

export default function TemplatePicker({
  value,
  templates,
  loading = false,
  onChange,
  placeholder = '选择模板',
  disabled = false,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = templates.find((template) => template.id === value);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return templates;
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(keyword) ||
        template.category.toLowerCase().includes(keyword)
    );
  }, [templates, query]);

  // 外部点击关闭下拉
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const toggle = () => {
    if (disabled || loading) return;
    if (!open) {
      // 首次展开时清空上次搜索并聚焦搜索框
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
    setOpen((current) => !current);
  };

  const select = (template: AdminTemplate) => {
    onChange(template.id);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) select(item);
    }
  };

  const selectedBadge = selected ? statusBadge(selected.status) : null;
  const interactive = !disabled && !loading;

  return (
    <div ref={containerRef} className="relative">
      {/* 触发区:已选回显模板信息,未选/旧值回退显示原始 value */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        className={clsx(
          'input-primary flex w-full cursor-pointer items-center gap-2',
          !interactive && 'cursor-not-allowed opacity-60'
        )}
        onClick={toggle}
      >
        {selected ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selected.cover_url ? (
              <img
                src={selected.cover_url}
                alt={selected.name}
                className="h-8 w-12 shrink-0 rounded-md border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md bg-white/5 text-text-muted">
                <ImageIcon size={16} />
              </div>
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{selected.name}</span>
            {selectedBadge ? (
              <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', selectedBadge.className)}>
                {selectedBadge.label}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{value || placeholder}</span>
        )}
        {value ? (
          <button
            type="button"
            aria-label="清除选择"
            className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
            onClick={(event) => {
              event.stopPropagation();
              onChange('');
            }}
          >
            <X size={16} />
          </button>
        ) : null}
        {open ? (
          <ChevronUp size={16} className="shrink-0 text-text-muted" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-text-muted" />
        )}
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-surface p-2 shadow-xl"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="input-primary mb-2 w-full"
            placeholder="搜索模板名称或分类"
          />

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <InlineSkeleton key={index} height="h-14" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-text-muted">{templates.length === 0 ? '暂无模板' : '未找到匹配的模板'}</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((template, index) => {
                const badge = statusBadge(template.status);
                return (
                  <li key={template.id} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      className={clsx(
                        'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        index === activeIndex ? 'bg-white/5' : 'hover:bg-white/5'
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(template)}
                    >
                      <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                        {template.cover_url ? (
                          <img
                            src={template.cover_url}
                            alt={template.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon size={18} className="m-auto mt-2.5 text-text-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm text-text-primary">{template.name}</span>
                          <span
                            className={clsx('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-text-muted">
                          <span className="truncate">{template.category}</span>
                          <span>
                            消耗 <b className="text-text-primary">{template.price_credits}</b> 积分
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
