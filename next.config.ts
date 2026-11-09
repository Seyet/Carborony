import type { NextConfig } from "next";

const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;

const isDevelopment = process.env.NODE_ENV === "development";
const supabaseOrigin = storageOrigin ? new URL(storageOrigin).origin : null;
const supabaseWebSocketOrigin = supabaseOrigin
  ? supabaseOrigin.replace(/^http/, "ws")
  : null;

// Observe violations before enforcement. Next.js hydration currently needs inline
// scripts, and React/UI components use inline styles. Nonces require a separate
// rendering change before unsafe-inline can be removed.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self'",
  ["connect-src 'self'", supabaseOrigin, supabaseWebSocketOrigin,
    isDevelopment ? "ws://localhost:* ws://127.0.0.1:*" : null,
  ].filter(Boolean).join(" "),
  `media-src 'self' blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
        // Enforce framing protection while the CSP remains observational.
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()" },
      ],
    }];
  },
  images: {
    remotePatterns: storageOrigin
      ? ["product-media", "storefront-media", "business-logos"].map((bucket) =>
          new URL(`${storageOrigin.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/**`),
        )
      : [],
  },
};

export default nextConfig;
