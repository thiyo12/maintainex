/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      ...['res.cloudinary.com', 'images.unsplash.com', 'placehold.co', 'i.pravatar.cc'].map(hostname => ({
        protocol: 'https',
        hostname,
        port: '',
      })),
    ],
  },
  async redirects() {
    return [
      {
        source: '/booking',
        destination: '/waitlist',
        permanent: true,
      },
        {
          source: '/booking/confirmation',
          destination: '/waitlist',
          permanent: true,
        },
        {
          source: '/customer/:path*',
          destination: '/',
          permanent: true,
        },
        {
          source: '/coconut/:path*',
          destination: '/admin/login',
          permanent: true,
        },
      ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Detected-Framework', value: 'unknown' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.cloudinary.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://res.cloudinary.com https://*.cloudinary.com https://placehold.co https://i.pravatar.cc https://cdn.tailwindcss.com; connect-src 'self' https://api.cloudinary.com https://*.cloudinary.com; media-src 'self' https://res.cloudinary.com https://*.cloudinary.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:all(js|css)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
