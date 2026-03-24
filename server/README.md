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

## Realtime Protocol

Connect WebSocket:

- `ws://localhost:3000/ws/collab?token=<supabase_access_token>`

Messages:

- `{"type":"join","manuscriptId":"<uuid>"}`
- `{"type":"doc_update","manuscriptId":"<uuid>","update":"<base64-yjs-update>"}`
- `{"type":"presence","manuscriptId":"<uuid>","state":{...}}`
- `{"type":"comments","manuscriptId":"<uuid>","payload":{...}}`

