import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase from default 1MB to 10MB for large CSV uploads
    },
  },
  async rewrites() {
    const target = (process.env.NEXT_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_LOCAL_URL || 'http://server.mailsfinder.com:8081').replace(/\/+$/, '')
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
    ]
  },
};

export default nextConfig;
