import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./assets/receipts/**/*"] },
};
export default config;
