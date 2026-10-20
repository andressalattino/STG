import type { NextConfig } from "next";
import { imageRemotePatterns } from "./src/lib/image-sources";

const config: NextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: imageRemotePatterns, minimumCacheTTL: 86400 },
  outputFileTracingIncludes: {
    "/*": ["./assets/receipts/**/*", "./public/logo-stg.png"],
  },
};
export default config;
