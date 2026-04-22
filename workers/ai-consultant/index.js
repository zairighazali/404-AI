/**
 * 404found.studio — Cloudflare Worker
 * Handles:
 *   POST /api/chat   → Cloudflare Workers AI (streaming)
 *   POST /api/email  → Resend email delivery
 */

// ─── Pricing constants (single source of truth) ─────────────────────────────
const PRICING = {
  base: {
    'Landing Page':       { min: 800,  max: 1500 },
    'Business Website':   { min: 1500, max: 3500 },
    'E-commerce Website': { min: 3000, max: 8000 },
    'Custom System':      null, // quote required
  },
  addons: {
    'Booking System':  500,
    'Online Payment':  800,
    'Blog Setup':      300,
    'Basic SEO Setup': 400,
  },
};

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a professional website consultant for 404found.studio, a web development studio based in Malaysia.

Your job is to help potential clients plan their website project through a friendly conversation.

LANGUAGE RULES:
- If the user writes in Bahasa Melayu → reply ONLY in Bahasa Melayu
- If the user writes in English → reply ONLY in English
- Never mix languages unless the user does

CONSULTATION FLOW (guide naturally, one or two questions at a time):
1. What type of website do they need?
2. What kind of business / industry?
3. What features do they need? (booking, payment, blog, contact form, gallery, etc.)
4. Do they have a domain already?
5. What is their timeline / deadline?
6. What is their approximate budget?

PRICING — use ONLY these prices, never invent others:
Base prices:
- Landing Page: RM800 – RM1,500
- Business Website: RM1,500 – RM3,500
- E-commerce Website: RM3,000 – RM8,000
- Custom System: Quote required

Feature Add-ons:
- Booking System: +RM500
- Online Payment: +RM800
- Blog Setup: +RM300
- Basic SEO Setup: +RM400

PRICE CALCULATION:
When you have enough info, calculate: base price range + applicable add-ons.
Always present as a range. Always add: "Final pricing will be confirmed after a detailed review."

GENERATING PROJECT SUMMARY:
When you have collected enough information (website type + business type + at least 2 features),
embed this JSON block ONCE in your response:

[SUMMARY_START]
{
  "businessType": "...",
  "websiteType": "...",
  "features": ["...", "..."],
  "estimatedPrice": "RM... – RM...",
  "estimatedTimeline": "..."
}
[SUMMARY_END]

TIMELINE ESTIMATES:
- Landing Page: 3–5 working days
- Business Website: 1–2 weeks
- E-commerce: 2–4 weeks
- Custom System: 4–8 weeks

PERSONALITY:
- Warm, professional, helpful
- Never ask more than 2 questions at once
- Keep responses concise and clear`;

// ─── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── Main handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    if (url.pathname === '/api/email' && request.method === 'POST') {
      return handleEmail(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

// ─── Chat handler (Cloudflare Workers AI, streaming) ──────────────────────────
async function handleChat(request, env) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return jsonError('Invalid messages array', 400);
    }

    // Build messages array for Workers AI
    const aiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: String(m.content),
      })),
    ];

    // Stream response from Workers AI
    // Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast (best quality available)
    const stream = await env.AI.run(
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      {
        messages: aiMessages,
        max_tokens: 1024,
        stream: true,
      }
    );

    // Return SSE stream to client
    return new Response(stream, {
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err) {
    console.error('Chat error:', err);
    return jsonError('AI service error: ' + err.message, 500);
  }
}

// ─── Email handler (Resend API) ───────────────────────────────────────────────
async function handleEmail(request, env) {
  try {
    const { name, fromEmail, message, summary, conversation } = await request.json();

    if (!name || !fromEmail) {
      return jsonError('Name and email are required', 400);
    }

    if (!env.RESEND_API_KEY) {
      return jsonError('Email service not configured (RESEND_API_KEY missing)', 500);
    }

    // Build email body
    const emailHtml = buildEmailHtml({ name, fromEmail, message, summary, conversation });
    const emailText = buildEmailText({ name, fromEmail, message, summary, conversation });

    const resendPayload = {
      from: env.RESEND_FROM || 'hello@404found.studio',
      to: [env.RESEND_TO || 'mohdzairighazali@yahoo.com'],
      reply_to: fromEmail,
      subject: `New Project Inquiry from ${name} — 404found.studio`,
      html: emailHtml,
      text: emailText,
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend error:', errBody);
      return jsonError('Failed to send email', 500);
    }

    const resendData = await resendRes.json();
    return jsonResponse({ ok: true, id: resendData.id });

  } catch (err) {
    console.error('Email error:', err);
    return jsonError('Email error: ' + err.message, 500);
  }
}

// ─── Email HTML template ──────────────────────────────────────────────────────
function buildEmailHtml({ name, fromEmail, message, summary, conversation }) {
  const features = summary?.features
    ? (Array.isArray(summary.features) ? summary.features.join(', ') : summary.features)
    : 'N/A';

  const conversationHtml = (conversation || [])
    .filter(m => m.role !== 'system')
    .map(m => {
      const role = m.role === 'user' ? name : '404found.studio AI';
      const bg = m.role === 'user' ? '#f0f9ff' : '#f0fdf4';
      const clean = String(m.content).replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g, '').trim();
      return `<div style="margin-bottom:12px;padding:12px 16px;background:${bg};border-radius:8px;">
        <div style="font-size:11px;font-weight:700;color:#666;margin-bottom:4px;text-transform:uppercase;">${role}</div>
        <div style="font-size:14px;color:#333;white-space:pre-wrap;">${clean}</div>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e0;">
    
    <!-- Header -->
    <div style="background:#0a0a0b;padding:32px;text-align:center;">
      <div style="font-family:'Courier New',monospace;font-size:20px;color:#00ff88;letter-spacing:-0.02em;">404found.studio</div>
      <div style="font-size:13px;color:#666;margin-top:8px;">New Project Inquiry via AI Consultant</div>
    </div>
    
    <!-- Client Info -->
    <div style="padding:28px 32px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0a0a0b;">Client Details</h2>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#666;width:120px;">Name</td><td style="padding:6px 0;font-weight:600;color:#0a0a0b;">${name}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;"><a href="mailto:${fromEmail}" style="color:#008844;">${fromEmail}</a></td></tr>
      </table>
      ${message ? `<div style="margin-top:16px;padding:16px;background:#f9f9f6;border-radius:8px;font-size:14px;color:#444;line-height:1.7;">${message}</div>` : ''}
    </div>

    <!-- Project Summary -->
    ${summary ? `
    <div style="padding:28px 32px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0a0a0b;">Project Summary</h2>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;">
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #dcfce7;width:160px;">Business Type</td><td style="padding:8px 0;color:#0a0a0b;border-bottom:1px solid #dcfce7;">${summary.businessType || 'N/A'}</td></tr>
          <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #dcfce7;">Website Type</td><td style="padding:8px 0;color:#0a0a0b;border-bottom:1px solid #dcfce7;">${summary.websiteType || 'N/A'}</td></tr>
          <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #dcfce7;">Features</td><td style="padding:8px 0;color:#0a0a0b;border-bottom:1px solid #dcfce7;">${features}</td></tr>
          <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #dcfce7;">Estimated Price</td><td style="padding:8px 0;font-weight:700;color:#008844;border-bottom:1px solid #dcfce7;">${summary.estimatedPrice || 'TBD'}</td></tr>
          <tr><td style="padding:8px 0;color:#666;">Timeline</td><td style="padding:8px 0;color:#0a0a0b;">${summary.estimatedTimeline || 'TBD'}</td></tr>
        </table>
      </div>
    </div>` : ''}

    <!-- Conversation -->
    ${conversationHtml ? `
    <div style="padding:28px 32px;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0a0a0b;">Full Conversation</h2>
      ${conversationHtml}
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f5f5f0;border-top:1px solid #eee;text-align:center;">
      <div style="font-size:12px;color:#999;">Sent via 404found.studio AI Consultant · hello@404found.studio</div>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText({ name, fromEmail, message, summary, conversation }) {
  const lines = [
    '404found.studio — New Project Inquiry',
    '======================================',
    '',
    `Name: ${name}`,
    `Email: ${fromEmail}`,
    '',
  ];

  if (message) lines.push('Message:', message, '');

  if (summary) {
    lines.push(
      'PROJECT SUMMARY',
      '---------------',
      `Business Type: ${summary.businessType || 'N/A'}`,
      `Website Type: ${summary.websiteType || 'N/A'}`,
      `Features: ${Array.isArray(summary.features) ? summary.features.join(', ') : (summary.features || 'N/A')}`,
      `Estimated Price: ${summary.estimatedPrice || 'TBD'}`,
      `Timeline: ${summary.estimatedTimeline || 'TBD'}`,
      '',
    );
  }

  if (conversation?.length) {
    lines.push('CONVERSATION HISTORY', '--------------------');
    conversation
      .filter(m => m.role !== 'system')
      .forEach(m => {
        const role = m.role === 'user' ? name : 'AI Consultant';
        const clean = String(m.content).replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g, '').trim();
        lines.push(`[${role}]`, clean, '');
      });
  }

  return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
