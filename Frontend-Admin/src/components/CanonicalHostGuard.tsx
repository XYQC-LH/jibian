'use client'

// NOTE: 此文件与 Frontend-User/src/components/CanonicalHostGuard.tsx 同步。
// 修改时请同步更新另一端的对应文件，保持实现一致。

import { useEffect } from 'react'

type CanonicalHostGuardProps = {
  canonicalBaseUrl: string
  allowedHosts: readonly string[]
  allowedHostSuffixes?: readonly string[]
  allowLocalhost?: boolean
}

export function CanonicalHostGuard({
  canonicalBaseUrl,
  allowedHosts,
  allowedHostSuffixes = [],
  allowLocalhost = true,
}: CanonicalHostGuardProps) {
  useEffect(() => {
    const hostname = window.location.hostname

    if (
      allowLocalhost &&
      (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')
    ) {
      return
    }

    if (allowedHosts.includes(hostname)) return
    if (allowedHostSuffixes.some((suffix) => hostname.endsWith(suffix))) return

    const base = canonicalBaseUrl.replace(/\/$/, '')
    const target = `${base}${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.replace(target)
  }, [allowLocalhost, allowedHosts, allowedHostSuffixes, canonicalBaseUrl])

  return null
}

