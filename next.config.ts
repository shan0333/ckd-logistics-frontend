import type { NextConfig } from "next";

// Single source of truth for the deployed sub-path — also read at runtime by
// src/lib/api.ts and src/app/login/page.tsx for raw window.location redirects,
// which (unlike next/link and useRouter) don't get basePath auto-applied.
const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
