import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UA Digital',
    short_name: 'UA Digital',
    description: 'Agency project management, billing, and commissions.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#E11D48',
    icons: [
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
