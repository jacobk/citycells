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

};

export default nextConfig;
