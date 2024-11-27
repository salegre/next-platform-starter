/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        SERPAPI_KEY: process.env.SERPAPI_KEY
      }
};

module.exports = nextConfig;
