/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server Actions are enabled by default since Next.js 14, but this
  // specific option (bodySizeLimit) is still nested under `experimental`
  // as of Next.js 16 — verified against current docs, not assumed. Kept
  // here for the reference image upload feature (see README "Unfinished
  // Placeholders") once it's built.
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};
module.exports = nextConfig;
