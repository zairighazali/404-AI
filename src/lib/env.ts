// src/lib/env.ts
//
// Helper untuk baca env vars dengan reliable dalam semua scenario:
//   1. Cloudflare Pages (production)   → locals.runtime.env
//   2. Vite dev server (localhost)      → import.meta.env
//   3. Cloudflare Pages Dev (wrangler)  → locals.runtime.env
//
// Masalah asal: dalam Cloudflare Pages production, cara baca env
// adalah BERBEZA dari localhost. Helper ini handle semua kes.

export function getEnv(locals: App.Locals | any, key: string): string {
  // Cuba semua cara yang mungkin, ikut keutamaan
  return (
    // Cara 1: Cloudflare Pages Functions (production & wrangler dev)
    (locals as any)?.runtime?.env?.[key] ??
    // Cara 2: Beberapa versi @astrojs/cloudflare expose terus sebagai locals
    (locals as any)?.[key] ??
    // Cara 3: Vite dev server (.env.local)
    (import.meta.env as any)?.[key] ??
    // Cara 4: Node process.env (kalau ada)
    (typeof process !== 'undefined' ? process.env[key] : undefined) ??
    ''
  );
}
