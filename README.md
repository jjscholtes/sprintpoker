# Sprint Poker (Vercel + Supabase)

## Setup (Supabase)
1. Maak een Supabase project aan.
2. Open de SQL editor en run `supabase/schema.sql`.
3. Pak je `Project URL` en `anon` key (Project Settings → API).
4. Vul `SUPABASE_URL` en `SUPABASE_ANON_KEY` in `config.json` (lokaal) of als Vercel Environment Variables (deploy).

### Lokale config
- Kopieer `config.example.json` naar `config.json` en vul je waarden in.
- `config.json` staat in `.gitignore` zodat keys niet in Git belanden.

## Lokaal testen
Gebruik een simpele static server:
```
python3 -m http.server
```
Open daarna `http://localhost:8000`.

## Deploy op Vercel
- Framework preset: **Other**
- Build command: **none**
- Output directory: **/** (root)
- `vercel.json` zorgt dat `/s/:id` naar `index.html` rewritet.
- Zet environment variables in Vercel:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- De app haalt deze op via `/api/config`.

## Opmerkingen
- Sessies verlopen na 3 uur inactiviteit (client-side check).
- `server_time()` RPC wordt gebruikt om server-tijd te synchroniseren. Als je het schema al eerder draaide, run `supabase/schema.sql` opnieuw om de functie toe te voegen.
- Realtime updates lopen via Supabase Realtime (votes + sessiestatus).
- Let op: client-side keys zijn zichtbaar voor gebruikers. Gebruik alleen public/anon keys in de frontend; echte secrets horen in server-side functies.
