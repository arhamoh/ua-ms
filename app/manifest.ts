import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Keel',
    short_name: 'Keel',
    description: 'The operating system your agency runs on.',
    // The installed app is the workspace, not the marketing site: launch into
    // the dashboard (unauthenticated users get redirected to /login). Scope stays
    // at the app root so every in-app route opens inside the installed window.
    id: '/dashboard',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F4EF',
    theme_color: '#0F5B57',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
