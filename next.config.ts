import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WHY: Enable next/image optimization for Strava profile avatars
  // Strava serves athlete profile images from CloudFront CDN
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dgalywyr863hv.cloudfront.net',
        pathname: '/pictures/athletes/**',
      },
      {
        // WHY: Strava also uses graph.facebook.com for some profile images
        protocol: 'https',
        hostname: 'graph.facebook.com',
        pathname: '/**',
      },
      {
        // WHY: Fallback for other cloudfront distributions Strava might use
        protocol: 'https',
        hostname: '*.cloudfront.net',
        pathname: '/**',
      },
    ],
  },

  // WHY: sql.js requires WASM files to be served with correct headers
  // The WASM file is copied to public/sql-wasm/ during setup
  // See ADR 004 for SQLite storage architecture decision
  async headers() {
    return [
      {
        source: '/sql-wasm/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  
  // WHY: sql.js tries to require 'fs' and 'path' when running in Node environment
  // Turbopack configuration to handle sql.js properly
  turbopack: {
    resolveAlias: {
      // Provide empty modules for Node.js-specific imports in sql.js
      fs: { browser: './node_modules/next/dist/compiled/path-browserify' },
    },
  },
  
  // Webpack fallback for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
