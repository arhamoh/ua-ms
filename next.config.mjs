/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // Statement uploads (multiple PDFs/CSVs) post through a Server Action, whose
    // request body defaults to a 1 MB cap — too small for several files at once.
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
