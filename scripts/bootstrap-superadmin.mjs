import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serverKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SWIFTWALLET_BOOTSTRAP_SUPERADMIN_EMAIL
  ?.trim()
  .toLowerCase();
const fullName = process.env.SWIFTWALLET_BOOTSTRAP_SUPERADMIN_NAME?.trim();
const password = process.env.SWIFTWALLET_BOOTSTRAP_SUPERADMIN_PASSWORD;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY", serverKey],
  ["SWIFTWALLET_BOOTSTRAP_SUPERADMIN_EMAIL", email],
  ["SWIFTWALLET_BOOTSTRAP_SUPERADMIN_NAME", fullName],
  ["SWIFTWALLET_BOOTSTRAP_SUPERADMIN_PASSWORD", password]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("The bootstrap Superadmin email is invalid");
}

if (fullName.length < 2) {
  throw new Error("The bootstrap Superadmin name must contain at least 2 characters");
}

if (password.length < 12 || password.length > 72) {
  throw new Error("The bootstrap Superadmin password must contain 12 to 72 characters");
}

const supabase = createClient(supabaseUrl, serverKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const { data: existingProfiles, error: existingProfileError } = await supabase
  .from("staff_profiles")
  .select("id,email,full_name,role,status,tenant_id")
  .eq("email", email);

if (existingProfileError) {
  throw new Error(`Unable to check existing staff profiles: ${existingProfileError.message}`);
}

if (existingProfiles.length > 0) {
  const profile = existingProfiles[0];

  if (
    profile.role === "SUPERADMIN" &&
    profile.status === "ACTIVE" &&
    profile.tenant_id === null
  ) {
    console.log("Bootstrap Superadmin already exists and is active");
    process.exit(0);
  }

  throw new Error("The bootstrap email already belongs to a non-Superadmin profile");
}

const { data: authData, error: authError } =
  await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

if (authError || !authData.user) {
  throw new Error(`Unable to create the Auth user: ${authError?.message ?? "unknown error"}`);
}

const { error: profileError } = await supabase.from("staff_profiles").insert({
  id: authData.user.id,
  tenant_id: null,
  email,
  full_name: fullName,
  role: "SUPERADMIN",
  status: "ACTIVE"
});

if (profileError) {
  const { error: cleanupError } = await supabase.auth.admin.deleteUser(
    authData.user.id
  );

  if (cleanupError) {
    throw new Error(
      `Unable to create the Superadmin profile and Auth cleanup failed: ${profileError.message}`
    );
  }

  throw new Error(`Unable to create the Superadmin profile: ${profileError.message}`);
}

console.log("Bootstrap Superadmin created successfully");
