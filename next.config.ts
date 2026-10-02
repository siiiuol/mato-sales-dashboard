import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/klantdocumenten": ["./content/klantdocumenten/**/*"],
    "/klantdocumenten/**": ["./content/klantdocumenten/**/*"],
  },
  async redirects() {
    return [
      {
        source: "/docs/:file",
        destination: "/klantdocumenten/docs/:file",
        permanent: false,
      },
      {
        source: "/werkblad.html",
        destination: "/klantdocumenten/werkblad.html",
        permanent: false,
      },
      { source: "/reclame", destination: "/klantdocumenten", permanent: false },
      {
        source: "/reclame/materiaal",
        destination: "/klantdocumenten",
        permanent: false,
      },
      { source: "/aios", destination: "/", permanent: false },
      { source: "/deals", destination: "/leads", permanent: false },
      { source: "/taken", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
