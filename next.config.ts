import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js ships a native .node binding that Turbopack can't place in
  // an ESM chunk. Keep it external so it's required from node_modules at runtime.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
