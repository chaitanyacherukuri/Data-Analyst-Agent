/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  distDir: '.next',
  trailingSlash: false,
  
  // Configure redirects to ensure proper navigation
  async redirects() {
    return [
      {
        source: '/analysis',
        destination: '/',
        permanent: false,
      },
    ];
  },
  
  // Ensure proper rewrites for our app
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/:path*` 
          : 'https://data-analyst-agent-production.up.railway.app/api/:path*',
      },
    ];
  },
  
  // Ensure any unresolved paths at build time are treated as fallbacks
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['localhost'],
  },
  
  // Additional experimental features to improve routing
  experimental: {
    appDir: true,
    serverActions: true,
  }
};

module.exports = nextConfig; 