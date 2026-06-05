-- Tighten profiles SELECT policy
-- Previously: any authenticated user could read ALL profiles
-- Now: users can only see their own profile + profiles of people who share a puppy with them

DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Users can view own and co-member profiles"
  ON profiles FOR SELECT
  USING (
    -- Own profile
    auth.uid() = id
    OR
    -- Co-members: users who share at least one puppy via puppy_memberships
    id IN (
      SELECT pm2.user_id
      FROM puppy_memberships pm1
      JOIN puppy_memberships pm2 ON pm1.puppy_id = pm2.puppy_id
      WHERE pm1.user_id = auth.uid()
        AND pm1.status = 'active'
        AND pm2.status = 'active'
    )
  );
