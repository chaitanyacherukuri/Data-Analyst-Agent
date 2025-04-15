/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable React strict mode to prevent double renders
  swcMinify: true,
  output: 'standalone',
  
  // Disable unnecessary optimizations that might interfere with navigation
  experimental: {
    // Optimize server-side navigation
    appDir: true,
    // Ensure proper client-side navigation
    scrollRestoration: true
  },
  
  // Enhanced API rewrites with more flexible fallback
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://data-analyst-agent-production.up.railway.app';
    console.log(`Configuring API rewrites to: ${apiUrl}`);
    
    return [
      // API rewrite
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      // Add a fallback for analysis page to prevent 404s
      {
        source: '/analysis/:session*',
        destination: '/analysis/[sessionId]', 
        has: [
          {
            type: 'query',
            key: 'session_id',
            value: '(?<session>.*)',
          },
        ],
      },
    ];
  },
  
  // Explicitly define the App Router routes that should prerender
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