/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['read-excel-file'],
  eslint: {
    // Application CI runs the ESLint CLI directly; Next 15's build-time wrapper
    // is incompatible with this repository's flat ESLint configuration.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
