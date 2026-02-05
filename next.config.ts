import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
    reactStrictMode: false,
    reactCompiler: true,
    images: {
        formats: ["image/avif", "image/webp"],
        // No remote patterns needed - avatars are proxied through /api/avatar/[hash]
        remotePatterns: [],
    },
    turbopack: {
        root: path.join(__dirname, '..'),
    },
    // webpack: (config) => {
    //     // Required for Redoc
    //     config.resolve.fallback = {
    //         ...config.resolve.fallback,
    //         fs: false,
    //         path: false,
    //     };
    //
    //     return config;
    // },
    experimental: {
        // Enable optimized Fast Refresh for faster development
        optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', '@heroicons/react'],
        // Turbo mode for faster builds
    },
    // output: 'standalone', uses next-start, leave commented-out
};

export default nextConfig;