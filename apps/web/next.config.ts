import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ['@mycrm/core'],
  serverExternalPackages: ['@mycrm/db']
};

export default nextConfig;
