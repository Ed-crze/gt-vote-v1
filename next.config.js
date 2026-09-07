/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co';

// Content Security Policy — 'unsafe-eval' is only needed by Turbopack/React Refresh,
// so it is stripped out of production builds.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `connect-src 'self' ${supabaseUrl} wss://*.supabase.co${
    isDev ? ' ws://localhost:3000 ws://192.168.78.1:3000' : ''
  }`,
  "img-src 'self' data: blob: https://*.supabase.co",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig = {
  // Hostnames only — no protocol, no port. Covers all ports on that host.
  allowedDevOrigins: ['100.75.120.112'],

  // Strict mode for catching bugs early
  reactStrictMode: true,

  // Image optimisation — allow Supabase public storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HSTS is meaningless over plain HTTP and can pin localhost to HTTPS,
          // so it is production-only.
          ...(isDev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]),
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },

  // Redirect www to non-www in production (all paths, not just root)
  async redirects() {
    return isDev
      ? []
      : [
          {
            source: '/:path*',
            has: [{ type: 'host', value: 'www.your-domain.com' }],
            destination: 'https://your-domain.com/:path*',
            permanent: true,
          },
        ];
  },
};

module.exports = nextConfig;