// src/pages/api/debug-env.ts
//
// DEBUG ENDPOINT — padam selepas confirm env vars berfungsi!
// Panggil: GET https://404found.studio/api/debug-env
//
// Akan tunjuk MANA env vars terbaca (tapi TIDAK dedahkan nilai sebenar)

import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/env';

export const GET: APIRoute = async ({ locals }) => {
  const keys = ['OPENAI_API_KEY', 'RESEND_API_KEY', 'RESEND_FROM', 'RESEND_TO'];

  // Semak semua cara baca env
  const cfEnv = (locals as any)?.runtime?.env ?? null;
  const localsKeys = Object.keys((locals as any) ?? {});

  const result: Record<string, any> = {
    // Tunjuk ada atau tidak (JANGAN tunjuk nilai sebenar — keselamatan!)
    envVarsFound: {} as Record<string, boolean>,
    readSources: {
      'locals.runtime.env exists': cfEnv !== null,
      'locals.runtime.env keys': cfEnv ? Object.keys(cfEnv) : [],
      'locals keys (non-runtime)': localsKeys.filter(k => k !== 'runtime'),
      'import.meta.env keys': Object.keys(import.meta.env).filter(k =>
        !k.startsWith('PUBLIC_') && k !== 'MODE' && k !== 'DEV' && k !== 'PROD' && k !== 'SSR' && k !== 'BASE_URL'
      ),
    },
  };

  for (const key of keys) {
    const val = getEnv(locals, key);
    result.envVarsFound[key] = val.length > 0;

    // Tunjuk 4 char pertama sahaja (untuk verify betul key)
    if (val.length > 0) {
      result.envVarsFound[key + '_preview'] = val.slice(0, 4) + '****';
    }
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
