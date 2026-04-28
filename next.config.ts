import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase from default 1MB to 10MB for large CSV uploads
    },
  },
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    const envFlag = (process.env.NEXT_PUBLIC_API_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'staging')).toLowerCase()
    const base = (
      envFlag === 'production'
        ? (process.env.NEXT_PUBLIC_API_URL_PROD || process.env.NEXT_PUBLIC_SERVER_URL)
        : envFlag === 'local'
          ? (process.env.NEXT_PUBLIC_API_URL_LOCAL || process.env.NEXT_PUBLIC_API_URL_STAGING || process.env.NEXT_PUBLIC_LOCAL_URL)
          : (process.env.NEXT_PUBLIC_API_URL_STAGING || process.env.NEXT_PUBLIC_LOCAL_URL)
    ) || ''
    const target = base.replace(/\/+$/, '')
    return {
      afterFiles: [
        { source: '/api/:path*', destination: `${target}/api/:path*` },
      ],
    }
  },
};

export default nextConfig;
