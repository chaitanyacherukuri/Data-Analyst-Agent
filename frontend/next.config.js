/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable React strict mode to prevent double renders
  swcMinify: true,
  output: 'standalone',
  
  // Enhanced API rewrites with more flexible fallback
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://data-analyst-agent-production.up.railway.app';
    console.log(`Configuring API rewrites to: ${apiUrl}`);
    
    return [
      // API rewrite
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      }
    ];
  },
  
  // Explicitly define headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
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