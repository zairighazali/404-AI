# 404found.studio — Setup Guide

> **Bilingual Guide: Bahasa Melayu + English**

---

## 🤖 Macam Mana AI Agent Berfungsi? (Flow Lengkap)

### Dari perspektif user (pelawat website kau):

```
1. User buka 404found.studio
         ↓
2. AI greet user:
   "Hi! I'm the 404found.studio AI consultant.
    What kind of website are you looking to build?"
         ↓
3. AI tanya soalan satu-satu (bukan semua sekaligus):
   • Jenis website? (Landing page / business / e-commerce)
   • Jenis bisnes?
   • Feature yang nak? (booking, payment, blog, dll)
   • Ada domain dah?
   • Timeline bila nak siap?
   • Budget dalam range mana?
         ↓
4. AI kira harga automatik berdasarkan jawapan user:
   Base price + add-ons = estimated range
   Contoh: "Business Website (RM1,500-3,500) + Booking (+RM500)
            = Estimated: RM2,000 - RM4,000"
         ↓
5. AI generate Project Summary Card dalam chat:
   +----------------------------------+
   | Project Summary                  |
   | Business: Restaurant             |
   | Website: Business Website        |
   | Features: Menu, Booking          |
   | Price: RM2,000 - RM4,000         |
   | Timeline: 1-2 weeks              |
   +----------------------------------+
         ↓
6. Tiga butang muncul untuk user pilih:
   [Start Your Project]     -> /contact page
   [Send Project via Email] -> modal muncul, user isi nama+email,
                               email hantar terus ke kau
   [Chat on WhatsApp]       -> WhatsApp kau dengan pre-filled message
```

### Dari perspektif kau (owner):

```
Bila user klik "Send Project via Email":
  -> Kau dapat email di mohdzairighazali@yahoo.com
  -> Email contain:
     • Nama & email user
     • Project Summary (website type, features, price estimate)
     • Seluruh conversation history dengan AI
     • Additional message dari user (optional)

Bila user klik "Chat on WhatsApp":
  -> WhatsApp kau dibuka dengan mesej pre-filled:
    "Hi, I just discussed my website project with your AI assistant.
     Business: Restaurant, Website: Business Website,
     Budget: RM2,000 - RM4,000"
```

Jadi kau TAK PERLU buat apa-apa — AI yang collect semua info,
estimate harga, dan route client terus ke kau.

---

## 🔑 Setup Environment Variables

### Untuk Local Development (.env.local)

Buat fail baru bernama `.env.local` dalam folder project kau:

```bash
cp .env.local.example .env.local
```

Pastu edit `.env.local` dengan text editor kau:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM=hello@404found.studio
RESEND_TO=mohdzairighazali@yahoo.com
```

PENTING: .env.local JANGAN di-commit ke GitHub. Ia dah ada dalam .gitignore.

---

### Untuk Cloudflare Pages (Production)

Env vars TIDAK letak dalam .env file untuk production.
Kau set terus dalam Cloudflare Dashboard:

  Cloudflare Dashboard
    -> Pages
    -> 404found-studio (project kau)
    -> Settings
    -> Environment Variables
    -> Add variable

| Variable        | Value                           | Type           |
|-----------------|---------------------------------|----------------|
| RESEND_FROM     | hello@404found.studio           | Plain text     |
| RESEND_TO       | mohdzairighazali@yahoo.com      | Plain text     |
| RESEND_API_KEY  | re_xxxxxxxxxxxx                 | Secret/Encrypt |

---

## 📦 Installation & Setup

### Step 1 — Install dependencies

```bash
cd 404found-studio
npm install
```

### Step 2 — Setup .env.local

```bash
cp .env.local.example .env.local
# Edit .env.local dengan text editor
```

### Step 3 — Setup Resend (untuk email berfungsi)

1. Pergi resend.com -> Sign up (free)
2. Add Domain: Settings -> Domains -> Add -> masuk "404found.studio"
3. Resend bagi DNS records -> tambah dalam Cloudflare DNS kau
4. Tunggu verify (5-30 minit)
5. Create API Key: API Keys -> Create -> copy
6. Paste dalam .env.local sebagai RESEND_API_KEY

### Step 4 — Run locally

```bash
npm run dev
# Buka http://localhost:4321
```

Note: AI chat akan fallback ke static message dalam local dev
sebab env.AI (Workers AI) hanya available dalam Cloudflare.
Untuk test AI locally: wrangler pages dev dist

---

## 🚀 Deploy ke Cloudflare Pages

### Cara 1: Via GitHub (Recommended)

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/USERNAME/404found-studio.git
git push -u origin main
```

Pastu dalam Cloudflare Dashboard:
1. Pages -> Create a project -> Connect to Git
2. Pilih repo kau
3. Build settings:
   - Framework: Astro
   - Build command: npm run build
   - Output directory: dist
4. Save and Deploy

Lepas deploy:
- Set Environment Variables (tengok section atas)
- Settings -> Functions -> AI Bindings -> Add: variable name "AI"

### Cara 2: Via CLI

```bash
npm run build
npx wrangler pages deploy dist --project-name=404found-studio
```

---

## 🌐 Custom Domain

1. Cloudflare Dashboard -> Pages -> project -> Custom domains
2. Add "404found.studio"
3. Cloudflare auto-setup DNS + SSL

---

## 📁 Struktur Project

```
404found-studio/
|
+-- .env.local.example     <- Template (salin jadi .env.local)
+-- .env.local             <- Env vars kau (JANGAN commit!)
+-- .gitignore
|
+-- src/
|   +-- layouts/
|   |   +-- Base.astro          <- HTML shell, CSS vars, fonts
|   |
|   +-- components/
|   |   +-- Navbar.astro        <- Navigation + theme toggle
|   |   +-- Chat.astro          <- AI consultant (MAIN FEATURE)
|   |   +-- Footer.astro        <- Footer links
|   |
|   +-- pages/
|       +-- index.astro         <- Homepage
|       +-- services.astro
|       +-- pricing.astro
|       +-- about.astro
|       +-- contact.astro
|       |
|       +-- blog/               <- 4 SEO blog posts
|       |   +-- index.astro
|       |   +-- how-much-does-a-website-cost-malaysia.astro
|       |   +-- types-of-business-websites.astro
|       |   +-- ecommerce-vs-landing-page.astro
|       |   +-- how-long-to-build-a-website.astro
|       |
|       +-- api/
|           +-- chat.ts         <- POST /api/chat -> Workers AI
|           +-- email.ts        <- POST /api/email -> Resend
|
+-- workers/
|   +-- ai-consultant/
|       +-- index.js            <- Standalone Worker (alternative)
|
+-- public/
    +-- favicon.svg
    +-- robots.txt
    +-- _redirects
```

---

## Nak Tukar Apa-apa?

Nombor WhatsApp:
  Cari "601155525587" dalam src/components/Chat.astro

Email penerima:
  Tukar RESEND_TO dalam .env.local dan Cloudflare Dashboard

Pricing:
  Edit system prompt dalam src/pages/api/chat.ts

Warna accent (hijau):
  Edit "--accent: #00ff88" dalam src/layouts/Base.astro

---

## Troubleshooting

AI tidak respond:
  -> Pastikan AI binding dah enable dalam Cloudflare Pages settings
  -> Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast

Email tak hantar:
  -> Semak RESEND_API_KEY dalam Cloudflare env vars
  -> Pastikan domain dah verify dalam Resend dashboard

Website error masa build:
  -> Run "npm run build" dan tengok error
  -> Pastikan Node.js 20+

---

Support: hello@404found.studio | WhatsApp +601155525587
