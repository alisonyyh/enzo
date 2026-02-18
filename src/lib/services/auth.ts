import { supabase } from '../supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../database.types';

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function updateProfile(userId: string, updates: { display_name?: string; avatar_url?: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${userId}/avatar.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('user-avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('user-avatars')
    .getPublicUrl(fileName);

  // Cache-bust so stale images aren't served
  return `${publicUrl}?v=${Date.now()}`;
}

// Subscribe to avatar_url changes for a set of user IDs.
// Used by Dashboard to update task completion indicators in real-time
// when a co-user (owner or caretaker) changes their profile picture.
// Returns an unsubscribe function — call it in useEffect cleanup.
export function subscribeToProfileChanges(
  userIds: string[],
  callback: (userId: string, newAvatarUrl: string | null) => void
): () => void {
  if (userIds.length === 0) return () => {};

  const channel = supabase
    .channel('profile-avatar-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        // Filter to only the user IDs we care about
        filter: `id=in.(${userIds.join(',')})`,
      },
      (payload) => {
        const updated = payload.new as { id: string; avatar_url: string | null };
        callback(updated.id, updated.avatar_url);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
