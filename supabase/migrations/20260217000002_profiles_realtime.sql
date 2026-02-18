-- Enable Supabase Realtime on the profiles table
-- Flow 7 / F9: Profile Picture Management
--
-- REPLICA IDENTITY FULL is required so that Realtime broadcasts the full
-- row (old + new values) on UPDATE events. Without it, only the primary
-- key is available in the payload, which is insufficient for the client
-- to know which column changed.
--
-- Adding profiles to supabase_realtime publication makes INSERT/UPDATE/DELETE
-- events available via the Supabase Realtime API (postgres_changes channel).

ALTER TABLE profiles REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
