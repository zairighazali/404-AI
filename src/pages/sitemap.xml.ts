// src/pages/sitemap.xml.ts
// Auto-generate sitemap.xml untuk SEO
// Accessible at: https://404found.studio/sitemap.xml

import type { APIRoute } from 'astro';

const DOMAIN = 'https://404found.studio';

// Semua pages dengan priority dan changefreq
const pages = [
  { url: '/',                                                     priority: '1.0', changefreq: 'weekly'  },
  { url: '/services',                                             priority: '0.9', changefreq: 'monthly' },
  { url: '/pricing',                                              priority: '0.9', changefreq: 'monthly' },
  { url: '/about',                                                priority: '0.7', changefreq: 'monthly' },
  { url: '/contact',                                              priority: '0.8', changefreq: 'monthly' },
  { url: '/blog',                                                 priority: '0.8', changefreq: 'weekly'  },
  { url: '/blog/how-much-does-a-website-cost-malaysia',          priority: '0.8', changefreq: 'monthly' },
  { url: '/blog/types-of-business-websites',                     priority: '0.7', changefreq: 'monthly' },
  { url: '/blog/ecommerce-vs-landing-page',                      priority: '0.7', changefreq: 'monthly' },
  { url: '/blog/how-long-to-build-a-website',                    priority: '0.7', changefreq: 'monthly' },
];

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const urlEntries = pages
    .map(({ url, priority, changefreq }) => `
  <url>
    <loc>${DOMAIN}${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`)
    .join('');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`.trim();

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400', // cache 24 jam
    },
  });
};
