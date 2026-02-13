import { supabase } from '../supabase';
import type { ActivityLog, Profile } from '../database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Activity log with completer profile info
 */
export interface ActivityLogWithProfile extends ActivityLog {
  completer_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * Get today's activity logs for a puppy (with completer profile data)
 */
export async function getTodayLogs(puppyId: string): Promise<ActivityLogWithProfile[]> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('puppy_id', puppyId)
    .eq('date', today);

  if (error) throw error;

  // Fetch profile data for each log with completed_by
  const logs = data || [];
  const logsWithProfiles = await Promise.all(
    logs.map(async (log) => {
      if (!log.completed_by) {
        return { ...log, completer_profile: null };
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', log.completed_by)
        .single();

      return {
        ...log,
        completer_profile: profileData || null,
      };
    })
  );

  return logsWithProfiles;
}

/**
 * Mark an activity as completed
 */
export async function completeActivity(
  routineItemId: string,
  puppyId: string,
  userId: string,
  note?: string
): Promise<ActivityLogWithProfile> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('activity_logs')
    .upsert(
      {
        routine_item_id: routineItemId,
        puppy_id: puppyId,
        date: today,
        status: 'completed' as const,
        completed_by: userId,
        completed_at: now,
        note: note || null,
      },
      { onConflict: 'routine_item_id,date' }
    )
    .select()
    .single();

  if (error) throw error;

  // Fetch completer profile separately
  let completerProfile = null;
  if (data.completed_by) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', data.completed_by)
      .single();
    completerProfile = profileData || null;
  }

  // Return with profile data
  return {
    ...data,
    completer_profile: completerProfile,
  } as ActivityLogWithProfile;
}

/**
 * Skip an activity
 */
export async function skipActivity(
  routineItemId: string,
  puppyId: string,
  userId: string,
  note?: string
): Promise<ActivityLogWithProfile> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('activity_logs')
    .upsert(
      {
        routine_item_id: routineItemId,
        puppy_id: puppyId,
        date: today,
        status: 'skipped' as const,
        completed_by: userId,
        completed_at: new Date().toISOString(),
        note: note || null,
      },
      { onConflict: 'routine_item_id,date' }
    )
    .select()
    .single();

  if (error) throw error;

  // Fetch completer profile separately
  let completerProfile = null;
  if (data.completed_by) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', data.completed_by)
      .single();
    completerProfile = profileData || null;
  }

  // Return with profile data
  return {
    ...data,
    completer_profile: completerProfile,
  } as ActivityLogWithProfile;
}

/**
 * Undo a completion (delete the log entry)
 */
export async function undoActivity(routineItemId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('activity_logs')
    .delete()
    .eq('routine_item_id', routineItemId)
    .eq('date', today);

  if (error) throw error;
}

/**
 * Subscribe to real-time activity log updates for a puppy
 * Note: Real-time updates don't include joined data, so we fetch the profile separately
 */
export function subscribeToActivityLogs(
  puppyId: string,
  onUpdate: (log: ActivityLogWithProfile) => void
): RealtimeChannel {
  return supabase
    .channel(`activity_logs:${puppyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'activity_logs',
        filter: `puppy_id=eq.${puppyId}`,
      },
      async (payload) => {
        if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          const log = payload.new as ActivityLog;

          // Fetch completer profile if completed_by exists
          let completerProfile = null;
          if (log.completed_by) {
            const { data } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', log.completed_by)
              .single();
            completerProfile = data || null;
          }

          onUpdate({
            ...log,
            completer_profile: completerProfile,
          });
        }
      }
    )
    .subscribe();
}

/**
 * Get activity logs for a date range (for progress tracking)
 */
export async function getLogsForDateRange(
  puppyId: string,
  startDate: string,
  endDate: string
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('puppy_id', puppyId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw error;
  return data || [];
}
