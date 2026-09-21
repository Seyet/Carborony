import type { NextConfig } from "next";

const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: storageOrigin
      ? ["product-media", "storefront-media", "business-logos"].map((bucket) =>
          new URL(`${storageOrigin.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/**`),
        )
      : [],
  },
};

export default nextConfig;
