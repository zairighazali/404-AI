// src/pages/api/email.ts

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
    const { name, fromEmail, phone, message, summary, conversation } = body;

    if (!name || !fromEmail) {
      return jsonResp({ error: 'Nama dan emel diperlukan' }, 400);
    }

    // Baca env vars menggunakan helper yang reliable
    const RESEND_KEY = getEnv(locals, 'RESEND_API_KEY');
    const FROM_EMAIL = getEnv(locals, 'RESEND_FROM') || 'hello@404found.studio';
    const TO_EMAIL   = getEnv(locals, 'RESEND_TO')   || 'mohdzairighazali@yahoo.com';

    // Log untuk debugging (visible dalam Cloudflare Dashboard → Functions → Logs)
    console.log('[email] RESEND_KEY ada:', RESEND_KEY.length > 0, '| panjang:', RESEND_KEY.length);
    console.log('[email] FROM:', FROM_EMAIL, '| TO:', TO_EMAIL);
    console.log('[email] locals.runtime?.env exists:', !!(locals as any)?.runtime?.env);

    const subject     = `Pertanyaan Projek Baru daripada ${name} — 404found.studio`;
    const htmlContent = buildHtml({ name, fromEmail, phone, message, summary, conversation });
    const textContent = buildText({ name, fromEmail, phone, message, summary, conversation });

    // ── LOCALHOST: tiada key → log ke console ─────────────────────────────
    if (!RESEND_KEY) {
      console.log('\n' + '═'.repeat(64));
      console.log('📧  EMAIL (RESEND_API_KEY tidak ditemui — semak env vars!)');
      console.log('═'.repeat(64));
      console.log('To:     ', TO_EMAIL);
      console.log('From:   ', FROM_EMAIL);
      console.log('Subject:', subject);
      console.log('─'.repeat(64));
      console.log(textContent);
      console.log('═'.repeat(64) + '\n');

      // Kalau dalam Cloudflare tapi key tak jumpa, ini masalah konfigurasi
      const isCloudflare = !!(locals as any)?.runtime;
      if (isCloudflare) {
        return jsonResp({
          error: 'RESEND_API_KEY tidak ditemui dalam Cloudflare environment. ' +
            'Pergi Cloudflare Dashboard → Pages → Settings → Environment Variables ' +
            'dan pastikan RESEND_API_KEY dah ditambah untuk Production environment.'
        }, 500);
      }

      return jsonResp({
        ok: true,
        mode: 'console',
        message: 'Localhost mode — email dilog ke terminal.',
      });
    }

    // ── PRODUCTION: hantar via Resend ──────────────────────────────────────
    console.log('[email] Menghantar via Resend...');

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     FROM_EMAIL,
        to:       [TO_EMAIL],
        reply_to: fromEmail,
        subject,
        html:     htmlContent,
        text:     textContent,
      }),
    });

    const resendData = await resendRes.json() as any;
    console.log('[email] Resend status:', resendRes.status, '| response:', JSON.stringify(resendData));

    if (!resendRes.ok) {
      const errMsg: string = resendData?.message ?? resendData?.name ?? JSON.stringify(resendData);

      let userMsg = `Resend error (${resendRes.status}): ${errMsg}`;
      if (errMsg.toLowerCase().includes('domain') || errMsg.toLowerCase().includes('sender')) {
        userMsg = `Domain "${FROM_EMAIL.split('@')[1]}" belum disahkan dalam Resend. ` +
          'Pergi Resend Dashboard → Domains dan pastikan status Verified.';
      } else if (resendRes.status === 401 || resendRes.status === 403) {
        userMsg = 'RESEND_API_KEY tidak sah atau sudah expired. Jana semula dalam Resend Dashboard.';
      }

      return jsonResp({ error: userMsg }, 500);
    }

    console.log('[email] ✓ Berjaya! ID:', resendData.id);
    return jsonResp({ ok: true, id: resendData.id });

  } catch (err: any) {
    console.error('[email] Exception:', err?.message ?? err);
    return jsonResp({ error: err?.message ?? 'Unknown error' }, 500);
  }
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { headers: CORS });

// ── HTML template ──────────────────────────────────────────────────────────
function buildHtml({ name, fromEmail, phone, message, summary, conversation }: any) {
  const features = summary?.features
    ? (Array.isArray(summary.features) ? summary.features.join(', ') : summary.features)
    : 'N/A';

  const waLink = phone
    ? `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ${name}, terima kasih kerana menghubungi 404found.studio!`)}`
    : null;

  const convHtml = (conversation ?? [])
    .filter((m: any) => !String(m.content).startsWith('__'))
    .map((m: any) => {
      const isUser = m.role === 'user';
      const label  = isUser ? name : 'AI Consultant';
      const bg     = isUser ? '#f0f9ff' : '#f0fdf4';
      const clean  = String(m.content).replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g,'').trim();
      return `<div style="margin-bottom:8px;padding:10px 14px;background:${bg};border-radius:8px;">
        <div style="font-size:10px;font-weight:700;color:#888;margin-bottom:4px;text-transform:uppercase;">${label}</div>
        <div style="font-size:13px;color:#333;line-height:1.6;white-space:pre-wrap;">${clean}</div>
      </div>`;
    }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0ec;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto 48px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e0e0da;">
  <div style="background:#0a0a0b;padding:28px 32px;text-align:center;">
    <div style="font-family:monospace;font-size:22px;font-weight:700;color:#00ff88;">404found.studio</div>
    <div style="font-size:12px;color:#666;margin-top:6px;text-transform:uppercase;letter-spacing:.05em;">Pertanyaan Projek Baru</div>
  </div>
  <div style="padding:24px 32px;border-bottom:1px solid #eee;">
    <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:.05em;">Maklumat Klien</h2>
    <table style="width:100%;font-size:13px;border-collapse:collapse;line-height:1.8;">
      <tr><td style="color:#888;width:100px;">Nama</td><td style="font-weight:700;">${name}</td></tr>
      <tr><td style="color:#888;">Emel</td><td><a href="mailto:${fromEmail}" style="color:#008844;">${fromEmail}</a></td></tr>
      ${phone ? `<tr><td style="color:#888;">WhatsApp</td><td>${waLink ? `<a href="${waLink}" style="color:#25D366;">${phone}</a>` : phone}</td></tr>` : ''}
    </table>
    ${message ? `<div style="margin-top:14px;padding:12px 16px;background:#f9f9f6;border-radius:8px;font-size:13px;color:#444;line-height:1.7;">${message}</div>` : ''}
  </div>
  ${summary ? `
  <div style="padding:24px 32px;border-bottom:1px solid #eee;">
    <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:.05em;">Ringkasan Projek</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;">
      <table style="width:100%;font-size:13px;border-collapse:collapse;line-height:1.8;">
        <tr><td style="color:#666;width:150px;">Jenis Perniagaan</td><td>${summary.businessType||'N/A'}</td></tr>
        <tr><td style="color:#666;">Jenis Website</td><td>${summary.websiteType||'N/A'}</td></tr>
        <tr><td style="color:#666;">Ciri-ciri</td><td>${features}</td></tr>
        <tr><td style="color:#666;">Anggaran Harga</td><td style="font-weight:700;color:#008844;">${summary.estimatedPrice||'TBD'}</td></tr>
        <tr><td style="color:#666;">Tempoh Masa</td><td>${summary.estimatedTimeline||'TBD'}</td></tr>
      </table>
    </div>
  </div>` : ''}
  ${convHtml ? `
  <div style="padding:24px 32px;">
    <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:.05em;">Sejarah Perbualan</h2>
    ${convHtml}
  </div>` : ''}
  <div style="padding:14px 32px;background:#f5f5f0;border-top:1px solid #eee;text-align:center;">
    <div style="font-size:11px;color:#aaa;">Dihantar via 404found.studio AI Consultant</div>
  </div>
</div></body></html>`;
}

// ── Plain text ─────────────────────────────────────────────────────────────
function buildText({ name, fromEmail, phone, message, summary, conversation }: any) {
  const lines = [
    '404found.studio — Pertanyaan Projek Baru',
    '='.repeat(50), '',
    `Nama:    ${name}`,
    `Emel:    ${fromEmail}`,
    phone ? `Telefon: ${phone}` : '',
    '',
  ].filter(Boolean) as string[];

  if (message) lines.push('Mesej:', message, '');

  if (summary) {
    const f = Array.isArray(summary.features) ? summary.features.join(', ') : (summary.features ?? 'N/A');
    lines.push('RINGKASAN PROJEK', '-'.repeat(30),
      `Jenis Perniagaan : ${summary.businessType  ?? 'N/A'}`,
      `Jenis Website    : ${summary.websiteType   ?? 'N/A'}`,
      `Ciri-ciri        : ${f}`,
      `Anggaran Harga   : ${summary.estimatedPrice    ?? 'TBD'}`,
      `Tempoh Masa      : ${summary.estimatedTimeline ?? 'TBD'}`, '');
  }

  if (conversation?.length) {
    lines.push('PERBUALAN', '-'.repeat(30));
    for (const m of conversation) {
      if (String(m.content).startsWith('__')) continue;
      const label = m.role === 'user' ? name : 'AI';
      const clean = String(m.content).replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g,'').trim();
      lines.push(`[${label}]`, clean, '');
    }
  }

  return lines.join('\n');
}
