'use client'

// NOTE: 此文件与 Frontend-User/src/components/ConfirmDialog.tsx 同步。
// 修改时请同步更新另一端的对应文件，保持实现一致。

import React from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

const TYPE_STYLES = {
  danger: {
    iconColor: 'text-red-400',
    confirmBg: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    iconColor: 'text-yellow-400',
    confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
  },
  info: {
    iconColor: 'text-blue-400',
    confirmBg: 'bg-blue-600 hover:bg-blue-700',
  },
} as const

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'danger',
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const styles = TYPE_STYLES[type]
  const titleId = 'confirm-dialog-title'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-card border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95"
      >
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-4 right-4 p-1 text-text-muted hover:text-text-primary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <div className="p-6">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.iconColor}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h3 id={titleId} className="text-xl font-semibold text-text-primary text-center mb-2">
            {title}
          </h3>
          <p className="text-sm text-text-muted text-center mb-6">
            {message}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-text-primary bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all"
            >
              {cancelText}
            </button>
            <button
              onClick={() => { onConfirm(); onClose() }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-white ${styles.confirmBg} rounded-xl transition-all shadow-lg`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
