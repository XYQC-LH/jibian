/** @type {import('next').NextConfig} */

const normalizeBaseUrl = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

const resolveInternalApiBase = () => {
  const internal = normalizeBaseUrl(process.env.API_INTERNAL_URL);
  if (internal) return internal;

  return process.env.NODE_ENV === 'production' ? 'http://backend:8000' : 'http://localhost:8000';
};

const INTERNAL_API_BASE = resolveInternalApiBase();

const nextConfig = {
  // Standalone output for Docker
  output: 'standalone',

  // React strict mode
  reactStrictMode: true,

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY || '',
    NEXT_PUBLIC_ADMIN_PORT: process.env.NEXT_PUBLIC_ADMIN_PORT || '3810',
  },

  async redirects() {
    return [
      {
        source: '/login',
        destination: '/',
        permanent: false,
      },
    ];
  },

  // API rewrites
  async rewrites() {
    return [
      {
        source: '/health',
        destination: `${INTERNAL_API_BASE}/health`,
      },
      {
        source: '/api/assets/:path*',
        destination: `${INTERNAL_API_BASE}/api/assets/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${INTERNAL_API_BASE}/api/v1/:path*`,
      },
    ];
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'production',
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // Compression
  compress: true,

  // Power by header
  poweredByHeader: false,

  // Turbopack configuration for local module aliases
  turbopack: {
    root: __dirname,
    resolveAlias: {
      axios: './node_modules/axios',
    },
  },

  // Webpack alias configuration for local modules used by --webpack builds.
  webpack: (config) => {
    const path = require('path');
    const axiosPath = path.resolve(__dirname, './node_modules/axios');

    config.resolve.alias = {
      ...config.resolve.alias,
      axios: axiosPath,
    };
    return config;
  },
};

module.exports = nextConfig;
