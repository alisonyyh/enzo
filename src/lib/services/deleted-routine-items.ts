import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  setDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, firebaseAuth } from '../firebase';

// Store deleted routine item IDs in Firebase so they persist across refreshes
// Collection: deletedRoutineItems/{autoId} with fields: puppyId, routineItemId, date, deletedBy, deletedAt

/**
 * Subscribe to deleted routine item IDs for a given date (real-time).
 * Despite the name, supports any date via optional param (D63).
 * Returns an unsubscribe function.
 */
export function subscribeToDeletedRoutineItems(
  puppyId: string,
  callback: (deletedIds: Set<string>) => void,
  onError?: (error: Error) => void,
  date?: string
) {
  const dateString = date || new Date().toISOString().split('T')[0];
  const colRef = collection(db, 'deletedRoutineItems');
  const q = query(
    colRef,
    where('puppyId', '==', puppyId),
    where('date', '==', dateString)
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

/**
 * One-time static fetch of deleted routine item IDs for a date (D64)
 */
export async function getDeletedRoutineItemsForDate(
  puppyId: string,
  date: string
): Promise<Set<string>> {
  const colRef = collection(db, 'deletedRoutineItems');
  const q = query(
    colRef,
    where('puppyId', '==', puppyId),
    where('date', '==', date)
  );

  const snapshot = await getDocs(q);
  const ids = new Set<string>();
  snapshot.forEach((doc) => {
    ids.add(doc.data().routineItemId);
  });
  return ids;
}
