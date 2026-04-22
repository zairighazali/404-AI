// src/pages/api/email.ts
// Hantar email via Resend.
// Dalam localhost: log ke console (sebab Resend perlukan domain verify)
// Dalam production (Cloudflare): hantar email sebenar

import type { APIRoute } from 'astro';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { name, fromEmail, phone, message, summary, conversation } = body;

    if (!name || !fromEmail) {
      return json({ error: 'Nama dan emel diperlukan' }, 400);
    }

    // Baca env vars — works untuk both Cloudflare runtime dan Vite dev server
    // @ts-ignore
    const cfEnv = (locals as any).runtime?.env ?? {};
    const RESEND_API_KEY = cfEnv.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY;
    const FROM = cfEnv.RESEND_FROM ?? import.meta.env.RESEND_FROM ?? 'hello@404found.studio';
    const TO   = cfEnv.RESEND_TO   ?? import.meta.env.RESEND_TO   ?? 'mohdzairighazali@yahoo.com';

    const html = buildEmailHtml({ name, fromEmail, phone, message, summary, conversation });
    const text = buildEmailText({ name, fromEmail, phone, message, summary, conversation });

    // ── MODE 1: Tiada API key → log ke console (untuk localhost testing) ──
    if (!RESEND_API_KEY) {
      console.log('\n' + '='.repeat(60));
      console.log('📧 EMAIL AKAN DIHANTAR (localhost mode — tiada Resend key)');
      console.log('='.repeat(60));
      console.log('To:     ', TO);
      console.log('From:   ', FROM);
      console.log('Reply:  ', fromEmail);
      console.log('Subject:', `New Project Inquiry from ${name} — 404found.studio`);
      console.log('-'.repeat(60));
      console.log(text);
      console.log('='.repeat(60) + '\n');

      // Kembalikan success supaya frontend tunjuk mesej berjaya
      return json({
        ok: true,
        mode: 'console',
        message: 'Email dilog ke terminal (localhost mode). Dalam production, email akan dihantar sebenar.',
      });
    }

    // ── MODE 2: Ada API key → hantar email sebenar via Resend ─────────────
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: fromEmail,
        subject: `New Project Inquiry from ${name} — 404found.studio`,
        html,
        text,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend error:', errBody);

      // Parse error untuk mesej yang lebih berguna
      let errMsg = 'Gagal hantar email.';
      try {
        const errJson = JSON.parse(errBody);
        if (errJson.message?.includes('domain')) {
          errMsg = 'Domain emel belum disahkan dalam Resend. Sila verify domain 404found.studio dalam dashboard Resend.';
        }
      } catch {}

      return json({ error: errMsg }, 500);
    }

    const resendData = await resendRes.json();
    return json({ ok: true, id: resendData.id });

  } catch (err: any) {
    console.error('Email error:', err);
    return json({ error: err.message }, 500);
  }
};

export const OPTIONS: APIRoute = async () => new Response(null, { headers: CORS });

// ── Helper ─────────────────────────────────────────────────────────────────
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Email HTML ─────────────────────────────────────────────────────────────
function buildEmailHtml({ name, fromEmail, phone, message, summary, conversation }: any) {
  const features = summary?.features
    ? (Array.isArray(summary.features) ? summary.features.join(', ') : summary.features)
    : 'N/A';

  const convHtml = (conversation || [])
    .filter((m: any) => !String(m.content).startsWith('__'))
    .map((m: any) => {
      const role  = m.role === 'user' ? name : 'AI Consultant';
      const bg    = m.role === 'user' ? '#f0f9ff' : '#f0fdf4';
      const clean = String(m.content).replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g, '').trim();
      return `<div style="margin-bottom:10px;padding:10px 14px;background:${bg};border-radius:8px;">
        <div style="font-size:11px;font-weight:700;color:#666;margin-bottom:4px;text-transform:uppercase;">${role}</div>
        <div style="font-size:13px;color:#333;line-height:1.6;white-space:pre-wrap;">${clean}</div>
      </div>`;
    }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e0e0dc;">

  <div style="background:#0a0a0b;padding:28px;text-align:center;">
    <div style="font-family:monospace;font-size:20px;color:#00ff88;font-weight:700;">404found.studio</div>
    <div style="font-size:12px;color:#666;margin-top:6px;">Pertanyaan Projek Baru via AI Consultant</div>
  </div>

  <div style="padding:24px 28px;border-bottom:1px solid #eee;">
    <h2 style="margin:0 0 14px;font-size:16px;color:#0a0a0b;">Maklumat Klien</h2>
    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr><td style="padding:5px 0;color:#666;width:110px;">Nama</td><td style="padding:5px 0;font-weight:700;">${name}</td></tr>
      <tr><td style="padding:5px 0;color:#666;">Emel</td><td style="padding:5px 0;"><a href="mailto:${fromEmail}" style="color:#008844;">${fromEmail}</a></td></tr>
      ${phone ? `<tr><td style="padding:5px 0;color:#666;">Telefon</td><td style="padding:5px 0;"><a href="https://wa.me/${phone.replace(/\D/g,'')}?text=Hi+${encodeURIComponent(name)}" style="color:#25D366;">${phone} (WhatsApp)</a></td></tr>` : ''}
    </table>
    ${message ? `<div style="margin-top:14px;padding:14px;background:#f9f9f6;border-radius:8px;font-size:13px;color:#444;line-height:1.7;">${message}</div>` : ''}
  </div>

  ${summary ? `
  <div style="padding:24px 28px;border-bottom:1px solid #eee;">
    <h2 style="margin:0 0 14px;font-size:16px;color:#0a0a0b;">Ringkasan Projek</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;">
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="padding:7px 0;color:#666;border-bottom:1px solid #dcfce7;width:140px;">Jenis Perniagaan</td><td style="padding:7px 0;border-bottom:1px solid #dcfce7;">${summary.businessType || 'N/A'}</td></tr>
        <tr><td style="padding:7px 0;color:#666;border-bottom:1px solid #dcfce7;">Jenis Website</td><td style="padding:7px 0;border-bottom:1px solid #dcfce7;">${summary.websiteType || 'N/A'}</td></tr>
        <tr><td style="padding:7px 0;color:#666;border-bottom:1px solid #dcfce7;">Ciri-ciri</td><td style="padding:7px 0;border-bottom:1px solid #dcfce7;">${features}</td></tr>
        <tr><td style="padding:7px 0;color:#666;border-bottom:1px solid #dcfce7;">Anggaran Harga</td><td style="padding:7px 0;font-weight:700;color:#008844;border-bottom:1px solid #dcfce7;">${summary.estimatedPrice || 'TBD'}</td></tr>
        <tr><td style="padding:7px 0;color:#666;">Tempoh Masa</td><td style="padding:7px 0;">${summary.estimatedTimeline || 'TBD'}</td></tr>
      </table>
    </div>
  </div>` : ''}

  ${convHtml ? `
  <div style="padding:24px 28px;">
    <h2 style="margin:0 0 14px;font-size:16px;color:#0a0a0b;">Sejarah Perbualan</h2>
    ${convHtml}
  </div>` : ''}

  <div style="padding:16px 28px;background:#f5f5f0;border-top:1px solid #eee;text-align:center;">
    <div style="font-size:11px;color:#999;">Dihantar via 404found.studio AI Consultant · hello@404found.studio</div>
  </div>
</div>
</body></html>`;
}

// ── Email Plain Text ────────────────────────────────────────────────────────
function buildEmailText({ name, fromEmail, phone, message, summary, conversation }: any) {
  const lines = [
    '404found.studio — Pertanyaan Projek Baru',
    '==========================================',
    '',
    `Nama:   ${name}`,
    `Emel:   ${fromEmail}`,
    phone ? `Telefon: ${phone}` : '',
    '',
  ].filter(l => l !== undefined);

  if (message) lines.push('Mesej:', message, '');

  if (summary) {
    const features = Array.isArray(summary.features)
      ? summary.features.join(', ')
      : (summary.features || 'N/A');
    lines.push(
      'RINGKASAN PROJEK', '----------------',
      `Jenis Perniagaan: ${summary.businessType || 'N/A'}`,
      `Jenis Website:    ${summary.websiteType || 'N/A'}`,
      `Ciri-ciri:        ${features}`,
      `Anggaran Harga:   ${summary.estimatedPrice || 'TBD'}`,
      `Tempoh Masa:      ${summary.estimatedTimeline || 'TBD'}`,
      '',
    );
  }

  if (conversation?.length) {
    lines.push('PERBUALAN', '---------');
    conversation
      .filter((m: any) => !String(m.content).startsWith('__'))
      .forEach((m: any) => {
        const role  = m.role === 'user' ? name : 'AI';
        const clean = String(m.content)
          .replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g, '')
          .trim();
        lines.push(`[${role}]`, clean, '');
      });
  }

  return lines.join('\n');
}
