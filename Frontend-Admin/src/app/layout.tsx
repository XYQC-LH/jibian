import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import ToasterProvider from '@/components/ToasterProvider'
import { CanonicalHostGuard } from '@/components/CanonicalHostGuard'
import { AdminAuthProvider } from '@/lib/useAdminAuth'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const ADMIN_SITE_URL = String(
  process.env.NEXT_PUBLIC_ADMIN_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3810',
).trim().replace(/\/+$/, '')
const ADMIN_SITE_HOST = new URL(ADMIN_SITE_URL).hostname
const CANONICAL_ALLOWED_HOSTS = Array.from(new Set([ADMIN_SITE_HOST, 'localhost', '127.0.0.1']))

export const metadata: Metadata = {
  title: '即变 管理员系统',
  description: '即变管理员系统，用于管理模板、生成任务、内容审核、积分兑换和基础运营数据。',
  icons: {
    icon: [
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon-192x192.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return React.createElement(
    'html',
    { lang: 'zh' },
    React.createElement(
      'body',
      { className: inter.className },
      React.createElement(CanonicalHostGuard, {
        canonicalBaseUrl: ADMIN_SITE_URL,
        allowedHosts: CANONICAL_ALLOWED_HOSTS,
      }),
      React.createElement(ToasterProvider, null),
      React.createElement(AdminAuthProvider, null, children)
    )
  )
}
