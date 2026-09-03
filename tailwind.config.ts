import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        // Keel wordmark / display.
        space: ['"Space Grotesk"', 'var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Keel brand: teal keel-point on ink, paper ground.
        brand: {
          DEFAULT: '#0F5B57',
          dark: '#0B4642',
          light: '#E3EEEC',
        },
        ink: '#111214',
        paper: '#F6F4EF',
      },
    },
  },
  plugins: [],
};

export default config;
