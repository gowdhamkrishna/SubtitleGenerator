/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '10gb', // or larger if needed
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10gb',
    }
  }
};

export default nextConfig;
