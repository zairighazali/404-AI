import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    // 'directory' mode output ke dist/_worker.js
    // Cloudflare Pages perlukan ini untuk SSR + API routes berfungsi
    mode: 'directory',
    platformProxy: { enabled: true },
  }),
  integrations: [tailwind()],
});
