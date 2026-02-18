-- Storage RLS policies for user-avatars bucket
-- Flow 7 / F9: Profile Picture Management
--
-- The user-avatars bucket is public-read so avatars can be displayed
-- without auth tokens, but writes are restricted to the owning user.
-- Storage path convention: {userId}/avatar.{ext}
-- The foldername() helper extracts path segments, so [1] = userId.

-- Allow any user (authenticated or anonymous) to view avatar images
-- The bucket is public, so this matches what Supabase Storage already does
-- for public buckets — included for explicitness and documentation.
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

-- Allow authenticated users to upload to ONLY their own folder
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to update (overwrite) ONLY their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to delete ONLY their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
