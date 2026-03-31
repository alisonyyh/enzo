import { supabase } from '../supabase';
import type { InviteCode } from '../database.types';

// Characters that avoid ambiguity (no 0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a random 4-character suffix for invite codes
 */
function randomSuffix(): string {
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

/**
 * Build an invite code from a puppy name (D71 format: {WORD}-{ALPHANUMERIC})
 */
function buildCode(puppyName: string): string {
  const word = puppyName
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 8) || 'PUPPY';
  return `${word}-${randomSuffix()}`;
}

/**
 * Create an invite code for a puppy (called during onboarding after puppy creation).
 * Retries on uniqueness collision.
 */
export async function createInviteCode(
  puppyId: string,
  puppyName: string,
  userId: string
): Promise<string> {
  const code = buildCode(puppyName);

  const { error } = await supabase
    .from('invite_codes')
    .insert({
      puppy_id: puppyId,
      code,
      created_by: userId,
    });

  if (error) {
    // Uniqueness collision — retry with a new suffix
    if (error.code === '23505') {
      return createInviteCode(puppyId, puppyName, userId);
    }
    throw error;
  }

  return code;
}

/**
 * Get the invite code for a puppy (owner view in Settings > Caretakers).
 * RLS enforces owner-only access.
 */
export async function getInviteCode(puppyId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('code')
    .eq('puppy_id', puppyId)
    .single();

  if (error || !data) return null;
  return data.code;
}

/**
 * Validate an invite code via the Edge Function.
 * Returns puppy data on success, error message on failure.
 */
export async function validateInviteCode(code: string): Promise<{
  success: boolean;
  error?: string;
  puppy?: {
    id: string;
    name: string;
    breed: string;
    ageWeeks: number;
    photoUrl: string | null;
  };
  membership?: {
    id: string;
    role: string;
    joinedAt: string;
  };
}> {
  const { data, error } = await supabase.functions.invoke('validate-invite-code', {
    body: { code },
  });

  if (error) {
    // supabase.functions.invoke wraps non-2xx as FunctionsHttpError
    // The response body is still in data when available
    const errorMessage = data?.error || 'Something went wrong. Please try again.';
    return { success: false, error: errorMessage };
  }

  return data;
}
