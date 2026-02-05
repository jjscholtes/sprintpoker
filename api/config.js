export default function handler(request, response) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    response.status(500).json({
      error:
        "Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables."
    });
    return;
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  });
}
