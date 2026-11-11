/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
