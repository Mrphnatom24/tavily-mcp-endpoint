import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/api/web-search/:path*",
        headers: [
          { key: "Content-Type", value: "text/event-stream" },
          { key: "Cache-Control", value: "no-cache, no-transform" },
          { key: "Connection", value: "keep-alive" },
          { key: "X-Accel-Buffering", value: "no" }, // Desactiva el buffering de Vercel
        ],
      },
    ];
  },
};

export default nextConfig;
