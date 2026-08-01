'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin app global error boundary:', error);
  }, [error]);

  return (
    <html lang="zh">
      <body className="bg-background text-text-primary">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="card-primary max-w-2xl w-full">
            <div className="text-lg font-semibold">应用发生错误</div>
            <div className="text-sm text-text-muted mt-2 break-words">
              {error?.message || '未知错误'}
              {error?.digest ? <span className="ml-2 font-mono text-xs opacity-70">digest={error.digest}</span> : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className="btn-primary" onClick={reset} type="button">
                重试
              </button>
              <button className="btn-secondary border border-white/10" onClick={() => window.location.reload()} type="button">
                刷新
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
