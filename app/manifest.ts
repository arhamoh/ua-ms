import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UA Agency Platform',
    short_name: 'UA Agency',
    description: 'Agency project management, billing, and commissions.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#E11D48',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
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
