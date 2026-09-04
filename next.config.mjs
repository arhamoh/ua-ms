/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // qpdf-wasm (used to decrypt bank e-statements) is an Emscripten CommonJS
  // module — keep it external so Next doesn't try to bundle its glue code...
  serverExternalPackages: ['@neslinesli93/qpdf-wasm'],
  // ...and force-trace its .wasm into the standalone output so it exists at runtime.
  outputFileTracingIncludes: {
    '/api/letters/[id]/package': ['./node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'],
    // The landing page (app/page.tsx) reads this HTML at request time.
    '/': ['./lib/landing.html'],
  },
  experimental: {
    // Statement uploads (multiple PDFs/CSVs) post through a Server Action, whose
    // request body defaults to a 1 MB cap — too small for several files at once.
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
