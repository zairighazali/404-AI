/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Syne', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        accent: '#00ff88',
        'accent-dark': '#00cc6a',
      },
    },
  },
  plugins: [],
};
