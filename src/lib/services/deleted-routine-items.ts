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

// Store deleted routine item IDs in Firebase so they persist across refreshes
// Collection: deletedRoutineItems/{autoId} with fields: puppyId, routineItemId, date, deletedBy, deletedAt

/**
 * Subscribe to today's deleted routine item IDs (real-time).
 * Returns an unsubscribe function.
 */
export function subscribeToDeletedRoutineItems(
  puppyId: string,
  callback: (deletedIds: Set<string>) => void,
  onError?: (error: Error) => void
) {
  const today = new Date().toISOString().split('T')[0];
  const colRef = collection(db, 'deletedRoutineItems');
  const q = query(
    colRef,
    where('puppyId', '==', puppyId),
    where('date', '==', today)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.data().routineItemId);
      });
      callback(ids);
    },
    (error) => {
      console.error('Deleted routine items sync error:', error);
      onError?.(error);
    }
  );
}

/**
 * Mark a routine item as deleted for today.
 * Uses the routineItemId as the document ID to prevent duplicates.
 */
export async function deleteRoutineItem(
  puppyId: string,
  routineItemId: string
): Promise<void> {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];

  // Use a deterministic doc ID so we can't accidentally double-delete
  const docId = `${puppyId}_${routineItemId}_${today}`;
  const docRef = doc(db, 'deletedRoutineItems', docId);

  await setDoc(docRef, {
    puppyId,
    routineItemId,
    date: today,
    deletedBy: userId,
    deletedAt: serverTimestamp(),
  });
}
