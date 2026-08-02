const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getPublicSupabaseConfig() {
  if (!publicSupabaseUrl || !publicSupabaseKey) {
    return null;
  }

  return {
    url: publicSupabaseUrl,
    anonKey: publicSupabaseKey
  };
}

export function getRequiredPublicSupabaseConfig() {
  const config = getPublicSupabaseConfig();

  if (!config) {
    throw new Error("Missing public Supabase configuration");
  }

  return config;
}

export function getServerSupabaseServiceRoleKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  );
}
