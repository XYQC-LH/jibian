'use client';

import React from 'react';
import { XCircle } from 'lucide-react';

export const StatCard = ({ title, value, icon: Icon, meta }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; meta: string }) => (
  <div className="card-primary p-4">
    <div className="flex items-start justify-between">
      <div>
        <div className="mb-1 text-xs text-text-muted">{title}</div>
        <div className="text-2xl font-semibold text-text-primary">{value}</div>
        <div className="mt-2 text-xs text-text-muted">{meta}</div>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

export const Modal: React.FC<{
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  confirmText?: string;
  loadingText?: string;
}> = ({ title, children, onClose, onConfirm, isLoading = false, confirmText = '确认', loadingText = '处理中...' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-surface/95 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
          <XCircle className="h-5 w-5 text-text-muted" />
        </button>
      </div>
      {children}
      <div className="mt-6 flex gap-3">
        <button onClick={onClose} disabled={isLoading} className="flex-1 rounded-lg border border-white/10 bg-surface/50 px-4 py-2 text-text-primary">
          取消
        </button>
        <button onClick={() => void onConfirm()} disabled={isLoading} className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-white">
          {isLoading ? loadingText : confirmText}
        </button>
      </div>
    </div>
  </div>
);

export const OverlayCard: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-surface/95 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-white/10">
          <XCircle className="h-5 w-5 text-text-muted" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="mb-2 block text-sm font-medium text-text-primary">{label}</label>
    {children}
  </div>
);

export const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="text-text-muted">{label}</span>
    <span className="break-all text-right text-text-primary">{value}</span>
  </div>
);
