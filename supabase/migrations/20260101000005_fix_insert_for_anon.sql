-- DIAGNOSTIC: Check what policies currently exist on puppies
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'puppies'
ORDER BY cmd;
