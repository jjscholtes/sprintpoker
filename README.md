# Sprint Poker

A lightweight, real-time planning poker app for agile teams. Create a session, share a link, join with a display name, and estimate together without accounts or logins.

**What it does**
- Creates a shareable session link (`/s/:id`) for a refinement round.
- Lets participants join with a name and emoji avatar.
- Supports hidden voting and simultaneous reveal.
- Provides a simple average of numeric votes after reveal.
- Resets for a new round in one click.

**Main features**
- Real-time updates via Supabase Realtime (votes + session state).
- Optional confidence slider that annotates votes (visualized by clarity/opacity).
- Round timer (1-5 minutes) with a visible countdown.
- Deadlock helper ("Devil's Advocate") that kicks in after repeated split votes and prompts a short re-discussion.
- Session expiry after 3 hours of inactivity (client-side check + server time sync).

## Setup

### 1) Create a Supabase project
1. Create a new Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy your `Project URL` and `anon` key (Project Settings -> API).

### 2) Configure keys
The app reads config from either `config.json` (local) or `/api/config` (Vercel).

**Local config**
1. Copy `config.example.json` to `config.json`.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

`config.json` is already gitignored.

### 3) Run locally
Use any static server:

```bash
python3 -m http.server
```

Open `http://localhost:8000`.

## Deploy to Vercel
- Framework preset: `Other`
- Build command: `none`
- Output directory: `/` (root)
- Add Environment Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

`vercel.json` rewrites `/s/:id` to `index.html` for shareable sessions.

## Notes
- The Supabase keys are public client keys; do not put secrets in the frontend.
- The app calls `/api/config` in production to expose only the public keys.
- If you previously ran the schema, re-run `supabase/schema.sql` to ensure `server_time()` and confidence columns exist.

## License
MIT
