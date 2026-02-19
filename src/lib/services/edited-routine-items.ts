import {
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, firebaseAuth } from '../firebase';

/**
 * Stores edits to AI-generated routine items in Firebase.
 *
 * Routine items live in Supabase (routine_items table), but when a user
 * edits a routine item's time, activity type, or notes via the Edit Task
 * bottom sheet, the overrides are stored here in Firebase. This mirrors
 * the pattern used by deleted-routine-items.ts.
 *
 * Collection: editedRoutineItems/{docId}
 * Fields: puppyId, routineItemId, date, time, activityType, title, description, editedBy, editedAt
 */

export interface RoutineItemEdit {
  routineItemId: string;
  puppyId: string;
  date: string;
  time: string;          // HH:mm format
  activityType: string;
  title: string;
  description: string;   // Notes field (can be empty string)
  pottyDetails?: {       // Only present when activityType = potty_break (D52)
    poop: boolean;
    pee: boolean;
  };
  editedBy: string;
  editedAt: any;          // Firestore server timestamp
}

/**
 * Subscribe to today's edited routine items (real-time).
 * Returns a map of routineItemId -> RoutineItemEdit.
 */
export function subscribeToEditedRoutineItems(
  puppyId: string,
  callback: (edits: Map<string, RoutineItemEdit>) => void,
  onError?: (error: Error) => void
) {
  const today = new Date().toISOString().split('T')[0];
  const colRef = collection(db, 'editedRoutineItems');
  const q = query(
    colRef,
    where('puppyId', '==', puppyId),
    where('date', '==', today)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const edits = new Map<string, RoutineItemEdit>();
      snapshot.forEach((doc) => {
        const data = doc.data() as RoutineItemEdit;
        edits.set(data.routineItemId, data);
      });
      callback(edits);
    },
    (error) => {
      console.error('Edited routine items sync error:', error);
      onError?.(error);
    }
  );
}

/**
 * Save an edit to a routine item.
 * Uses a deterministic doc ID (puppyId_routineItemId_date) to upsert.
 */
export async function saveRoutineItemEdit(
  puppyId: string,
  routineItemId: string,
  updates: {
    time: string;           // HH:mm format
    activityType: string;
    title: string;
    description: string;
    pottyDetails?: { poop: boolean; pee: boolean };
  }
): Promise<void> {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];
  const docId = `${puppyId}_${routineItemId}_${today}`;
  const docRef = doc(db, 'editedRoutineItems', docId);

  await setDoc(docRef, {
    puppyId,
    routineItemId,
    date: today,
    time: updates.time,
    activityType: updates.activityType,
    title: updates.title,
    description: updates.description,
    ...(updates.pottyDetails !== undefined && { pottyDetails: updates.pottyDetails }),
    editedBy: userId,
    editedAt: serverTimestamp(),
  });
}
