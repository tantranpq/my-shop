import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'photo.znews.vn',
        port: '',
        pathname: '/w1920/Uploaded/**',
      },
    ],
  },
  serverComponentsExternalPackages: ['@supabase/supabase-js'],
  appDir: true,
};

export default nextConfig;
