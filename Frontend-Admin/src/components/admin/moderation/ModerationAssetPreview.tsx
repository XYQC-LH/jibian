'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

const ASSET_DOWNLOAD_RE = /(?:^|\/)api\/assets\/([^/?#]+)(?:\/download)?(?=\?|#|$)/i;
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

const resolveAdminAssetLink = (assetId: string): string =>
  `/api/v1/admin/assets/${encodeURIComponent(assetId)}/resolve-link`;

const extractAssetId = (value: string | null | undefined): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(ASSET_DOWNLOAD_RE);
  return match?.[1]?.trim() || null;
};

const normalizeDirectUrl = (value: string | null | undefined): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^(https?:\/\/|data:)/i.test(raw)) return raw;
  if (raw.startsWith('/')) return raw;
  return null;
};

type ModerationAssetPreviewProps = {
  rawUrl?: string | null;
  kind: 'image' | 'video';
  alt?: string;
  className?: string;
  wrapperClassName?: string;
};

export default function ModerationAssetPreview({
  rawUrl,
  kind,
  alt = '',
  className = '',
  wrapperClassName = '',
}: ModerationAssetPreviewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const assetId = useMemo(() => extractAssetId(rawUrl), [rawUrl]);
  const directUrl = useMemo(() => normalizeDirectUrl(rawUrl), [rawUrl]);

  useEffect(() => {
    setResolvedUrl(null);
    setLoading(false);
    setError(null);
    setRetryNonce(0);
    setIsVisible(false);
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, [rawUrl]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;

    const load = async () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      if (!rawUrl) {
        setResolvedUrl(null);
        setLoading(false);
        setError(null);
        return;
      }

      if (!assetId) {
        const normalized = directUrl;
        setResolvedUrl(normalized);
        setLoading(false);
        setError(normalized ? null : '无法解析图片链接');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(resolveAdminAssetLink(assetId), {
          credentials: 'include',
        });

        const payload = await response.json().catch(() => null);
        const resolved = String(payload?.data?.url || '').trim();
        if (!response.ok || !payload?.success || !resolved) {
          throw new Error(String(payload?.message || payload?.error || '图片链接解析失败'));
        }

        if (cancelled) return;
        setResolvedUrl(resolved);
        setLoading(false);
        setError(null);

        refreshTimerRef.current = window.setTimeout(() => {
          setRetryNonce((value) => value + 1);
        }, REFRESH_INTERVAL_MS);
      } catch (loadError: unknown) {
        if (cancelled) return;
        setResolvedUrl(null);
        setLoading(false);
        setError(loadError instanceof Error ? loadError.message : '图片链接解析失败');
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [assetId, directUrl, isVisible, rawUrl, retryNonce]);

  const previewUrl = resolvedUrl || directUrl;

  return (
    <div ref={wrapperRef} className={wrapperClassName}>
      {!isVisible ? (
        <div className="flex h-full min-h-[208px] items-center justify-center rounded-md border border-dashed border-white/10 bg-black/10 text-xs text-text-muted">
          滚动后加载预览
        </div>
      ) : loading ? (
        <div className="flex h-full min-h-[208px] items-center justify-center rounded-md border border-white/10 bg-black/20 text-xs text-text-muted">
          正在加载预览...
        </div>
      ) : error ? (
        <div className="flex h-full min-h-[208px] flex-col items-center justify-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-center text-xs text-red-300">
          <div>{error}</div>
          {assetId ? (
            <button
              type="button"
              onClick={() => setRetryNonce((value) => value + 1)}
              className="rounded border border-white/10 px-2 py-1 text-[11px] text-text-primary hover:bg-white/5"
            >
              重新续签
            </button>
          ) : null}
        </div>
      ) : previewUrl ? (
        kind === 'image' ? (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="block h-full">
            <img
              src={previewUrl}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={className}
            />
          </a>
        ) : (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="block h-full">
            <video
              src={previewUrl}
              controls
              preload="none"
              className={className}
            />
          </a>
        )
      ) : (
        <div className="flex h-full min-h-[208px] items-center justify-center rounded-md border border-white/10 bg-black/20 text-xs text-text-muted">
          暂无可预览内容
        </div>
      )}
    </div>
  );
}
