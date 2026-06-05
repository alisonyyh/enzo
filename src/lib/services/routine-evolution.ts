import { supabase } from '../supabase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Routine, RoutineItem } from '../database.types';
import type { RoutineWithItems } from './routines';

const LOCK_STALE_MS = 5 * 60 * 1000; // 5 minutes

export function needsRegeneration(routine: Routine | null): boolean {
  if (!routine) return false;
  // Never regenerate a routine created less than 1 hour ago
  const ageMs = Date.now() - new Date(routine.generated_at).getTime();
  if (ageMs < 60 * 60 * 1000) return false;
  if (!routine.valid_until) return true;
  return new Date() > new Date(routine.valid_until);
}

export function isRegenerationInProgress(routine: Routine | null): boolean {
  if (!routine) return false;
  if (routine.regeneration_status !== 'in_progress') return false;
  // Stale lock: if generated_at is older than 5 min and still in_progress, it's stale
  return Date.now() - new Date(routine.generated_at).getTime() < LOCK_STALE_MS;
}

export async function clearStaleLock(routineId: string): Promise<void> {
  await supabase
    .from('routines')
    .update({ regeneration_status: null })
    .eq('id', routineId);
}

export async function triggerRegeneration(
  puppyId: string,
  questionnaireData: {
    puppyName: string;
    breed: string;
    dateOfBirth: string;
    weight: number | null;
    weightUnit: 'lbs' | 'kg';
    wakeUpTime: string;
    bedTime: string;
  }
): Promise<RoutineWithItems | null> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-routine', {
      body: {
        puppyId,
        questionnaireData,
        isRegeneration: true,
      },
    });

    if (error) {
      console.error('Regeneration failed:', error);
      return null;
    }

    if (data?.skipped) {
      console.log('Regeneration skipped:', data.reason);
      return null;
    }

    if (!data?.routine) {
      console.error('Invalid regeneration response');
      return null;
    }

    return data.routine;
  } catch (err) {
    console.error('Regeneration error:', err);
    return null;
  }
}

export async function cleanupFirebaseOverlays(
  puppyId: string,
  oldItems: RoutineItem[]
): Promise<void> {
  const oldItemIds = new Set(oldItems.map(i => i.id));

  try {
    const batch = writeBatch(db);
    let batchCount = 0;

    const editedSnap = await getDocs(
      query(collection(db, 'editedRoutineItems'), where('puppyId', '==', puppyId))
    );
    editedSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.routineItemId && oldItemIds.has(data.routineItemId)) {
        batch.delete(doc(db, 'editedRoutineItems', docSnap.id));
        batchCount++;
      }
    });

    const deletedSnap = await getDocs(
      query(collection(db, 'deletedRoutineItems'), where('puppyId', '==', puppyId))
    );
    deletedSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.routineItemId && oldItemIds.has(data.routineItemId)) {
        batch.delete(doc(db, 'deletedRoutineItems', docSnap.id));
        batchCount++;
      }
    });

    if (batchCount > 0) {
      await batch.commit();
      console.log(`Cleaned up ${batchCount} Firebase overlay documents`);
    }
  } catch (err) {
    console.warn('Firebase overlay cleanup failed (non-critical):', err);
  }
}
