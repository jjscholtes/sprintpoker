# Project Architecture

## Architecture Overview
A static single-page web app hosted on **Vercel** with **Supabase** providing data storage and realtime updates.

Components:
- **Frontend (Vercel)**: Static HTML/CSS/JS app. Uses Supabase JS client to read/write session data and subscribe to realtime changes.
- **Supabase Postgres**: Stores sessions and votes.
- **Supabase Realtime**: Delivers live updates for votes and session state; Presence used for participant list.

Flow:
1. User opens landing page and clicks “Create session”.
2. Client generates a session ID, inserts a `sessions` row, and redirects to `/s/:sessionId` (Vercel rewrite to SPA).
3. Participants open the link, enter a display name, and join a Realtime channel with Presence metadata.
4. Votes are written to `votes` table; Realtime subscriptions update all clients.
5. Any participant can “Reveal” (update `sessions.revealed = true`) or “New round” (delete votes + set `revealed = false`).
6. If `last_activity_at` is older than 3 hours, the client treats the session as expired and shows a new-session action.

## Constraints from projectplan.md
- No login/accounts; access is via shareable session link.
- Everyone has the same permissions (anyone can reveal/reset).
- Real-time updates required (reveal is visible instantly to everyone).
- Show average after reveal (numeric cards only).
- Sessions expire after 3 hours of inactivity.
- UI should be minimalistic but visually pleasant; easy to host.

## Technology Stack
- **Frontend**: Vanilla HTML/CSS/JS (no build step) hosted on Vercel.
- **Backend**: Supabase (Postgres + Realtime + Presence).
- **Client library**: `@supabase/supabase-js` via CDN ESM.

Rationale: Vercel serves a fast static app; Supabase provides realtime and persistence on a free tier without running servers.

## Data Models
**sessions**
- `id`: text (UUID, primary key)
- `created_at`: timestamp (default now())
- `last_activity_at`: timestamp (default now())
- `revealed`: boolean (default false)

**votes**
- `id`: uuid (primary key)
- `session_id`: text (FK to sessions.id)
- `participant_id`: text (client-generated)
- `value`: text (e.g., "5", "?", "coffee")
- `created_at`: timestamp (default now())
- `updated_at`: timestamp (default now())
- Unique constraint: (`session_id`, `participant_id`) so each participant has one active vote.

**Derived State (client)**
- `participants`: from Realtime Presence; each has `{ id, name }`.
- `hasVoted`: computed by checking votes for participant IDs.
- `average`: computed from numeric `value` only; if none, show `N/A`.

## API Design
No custom REST API. All operations use Supabase JS client:
- `insert` into `sessions` to create a session.
- `select` session by ID to join.
- `update` session (`revealed`, `last_activity_at`).
- `insert`/`update` vote per participant.
- `delete` votes on reset.
- Realtime subscriptions:
  - `postgres_changes` on `sessions` row
  - `postgres_changes` on `votes` for the session
  - Presence on a `realtime` channel per session

## Security / Access
- No user accounts. Client uses Supabase `anon` key.
- RLS enabled with permissive policies (public access) relying on unguessable session IDs. This fits the low-risk, personal-use scenario. If stronger access is needed later, add Edge Functions and stricter RLS.

## Implementation Strategy
1. **Supabase setup**: create tables, constraints, and RLS policies. Enable Realtime on `sessions` and `votes`.
2. **Frontend**:
   - Landing page to create session.
   - Session page: join by name, connect to Realtime channel, render participants and votes.
3. **Realtime sync**:
   - Subscribe to votes and session updates.
   - Presence to display participant list.
4. **Session expiry**:
   - On join and each action, fetch `last_activity_at`; if older than 3 hours, show expired state.
   - Update `last_activity_at` on vote/reveal/reset.

## Risks and Mitigations
- **Public RLS policy**: Acceptable for personal use; rely on unguessable session IDs. Document the tradeoff.
- **No server-side expiry enforcement**: Use client checks; can add scheduled cleanup later if needed.
- **Realtime limits (free tier)**: Keep payloads small; typical small team size fits within free tier limits.
