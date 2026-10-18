import type { NextConfig } from "next";
const config: NextConfig = { poweredByHeader: false, agentRules: false, turbopack: { root: process.cwd() }, outputFileTracingRoot: process.cwd(), serverExternalPackages: ["firebase-admin"], async headers() { return [{ source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "X-Frame-Options", value: "DENY" }] }]; } };
export default config;
