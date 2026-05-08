-- Profiles RLS hardening (2026-05-08)
--
-- Tidligere policy "Authenticated users can see profiles" gav alle auth-users
-- adgang til alle felter inkl. is_admin, is_suspended, suspended_reason —
-- enumeration-risiko.
--
-- Ny model:
--   1. profiles SELECT er nu SELF-ONLY (auth.uid() = id)
--   2. public_profiles VIEW eksponerer kun safe-felter (id, username, avatar_url,
--      active_title, active_frame) til alle authenticated users
--   3. Server-side kode med supabaseAdmin bypass'er RLS uændret
--
-- Migration er BAGUDKOMPATIBEL: app-kode der kun læser egen profile (via
-- eq('id', auth.uid())) virker som før. Server-side kode med supabaseAdmin
-- virker som før.
--
-- Hvis fremtidig client-kode skal læse andre brugeres username/avatar,
-- skal den bruge public_profiles i stedet for profiles.

-- 1. Drop den åbne SELECT-policy
DROP POLICY IF EXISTS "Authenticated users can see profiles" ON profiles;

-- 2. Tilføj self-only SELECT policy
CREATE POLICY "Users see own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 3. Opret public_profiles view med kun safe-felter (inkl. points til
--    global leaderboard på forsiden)
CREATE OR REPLACE VIEW public_profiles AS
  SELECT
    id,
    username,
    avatar_url,
    active_title,
    active_frame,
    points,
    created_at
  FROM profiles;

-- 4. Grant access — security_invoker=false betyder view'et bypasses RLS
--    på base-tabellen for de eksponerede felter (super-user runs)
ALTER VIEW public_profiles SET (security_invoker = false);

-- 5. Grant SELECT på view til authenticated + anonymous (forsiden er public)
GRANT SELECT ON public_profiles TO authenticated, anon;
