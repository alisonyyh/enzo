import { supabase } from '../supabase';
import type { Routine, RoutineItem } from '../database.types';

export interface RoutineWithItems extends Routine {
  routine_items: RoutineItem[];
}

/**
 * Get the active routine for a puppy (with all items)
 */
export async function getActiveRoutine(puppyId: string): Promise<RoutineWithItems | null> {
  const { data, error } = await supabase
    .from('routines')
    .select('*, routine_items(*)')
    .eq('puppy_id', puppyId)
    .eq('is_active', true)
    .order('generated_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const routine = data[0];

  // Sort routine items by scheduled_time
  if (routine?.routine_items) {
    routine.routine_items.sort((a: RoutineItem, b: RoutineItem) =>
      a.scheduled_time.localeCompare(b.scheduled_time)
    );
  }

  return routine as RoutineWithItems;
}

/**
 * Save a generated routine to Supabase.
 * Called after the client-side routine generation (v1 fallback)
 * or after the Edge Function returns.
 */
export async function saveRoutine(
  puppyId: string,
  items: Array<{
    activity_type: string;
    title: string;
    description: string;
    scheduled_time: string; // HH:MM format
    duration_minutes?: number;
    sort_order: number;
  }>
): Promise<RoutineWithItems> {
  console.log('saveRoutine: saving routine for puppy', puppyId, 'with', items.length, 'items');

  // Deactivate any existing active routines
  await supabase
    .from('routines')
    .update({ is_active: false })
    .eq('puppy_id', puppyId)
    .eq('is_active', true);

  // Create new routine
  const { data: routine, error: routineError } = await supabase
    .from('routines')
    .insert({
      puppy_id: puppyId,
      source: 'ai_generated',
      is_active: true,
    })
    .select()
    .single();

  if (routineError) {
    console.error('saveRoutine: error creating routine:', routineError);
    throw routineError;
  }
  console.log('saveRoutine: routine created with id', routine.id);

  // Insert all routine items
  const routineItems = items.map((item) => ({
    routine_id: routine.id,
    activity_type: item.activity_type,
    title: item.title,
    description: item.description,
    scheduled_time: item.scheduled_time,
    duration_minutes: item.duration_minutes || null,
    sort_order: item.sort_order,
    is_enabled: true,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from('routine_items')
    .insert(routineItems)
    .select();

  if (itemsError) {
    console.error('saveRoutine: error inserting routine items:', itemsError);
    throw itemsError;
  }
  console.log('saveRoutine: inserted', insertedItems?.length, 'routine items');

  return {
    ...routine,
    routine_items: (insertedItems || []).sort((a, b) =>
      a.scheduled_time.localeCompare(b.scheduled_time)
    ),
  };
}

/**
 * Generate routine using AI via Edge Function
 * Falls back to client-side generation if Edge Function fails
 */
export async function generateRoutineWithAI(
  puppyId: string,
  questionnaireData: {
    puppyName: string;
    breed: string;
    ageMonths: number;
    ageWeeks: number;
    weight: number | null;
    weightUnit: 'lbs' | 'kg';
    livingSituation: string;
    workArrangement: string;
    wakeUpTime: string;
    bedTime: string;
  }
): Promise<RoutineWithItems> {
  console.log('generateRoutineWithAI: calling Edge Function for puppy', puppyId);

  try {
    // Get current session for auth token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('generate-routine', {
      body: {
        puppyId,
        questionnaireData,
      },
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw error;
    }

    if (!data?.routine) {
      throw new Error('Invalid response from Edge Function');
    }

    console.log('generateRoutineWithAI: Edge Function success, routine id:', data.routine.id);
    return data.routine;

  } catch (error) {
    console.error('generateRoutineWithAI: Edge Function failed, will use fallback:', error);
    throw error; // Let caller decide whether to use fallback
  }
}

/**
 * Toggle a routine item on/off
 */
export async function toggleRoutineItem(itemId: string, enabled: boolean) {
  const { error } = await supabase
    .from('routine_items')
    .update({ is_enabled: enabled })
    .eq('id', itemId);

  if (error) throw error;
}
