/** @type {import('next').NextConfig} */

const nextConfig = {
  // Strict mode for catching bugs early
  reactStrictMode: true,

  // Image optimisation — allow GCTU crest domain if hosted externally
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
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co'} wss://*.supabase.co`,
              "img-src 'self' data: blob: https://*.supabase.co",
              "frame-ancestors 'none'",
            ].join('; ')
          }
        ],
      },
    ]
  },

  // Redirect www to non-www in production
  async redirects() {
    return process.env.NODE_ENV === 'production'
      ? [
          {
            source: '/',
            has: [{ type: 'host', value: 'www.your-domain.com' }],
            destination: 'https://your-domain.com/',
            permanent: true,
          },
        ]
      : []
  },
}

module.exports = nextConfig