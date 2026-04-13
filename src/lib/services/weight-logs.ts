import { supabase } from '../supabase';
import type { WeightLog } from '../database.types';

export type { WeightLog };

/**
 * Fetch all weight logs for a puppy, sorted newest-first
 */
export async function getWeightLogs(puppyId: string): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('puppy_id', puppyId)
    .order('logged_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Add a new weight log entry
 */
export async function addWeightLog(entry: {
  puppy_id: string;
  weight_value: number;
  weight_unit: string;
  logged_at: string;
  logged_by: string | null;
  note?: string | null;
  is_onboarding?: boolean;
}): Promise<WeightLog> {
  const { data, error } = await supabase
    .from('weight_logs')
    .insert({
      puppy_id: entry.puppy_id,
      weight_value: entry.weight_value,
      weight_unit: entry.weight_unit,
      logged_at: entry.logged_at,
      logged_by: entry.logged_by,
      note: entry.note || null,
      is_onboarding: entry.is_onboarding || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing weight log entry
 */
export async function updateWeightLog(
  id: string,
  updates: {
    weight_value?: number;
    weight_unit?: string;
    logged_at?: string;
    note?: string | null;
  }
): Promise<WeightLog> {
  const { data, error } = await supabase
    .from('weight_logs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a weight log entry (cannot delete onboarding entries)
 */
export async function deleteWeightLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('weight_logs')
    .delete()
    .eq('id', id)
    .eq('is_onboarding', false);

  if (error) throw error;
}

/**
 * Ensure the onboarding weight exists as the first weight log entry.
 * Runs once — skips if an onboarding entry already exists.
 *
 * Uses a per-puppy promise cache to prevent race conditions when
 * multiple React renders call this concurrently.
 */
const onboardingPromises = new Map<string, Promise<void>>();

export function ensureOnboardingWeight(
  puppyId: string,
  weightValue: number | null,
  weightUnit: string,
  createdAt: string,
): Promise<void> {
  if (!weightValue) return Promise.resolve();

  // Deduplicate concurrent calls for the same puppy
  const inflight = onboardingPromises.get(puppyId);
  if (inflight) return inflight;

  const promise = (async () => {
    // Check if onboarding entry already exists
    const { data: existing } = await supabase
      .from('weight_logs')
      .select('id')
      .eq('puppy_id', puppyId)
      .eq('is_onboarding', true)
      .limit(1);

    if (existing && existing.length > 0) return;

    // Create onboarding entry — ignore unique violation (23505)
    // in case the DB-level partial unique index catches a race
    const { error } = await supabase
      .from('weight_logs')
      .insert({
        puppy_id: puppyId,
        weight_value: weightValue,
        weight_unit: weightUnit,
        logged_at: createdAt.split('T')[0],
        logged_by: null,
        note: null,
        is_onboarding: true,
      });

    if (error && error.code !== '23505') throw error;
  })();

  onboardingPromises.set(puppyId, promise);
  promise.finally(() => onboardingPromises.delete(puppyId));

  return promise;
}
