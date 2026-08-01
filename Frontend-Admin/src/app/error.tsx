'use client';

import React, { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin app error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-text-primary flex items-center justify-center p-6">
      <div className="card-primary max-w-2xl w-full">
        <div className="text-lg font-semibold">页面发生错误</div>
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

        <div className="mt-4 text-xs text-text-muted">
          建议打开浏览器控制台（Console）查看具体报错堆栈，并在 Network 面板确认接口是否 401/403/500。
        </div>
      </div>
    </div>
  );
}
