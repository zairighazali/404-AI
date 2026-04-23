// src/lib/env.ts
export function getEnv(locals: any, key: string): string {
  return (
    locals?.runtime?.env?.[key] ??
    locals?.[key] ??
    (import.meta.env as any)?.[key] ??
    (typeof process !== 'undefined' ? process.env[key] : undefined) ??
    ''
  );
}
