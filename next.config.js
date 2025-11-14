/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Ensure Turbopack uses this project directory as the root
    root: __dirname,
  },
}

module.exports = nextConfig
