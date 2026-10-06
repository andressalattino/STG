import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./assets/receipts/**/*", "./public/logo-stg.png"],
  },
};
export default config;
