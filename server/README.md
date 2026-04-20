# Journi Backend

This backend now provides:

- Supabase-backed auth (email/password + OAuth bootstrap)
- Organization + membership role model (`owner`, `admin`, `editor`, `viewer`)
- Journal API (`GET /api/journals`, `GET /api/journals/:id`, import + sync)
- Project/manuscript/comment APIs
- Yjs real-time collaboration WebSocket (`/ws/collab`)
- Audit and notification records

## Setup

1. Copy `.env.example` to `.env` and fill Supabase credentials.
2. Apply SQL migration in your Supabase SQL editor:
   - `server/sql/001_initial_schema.sql`
3. Install deps and run:
   - `npm install`
   - `npm run dev`

## Email Setup (Railway + Journi domain)

Configure these Railway environment variables:

- `MAIL_FROM=info@journie.io`
- `MAIL_REPLY_TO=help@journie.io`
- `SUPPORT_EMAIL=help@journie.io`
- `RESEND_API_KEY=<your_resend_api_key>`
- `INTERNAL_ADMIN_EMAILS=<comma-separated internal staff emails>`
- `RESET_PASSWORD_REDIRECT_URL=https://<your-domain>/reset-password` (optional override)

What Journi now sends:

- Sign-up verification email (from `info@journie.io`)
- Post-verification welcome email (from `info@journie.io`)
- Team invite email (from `info@journie.io`)
- Mention notification emails (from `info@journie.io`)
- Password reset emails through the app mailer (`/api/auth/forgot-password`)

Supabase Auth requirements:

- Enable email confirmation in Supabase Auth settings.
- Add your frontend URLs to Supabase Auth redirect URL allowlists.
- Journi generates auth action links through Supabase Admin and delivers them through Resend, so Supabase SMTP/templates are not used for signup verification or password reset.

Inbound support mailbox:

- Create `help@journie.io` with your mailbox provider (Google Workspace/Zoho/etc).
- Point domain MX records to that provider.

## Realtime Protocol

Connect WebSocket:

- `ws://localhost:3000/ws/collab?token=<supabase_access_token>`

Messages:

- `{"type":"join","manuscriptId":"<uuid>"}`
- `{"type":"doc_update","manuscriptId":"<uuid>","update":"<base64-yjs-update>"}`
- `{"type":"presence","manuscriptId":"<uuid>","state":{...}}`
- `{"type":"comments","manuscriptId":"<uuid>","payload":{...}}`

