const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getPublicSupabaseConfig() {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    return null;
  }

  return {
    url: publicSupabaseUrl,
    anonKey: publicSupabaseAnonKey
  };
}

export function getServerSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

