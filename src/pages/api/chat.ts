
// src/pages/api/chat.ts
// Menggunakan Google Gemini 1.5 Flash — BM lebih bagus, free tier 1500 req/hari
// Tukar ke Cloudflare Workers AI: uncomment bahagian CF AI di bawah

import type { APIRoute } from 'astro';

const SYSTEM_PROMPT = `Kamu adalah ejen AI konsultan web profesional untuk 404found.studio, sebuah web studio yang berpangkalan di Malaysia.

Tugas kamu adalah membantu pelawat merancang projek website mereka melalui perbualan yang mesra dan profesional, sambil mengumpul maklumat penting untuk dihubungi semula.

=== PERATURAN BAHASA ===
- Jika pengguna menulis dalam Bahasa Melayu → balas HANYA dalam Bahasa Melayu
- Jika pengguna menulis dalam English → balas HANYA dalam English
- Jangan campur bahasa melainkan pengguna sendiri yang campur

=== ALIRAN KONSULTASI ===
Tanya soalan secara berperingkat — jangan tanya semua sekaligus. Maksimum 2 soalan dalam satu masa.

ALIRAN PERBUALAN — ikut urutan ini dengan ketat:

FASA 1: Fahami projek (tanya soalan ini satu-satu, maksimum 2 soalan sekaligus):
- Jenis website yang diperlukan? (landing page / business website / e-commerce / custom)
- Jenis perniagaan / industri?
- Ciri-ciri yang diperlukan? (tempahan, bayaran online, blog, galeri, dll)
- Ada domain sendiri dah?
- Bila nak siap? (timeline)
- Bajet lebih kurang berapa?

FASA 2: WAJIB tanya maklumat hubungan SEBELUM generate summary.
Bila dah faham projek, MESTI tanya:
"Untuk saya sediakan sebutharga dan hubungi anda semula, boleh saya dapatkan maklumat berikut:
1. Nama penuh anda?
2. Nombor WhatsApp?
3. Alamat emel?"

JANGAN generate [SUMMARY_START] sehingga kamu ada SEMUA ini:
✓ Jenis website
✓ Jenis perniagaan
✓ Sekurang-kurangnya 1 ciri
✓ Nama klien
✓ Nombor telefon klien
✓ Emel klien


Simpan maklumat ini dalam summary JSON di bawah.

=== HARGA (gunakan HANYA harga ini, jangan reka-reka) ===
Harga asas:
- Landing Page: RM500 – RM1,000
- Business Website: RM1,500 – RM5,500
- E-commerce Website: RM5,000 – RM20,000
- Custom System: Sebutharga diperlukan

Tambahan ciri:
- Sistem Tempahan: +RM500
- Pembayaran Online: +RM800
- Setup Blog: +RM300
- Setup SEO Asas: +RM200

=== PENGIRAAN HARGA ===
Kira: harga asas + tambahan yang berkaitan = jumlah anggaran
Sentiasa tunjukkan sebagai julat harga. Sentiasa tambah: "Harga muktamad akan disahkan selepas semakan terperinci projek anda."

=== JANA PROJECT SUMMARY ===
Selepas mendapat maklumat projek DAN maklumat hubungan pengguna, jana summary menggunakan format JSON ini SEKALI sahaja dalam respons kamu:

[SUMMARY_START]
{
  "clientName": "...",
  "clientPhone": "...",
  "clientEmail": "...",
  "businessType": "...",
  "websiteType": "...",
  "features": ["...", "..."],
  "estimatedPrice": "RM... – RM...",
  "estimatedTimeline": "..."
}
[SUMMARY_END]

=== ANGGARAN MASA ===
- Landing Page: 3–5 hari bekerja
- Business Website: 1–2 minggu
- E-commerce: 2–4 minggu
- Custom System: 4–8 minggu

=== PERIBADI ===
- Bahasakan diri sebagai EIN, kawan yang membantu, bukan jualan keras
- Mesra, profesional, membantu
- Jangan terlalu formal atau kaku
- Jangan tanya lebih 2 soalan sekaligus
- Respons ringkas dan jelas
- Galakkan pengguna untuk teruskan — ini langkah pertama untuk website impian mereka`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Baca API key dari environment
    // @ts-ignore
    const env = (locals as any).runtime?.env ?? {};
    const GEMINI_KEY = env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY;

    // ── OPTION A: Google Gemini (default — BM lebih bagus) ──────────────────
    if (GEMINI_KEY) {
      return await callGemini(messages, GEMINI_KEY);
    }

    // ── OPTION B: Cloudflare Workers AI (fallback jika tiada Gemini key) ───
    const AI = env.AI;
    if (AI) {
      return await callWorkersAI(messages, AI);
    }

    // ── FALLBACK: Tiada AI configured ───────────────────────────────────────
    return streamText(
      "Hai! Saya ejen AI 404found.studio. Maaf, sistem AI sedang dalam persediaan. " +
      "Sila hubungi kami terus di hello@404found.studio atau WhatsApp +601155525587. Terima kasih!"
    );

  } catch (err: any) {
    console.error('Chat API error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
};

// ── Google Gemini ──────────────────────────────────────────────────────────
// Cuba model-model ini ikut urutan keutamaan — kalau satu gagal, cuba seterusnya
const GEMINI_MODELS = [
  'gemini-2.5-flash',          // Paling baru, laju, percuma
  'gemini-2.5-flash-lite',     // Lebih ringan
  'gemini-2.0-flash',            
];

async function callGemini(messages: any[], apiKey: string) {
  // Convert messages format untuk Gemini
  // Gemini guna "user" dan "model" (bukan "assistant")
  const geminiMessages = messages
    .filter((m: any) => !String(m.content).startsWith('__'))
    .map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: String(m.content) }],
    }));

  // Pastikan bermula dengan 'user' (Gemini requirement)
  if (geminiMessages.length === 0 || geminiMessages[0].role !== 'user') {
    geminiMessages.unshift({
      role: 'user',
      parts: [{ text: 'Mulakan perbualan' }],
    });
  }

  // Gabungkan mesej user berturut-turut (Gemini tak benarkan dua 'user' berturut-turut)
  const merged: any[] = [];
  for (const msg of geminiMessages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.parts[0].text += '\n' + msg.parts[0].text;
    } else {
      merged.push({ ...msg, parts: [{ text: msg.parts[0].text }] });
    }
  }

  const body = {
  contents: [
    {
      role: "user",
      parts: [{ text: SYSTEM_PROMPT }],
    },
    ...merged,
  ],
  generationConfig: {
    maxOutputTokens: 1024,
    temperature: 0.7,
  },
};

  // Cuba setiap model sehingga berjaya
  let lastError = '';
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      console.log(`✓ Gemini model digunakan: ${model}`);
      // Teruskan dengan response ini
      return buildGeminiStream(res);
    }

    const errText = await res.text();
    lastError = errText;

    // Kalau error bukan 404 (model tak jumpa), jangan cuba model lain
    // Kalau quota / rate limit → cuba model lain
if (res.status === 429 || res.status === 503) {
  console.warn(`Model ${model} kena limit, cuba seterusnya...`);
  continue;
}

// Kalau model tak wujud → cuba model lain
if (res.status === 404) {
  console.warn(`Model ${model} tak jumpa, cuba seterusnya...`);
  continue;
}

// Error lain → stop
console.error(`Gemini error (${model}):`, errText);
throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  // 🔥 TAMBAH INI (penting)
  console.error('Semua Gemini model gagal:', lastError);
  throw new Error('Tiada model Gemini yang berfungsi. Semak API key anda.');
}

// Transform Gemini SSE response → format SSE yang difahami frontend kita
// Gemini: data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
// Kita:   data: {"response":"..."}
function buildGeminiStream(res: Response) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ response: text })}\n\n`)
                );
              }
            } catch {}
          }
        }
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ── Cloudflare Workers AI ──────────────────────────────────────────────────
async function callWorkersAI(messages: any[], AI: any) {
  const aiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages
      .filter((m: any) => !String(m.content).startsWith('__'))
      .map((m: any) => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: String(m.content),
      })),
  ];

  const stream = await AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: aiMessages,
    max_tokens: 1024,
    stream: true,
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

// ── Helper: stream teks statik ─────────────────────────────────────────────
function streamText(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Hantar dalam chunk kecil untuk kesan streaming
      const words = text.split(' ');
      let i = 0;
      const tick = setInterval(() => {
        if (i >= words.length) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          clearInterval(tick);
          return;
        }
        const token = (i === 0 ? '' : ' ') + words[i++];
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ response: token })}\n\n`)
        );
      }, 30);
    },
  });
  return new Response(stream, {
    headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

export const OPTIONS: APIRoute = async () =>
  new Response(null, { headers: CORS });