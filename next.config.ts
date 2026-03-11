import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: isProd ? "export" : "standalone",
  assetPrefix: isProd ? "./" : undefined,
  /* config options here */
  reactCompiler: true,
};

export default nextConfig;
