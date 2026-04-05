import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["@lingui/cli", "@lingui/conf"],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
    swcPlugins: [
      [
        "@lingui/swc-plugin",
        {
          forceExtract: true,
        runtime: "client",
        localeDir: "src/locales/{locale}",
        sourceLocale: "en",
      },
      ],
    ],
  },
};

export default nextConfig;



