import { supabase } from '../supabase';
import type { Invite } from '../database.types';

/**
 * Generate a unique invite token
 */
function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/**
 * Create a new invite for a puppy
 */
export async function createInvite(puppyId: string, userId: string): Promise<Invite> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72); // 72 hours

  const { data, error } = await supabase
    .from('invites')
    .insert({
      puppy_id: puppyId,
      invited_by: userId,
      invite_token: token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all invites for a puppy (owner view)
 */
export async function getPuppyInvites(puppyId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('puppy_id', puppyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Revoke a pending invite
 */
export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);

  if (error) throw error;
}

/**
 * Accept an invite (caretaker flow)
 */
export async function acceptInvite(inviteToken: string, userId: string): Promise<void> {
  // Look up the invite
  const { data: invite, error: lookupError } = await supabase
    .from('invites')
    .select('*')
    .eq('invite_token', inviteToken)
    .eq('status', 'pending')
    .single();

  if (lookupError || !invite) throw new Error('Invite not found or already used');

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from('invites').update({ status: 'expired' }).eq('id', invite.id);
    throw new Error('This invite has expired');
  }

  // Create caretaker membership
  const { error: memberError } = await supabase
    .from('puppy_memberships')
    .insert({
      puppy_id: invite.puppy_id,
      user_id: userId,
      role: 'caretaker',
    });

  if (memberError) throw memberError;

  // Mark invite as accepted
  const { error: updateError } = await supabase
    .from('invites')
    .update({ status: 'accepted', accepted_by: userId })
    .eq('id', invite.id);

  if (updateError) throw updateError;
}

/**
 * Build the invite link URL
 */
export function getInviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}
