// src/pages/api/email.ts
// Hantar DUA email:
//   1. Kepada owner (mohdzairighazali@yahoo.com) — full project details + conversation
//   2. Kepada klien (fromEmail) — appreciation email, ringkas dan mesra

import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/env';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { name, fromEmail, phone, summary, conversation } = body;

    if (!name || !fromEmail) {
      return jsonResp({ error: 'Nama dan emel diperlukan' }, 400);
    }

    const RESEND_KEY = getEnv(locals, 'RESEND_API_KEY');
    const FROM_EMAIL = getEnv(locals, 'RESEND_FROM') || 'hello@404found.studio';
    const TO_EMAIL   = getEnv(locals, 'RESEND_TO')   || 'mohdzairighazali@yahoo.com';

    console.log('[email] RESEND_KEY ada:', RESEND_KEY.length > 0);
    console.log('[email] locals.runtime?.env exists:', !!(locals as any)?.runtime?.env);

    // ── LOCALHOST — tiada key, log ke console ─────────────────────────────
    if (!RESEND_KEY) {
      const isCloudflare = !!(locals as any)?.runtime;
      console.log('\n📧 EMAIL LOG (no RESEND_API_KEY)\n' + '='.repeat(50));
      console.log('TO OWNER:', TO_EMAIL);
      console.log('TO CLIENT:', fromEmail);
      console.log(buildOwnerText({ name, fromEmail, phone, summary, conversation }));
      console.log('='.repeat(50) + '\n');

      if (isCloudflare) {
        return jsonResp({
          error: 'RESEND_API_KEY tidak ditemui dalam Cloudflare. ' +
            'Pergi Settings → Environment Variables dan tambah RESEND_API_KEY.'
        }, 500);
      }
      return jsonResp({ ok: true, mode: 'console' });
    }

    // ── PRODUCTION — hantar dua email serentak ────────────────────────────
    const [ownerRes, clientRes] = await Promise.all([
      sendViaResend({
        apiKey:  RESEND_KEY,
        from:    FROM_EMAIL,
        to:      TO_EMAIL,
        replyTo: fromEmail,
        subject: `📋 Pertanyaan Projek: ${name} — ${summary?.websiteType ?? 'Website'}`,
        html:    buildOwnerHtml({ name, fromEmail, phone, summary, conversation }),
        text:    buildOwnerText({ name, fromEmail, phone, summary, conversation }),
      }),
      sendViaResend({
        apiKey:  RESEND_KEY,
        from:    FROM_EMAIL,
        to:      fromEmail,
        replyTo: TO_EMAIL,
        subject: `Terima kasih, ${name.split(' ')[0]}! Butiran projek anda telah kami terima 🙌`,
        html:    buildClientHtml({ name, summary }),
        text:    buildClientText({ name, summary }),
      }),
    ]);

    console.log('[email] Owner email status:', ownerRes.status);
    console.log('[email] Client email status:', clientRes.status);

    // Kalau email owner berjaya, anggap success (email klien adalah bonus)
    if (!ownerRes.ok) {
      const err = await ownerRes.json() as any;
      console.error('[email] Resend owner error:', JSON.stringify(err));
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('domain')) {
        return jsonResp({ error: `Domain "${FROM_EMAIL.split('@')[1]}" belum verify dalam Resend.` }, 500);
      }
      if (ownerRes.status === 401 || ownerRes.status === 403) {
        return jsonResp({ error: 'RESEND_API_KEY tidak sah atau expired.' }, 500);
      }
      return jsonResp({ error: `Resend error ${ownerRes.status}: ${msg}` }, 500);
    }

    const ownerData = await ownerRes.json() as any;
    console.log('[email] ✓ Owner email ID:', ownerData.id);

    return jsonResp({ ok: true, id: ownerData.id });

  } catch (err: any) {
    console.error('[email] exception:', err?.message);
    return jsonResp({ error: err?.message ?? 'Unknown error' }, 500);
  }
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { headers: CORS });

// ── Resend helper ──────────────────────────────────────────────────────────
async function sendViaResend({ apiKey, from, to, replyTo, subject, html, text }: {
  apiKey: string; from: string; to: string; replyTo: string;
  subject: string; html: string; text: string;
}) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html, text }),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// EMAIL 1: Kepada OWNER — full details
// ════════════════════════════════════════════════════════════════════════════
function buildOwnerHtml({ name, fromEmail, phone, summary, conversation }: any) {
  const features = summary?.features
    ? (Array.isArray(summary.features) ? summary.features.join(', ') : summary.features)
    : 'N/A';

  const convRows = (conversation ?? [])
    .filter((m: any) => !String(m.content).startsWith('__'))
    .map((m: any) => {
      const isUser = m.role === 'user';
      const clean  = String(m.content).replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g, '').trim();
      return `<tr>
        <td style="padding:8px 12px;vertical-align:top;white-space:nowrap;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;width:80px;">${isUser ? '👤 Klien' : '🤖 AI'}</td>
        <td style="padding:8px 12px;font-size:13px;color:#333;line-height:1.6;border-left:2px solid ${isUser ? '#bfdbfe' : '#bbf7d0'};">${clean.replace(/\n/g,'<br>')}</td>
      </tr>`;
    }).join('');

  const waLink = phone
    ? `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ${name}! Terima kasih kerana menghubungi 404found.studio. Saya Zaire, boleh kita berbual tentang projek website anda?`)}`
    : null;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0ec;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e0e0da;">

  <!-- Header -->
  <div style="background:#0a0a0b;padding:24px 32px;">
    <div style="font-family:monospace;font-size:20px;font-weight:700;color:#00ff88;">404found.studio</div>
    <div style="font-size:12px;color:#555;margin-top:4px;text-transform:uppercase;letter-spacing:.08em;">Pertanyaan Projek Baru via AI Consultant</div>
  </div>

  <!-- Quick action bar -->
  <div style="background:#f0fdf4;padding:14px 32px;border-bottom:1px solid #bbf7d0;display:flex;gap:12px;">
    <a href="mailto:${fromEmail}" style="display:inline-block;padding:8px 20px;background:#00ff88;color:#000;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">✉ Balas Email</a>
    ${waLink ? `<a href="${waLink}" style="display:inline-block;padding:8px 20px;background:#25D366;color:#fff;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">💬 WhatsApp Klien</a>` : ''}
  </div>

  <!-- Maklumat klien -->
  <div style="padding:24px 32px;border-bottom:1px solid #eee;">
    <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.08em;">Maklumat Klien</h2>
    <table style="font-size:14px;border-collapse:collapse;width:100%;line-height:2;">
      <tr><td style="color:#888;width:100px;">Nama</td><td style="font-weight:700;color:#111;">${name}</td></tr>
      <tr><td style="color:#888;">Emel</td><td><a href="mailto:${fromEmail}" style="color:#008844;font-weight:600;">${fromEmail}</a></td></tr>
      ${phone ? `<tr><td style="color:#888;">WhatsApp</td><td>${waLink ? `<a href="${waLink}" style="color:#25D366;font-weight:600;">${phone}</a>` : phone}</td></tr>` : ''}
    </table>
  </div>

  <!-- Ringkasan projek -->
  ${summary ? `<div style="padding:24px 32px;border-bottom:1px solid #eee;">
    <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.08em;">Ringkasan Projek</h2>
    <div style="background:#f9fafb;border-radius:12px;padding:20px;border:1px solid #e5e7eb;">
      <table style="width:100%;font-size:13px;border-collapse:collapse;line-height:2;">
        <tr><td style="color:#666;width:150px;">Jenis Perniagaan</td><td style="font-weight:600;">${summary.businessType||'N/A'}</td></tr>
        <tr><td style="color:#666;">Jenis Website</td><td style="font-weight:600;">${summary.websiteType||'N/A'}</td></tr>
        <tr><td style="color:#666;">Ciri-ciri</td><td>${features}</td></tr>
        <tr><td style="color:#666;">Anggaran Harga</td><td style="font-weight:700;color:#008844;font-size:16px;">${summary.estimatedPrice||'TBD'}</td></tr>
        <tr><td style="color:#666;">Tempoh Masa</td><td>${summary.estimatedTimeline||'TBD'}</td></tr>
      </table>
    </div>
  </div>` : ''}

  <!-- Perbualan -->
  ${convRows ? `<div style="padding:24px 32px;">
    <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.08em;">Log Perbualan</h2>
    <table style="width:100%;border-collapse:collapse;">${convRows}</table>
  </div>` : ''}

  <div style="padding:14px 32px;background:#f5f5f0;text-align:center;">
    <div style="font-size:11px;color:#aaa;">404found.studio AI Consultant &nbsp;·&nbsp; hello@404found.studio</div>
  </div>
</div></body></html>`;
}

function buildOwnerText({ name, fromEmail, phone, summary, conversation }: any) {
  const f = Array.isArray(summary?.features) ? summary.features.join(', ') : (summary?.features ?? 'N/A');
  const lines = [
    '404found.studio — Pertanyaan Projek Baru', '='.repeat(50), '',
    `Nama:    ${name}`, `Emel:    ${fromEmail}`,
    phone ? `Telefon: ${phone}` : '',
    '',
    summary ? [
      'RINGKASAN PROJEK', '-'.repeat(30),
      `Jenis Perniagaan : ${summary.businessType  ?? 'N/A'}`,
      `Jenis Website    : ${summary.websiteType   ?? 'N/A'}`,
      `Ciri-ciri        : ${f}`,
      `Anggaran Harga   : ${summary.estimatedPrice    ?? 'TBD'}`,
      `Tempoh Masa      : ${summary.estimatedTimeline ?? 'TBD'}`,
      '',
    ].join('\n') : '',
    'PERBUALAN', '-'.repeat(30),
    ...(conversation ?? [])
      .filter((m: any) => !String(m.content).startsWith('__'))
      .map((m: any) => {
        const label = m.role === 'user' ? `[${name}]` : '[AI]';
        const clean = String(m.content).replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g,'').trim();
        return `${label}\n${clean}\n`;
      }),
  ].filter(Boolean).join('\n');
  return lines;
}

// ════════════════════════════════════════════════════════════════════════════
// EMAIL 2: Kepada KLIEN — appreciation, ringkas, mesra
// ════════════════════════════════════════════════════════════════════════════
function buildClientHtml({ name, summary }: any) {
  const firstName = name.split(' ')[0];
  const features  = summary?.features
    ? (Array.isArray(summary.features) ? summary.features.join(', ') : summary.features)
    : 'N/A';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0ec;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e0e0da;">

  <!-- Header -->
  <div style="background:#0a0a0b;padding:32px;text-align:center;">
    <div style="font-family:monospace;font-size:22px;font-weight:700;color:#00ff88;letter-spacing:-.02em;">404found.studio</div>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111;">Terima kasih, ${firstName}! 🙌</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Kami telah menerima butiran projek website anda. Pasukan kami akan menyemak keperluan anda dan menghubungi anda <strong>dalam masa 24 jam</strong>.
    </p>

    ${summary ? `
    <!-- Ringkasan -->
    <div style="background:#f9fafb;border-radius:12px;padding:20px 24px;margin-bottom:24px;border-left:4px solid #00ff88;">
      <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">Ringkasan Projek Anda</div>
      <table style="width:100%;font-size:13px;border-collapse:collapse;line-height:2;">
        <tr><td style="color:#888;width:140px;">Jenis Website</td><td style="font-weight:600;">${summary.websiteType||'N/A'}</td></tr>
        <tr><td style="color:#888;">Perniagaan</td><td style="font-weight:600;">${summary.businessType||'N/A'}</td></tr>
        <tr><td style="color:#888;">Ciri-ciri</td><td>${features}</td></tr>
        <tr><td style="color:#888;">Anggaran</td><td style="font-weight:700;color:#008844;">${summary.estimatedPrice||'TBD'}</td></tr>
        <tr><td style="color:#888;">Timeline</td><td>${summary.estimatedTimeline||'TBD'}</td></tr>
      </table>
    </div>` : ''}

    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 8px;">
      Kalau ada pertanyaan segera, jangan segan hubungi kami terus:
    </p>

    <!-- CTA buttons -->
    <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">
      <a href="https://wa.me/601155525587" style="display:inline-block;padding:12px 24px;background:#25D366;color:#fff;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;">💬 WhatsApp Kami</a>
      <a href="mailto:hello@404found.studio" style="display:inline-block;padding:12px 24px;background:#0a0a0b;color:#00ff88;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;">✉ Email Kami</a>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:20px 32px;background:#f5f5f0;border-top:1px solid #eee;">
    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
      <strong style="color:#111;">404found.studio</strong><br>
      hello@404found.studio &nbsp;·&nbsp; +601155525587<br>
      <span style="font-size:11px;">Anda menerima email ini kerana telah berinteraksi dengan AI consultant kami.</span>
    </p>
  </div>

</div></body></html>`;
}

function buildClientText({ name, summary }: any) {
  const firstName = name.split(' ')[0];
  const f = Array.isArray(summary?.features) ? summary.features.join(', ') : (summary?.features ?? 'N/A');
  return [
    `Terima kasih, ${firstName}!`,
    '='.repeat(40),
    '',
    'Kami telah menerima butiran projek website anda.',
    'Pasukan kami akan menghubungi anda dalam masa 24 jam.',
    '',
    summary ? [
      'RINGKASAN PROJEK ANDA', '-'.repeat(30),
      `Jenis Website : ${summary.websiteType  ?? 'N/A'}`,
      `Perniagaan    : ${summary.businessType ?? 'N/A'}`,
      `Ciri-ciri     : ${f}`,
      `Anggaran      : ${summary.estimatedPrice    ?? 'TBD'}`,
      `Timeline      : ${summary.estimatedTimeline ?? 'TBD'}`,
      '',
    ].join('\n') : '',
    'Hubungi kami:', '-'.repeat(20),
    'WhatsApp : +601155525587',
    'Email    : hello@404found.studio',
    '',
    '404found.studio',
  ].filter(Boolean).join('\n');
}
