/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable React strict mode to prevent double renders
  swcMinify: true,
  output: 'standalone',
  
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
};

module.exports = nextConfig; 