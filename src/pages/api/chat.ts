// src/pages/api/chat.ts
// OpenAI GPT-4o mini — murah, pantas, sesuai untuk consultation chatbot
// ~USD0.15 per 1M input tokens, ~USD0.60 per 1M output tokens

import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/env';

// ── System prompt — ringkas untuk jimat token ─────────────────────────────
// Lebih pendek = lebih murah. Setiap request hantar system prompt ini.
const SYSTEM_PROMPT = `Kamu adalah konsultan web untuk 404found.studio (Malaysia).

=== LANGUAGE MODE (PENTING) ===
Tentukan bahasa berdasarkan mesej TERKINI pengguna.

- Jika pengguna guna English → set LANGUAGE = EN
- Jika pengguna guna Bahasa Melayu → set LANGUAGE = BM
- Jika mesej pendek/tidak jelas → kekalkan LANGUAGE sebelumnya

KEKALKAN bahasa ini untuk keseluruhan respon, termasuk:
- Soalan seterusnya
- Summary
- Arahan (CTA SEND / WHATSAPP)

JANGAN tukar bahasa secara automatik walaupun sistem prompt dalam BM.
FOKUS: Hanya jawab soalan berkaitan website, web development, dan projek klien.
Soalan lain (politik, hiburan, dll) → jawab pendek: "Saya hanya boleh membantu tentang projek website anda, nak gosip jom la ngeteh. Ada soalan tentang website?"

ALIRAN — tanya satu-satu, jangan tanya semua sekaligus:
Fasa 1 (Projek): jenis website → jenis perniagaan → ciri-ciri → domain → timeline → bajet
Fasa 2 (Hubungan): nama penuh → nombor WhatsApp → alamat emel

JANGAN jana summary sehingga ada: jenis website + perniagaan + ≥1 ciri + nama + telefon + emel.

HARGA (jangan reka harga lain):
- Landing Page: RM500–RM1,500
- Business Website: RM1,500–RM5,500
- E-commerce: RM5,000–RM20,000
- Custom System: Sebutharga
Tambahan: Tempahan +RM500 | Bayaran Online +RM800 | Blog +RM300 | SEO +RM400

JANA SUMMARY — bila semua maklumat lengkap, tulis teks natural KEMUDIAN letak JSON:

[SUMMARY_START]
{"clientName":"...","clientPhone":"...","clientEmail":"...","businessType":"...","websiteType":"...","features":["..."],"estimatedPrice":"RM...–RM...","estimatedTimeline":"..."}
[SUMMARY_END]

SELEPAS summary, WAJIB tulis ayat ini (dalam bahasa yang sesuai):

SELEPAS summary:

Jika LANGUAGE = BM:
"Untuk menghantar butiran projek ini kepada pasukan kami, sila taip **HANTAR** untuk email atau **WHATSAPP** untuk terus berbual via WhatsApp."

Jika LANGUAGE = EN:
"To send your project details to our team, type **SEND** for email or **WHATSAPP** to chat directly."

TIMELINE: Landing Page 3–5 hari | Business 1–2 minggu | E-commerce 2–4 minggu | Custom 4–8 minggu

=== PERIBADI ===
- Bahasakan diri sebagai EIN, kawan yang membantu, bukan jualan keras
- Mesra, profesional, membantu
- Jangan terlalu formal atau kaku
- Jangan tanya lebih 2 soalan sekaligus
- Respons ringkas dan jelas
- Galakkan pengguna untuk teruskan — ini langkah pertama untuk website impian mereka
- Max 3 ayat per respons kecuali jana summary.`;

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

// Detect sama ada user menaip command HANTAR / SEND / WHATSAPP
export function detectCommand(text: string): 'send_email' | 'whatsapp' | null {
  const t = text.trim().toUpperCase();
  if (/^(HANTAR|SEND|EMAIL|EMEL)$/.test(t)) return 'send_email';
  if (/^(WHATSAPP|WA|WASAP)$/.test(t)) return 'whatsapp';
  return null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { messages, summary } = body;

    if (!Array.isArray(messages)) {
      return jsonResp({ error: 'messages mestilah array' }, 400);
    }

    // Semak command dari mesej terakhir user
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      const cmd = detectCommand(String(lastMsg.content));
      if (cmd === 'send_email') {
        return jsonResp({ command: 'send_email', reply: null });
      }
      if (cmd === 'whatsapp') {
        return jsonResp({ command: 'whatsapp', reply: null });
      }
    }

    const OPENAI_KEY = getEnv(locals, 'OPENAI_API_KEY');
    console.log('[chat] OPENAI_KEY ada:', OPENAI_KEY.length > 0);

    if (!OPENAI_KEY) {
      return jsonResp({
        reply: 'Maaf, sistem AI sedang dalam penyelenggaraan. Sila cuba sebentar lagi atau WhatsApp +601155525587 untuk set masa kita kopi.'
      });
    }

    // Bina messages untuk OpenAI
    const openaiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
        .filter((m: any) => !String(m.content).startsWith('__'))
        .map((m: any) => ({
          role: m.role === 'ai' ? 'assistant' : m.role as string,
          content: String(m.content),
        })),
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',          // Paling murah, sesuai untuk chatbot
        messages: openaiMessages,
        max_tokens: 600,               // Jimat token — cukup untuk respons consultation
        temperature: 0.5,             // Lebih consistent, kurang "creative"
        presence_penalty: 0.1,        // Elak ulangan
      }),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      console.error('[openai] error:', res.status, JSON.stringify(err));

      if (res.status === 401) {
        return jsonResp({ error: 'OPENAI_API_KEY tidak sah. Semak dalam Cloudflare Dashboard.' }, 500);
      }
      if (res.status === 429) {
        return jsonResp({ reply: 'Permintaan terlalu banyak sekarang. Sila cuba sebentar lagi, atau hubungi kami terus via WhatsApp.' });
      }
      return jsonResp({ error: `OpenAI error: ${res.status}` }, 500);
    }

    const data = await res.json() as any;
    const reply = data?.choices?.[0]?.message?.content ?? '';

    // Log token usage untuk monitor kos
    const usage = data?.usage;
    if (usage) {
      console.log(`[openai] tokens — input: ${usage.prompt_tokens}, output: ${usage.completion_tokens}, total: ${usage.total_tokens}`);
    }

    return jsonResp({ reply });

  } catch (err: any) {
    console.error('[chat] exception:', err?.message);
    return jsonResp({ error: err?.message ?? 'Unknown error' }, 500);
  }
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { headers: CORS });
