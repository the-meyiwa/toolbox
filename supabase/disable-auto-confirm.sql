-- ============================================================
-- TOOLBOX — Disable Auto-Confirm Trigger for Email Verification
-- Run this script in the Supabase SQL Editor to ensure new signups
-- require email confirmation before an active session is issued.
-- ============================================================

-- 1. Remove the auto-confirm trigger and procedure on auth.users
DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_user();

-- Note: In the Supabase Dashboard, also ensure:
-- Authentication -> Providers -> Email -> "Confirm email" is enabled (ON).
