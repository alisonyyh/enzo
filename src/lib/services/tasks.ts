import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db, firebaseAuth } from '../firebase';

export interface Task {
  id: string;
  puppyId: string;
  date: string; // YYYY-MM-DD
  scheduledTime: Timestamp;
  actualTime: Timestamp;
  activityType: 'potty_break' | 'meal' | 'training' | 'nap' | 'calm_time' | 'play_time' | 'walk';
  title: string;
  description?: string;
  isCompleted: boolean;
  isEdited: boolean;
  isUserAdded: boolean;
  completedBy?: string;
  completedAt?: Timestamp;
  lastEditedBy: string;
  lastEditedAt: Timestamp;
  createdAt: Timestamp;
}

// Get today's date in YYYY-MM-DD format
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Subscribe to today's tasks (real-time)
export function subscribeToTasks(
  puppyId: string,
  callback: (tasks: Task[]) => void,
  onError?: (error: Error) => void
) {
  const tasksRef = collection(db, 'tasks');
  const q = query(
    tasksRef,
    where('puppyId', '==', puppyId),
    where('date', '==', getTodayString()),
    orderBy('actualTime', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: Task[] = [];
      snapshot.forEach((doc) => {
        tasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      callback(tasks);
    },
    (error) => {
      console.error('Firestore sync error:', error);
      onError?.(error);
    }
  );
}

// Add new task
export async function addTask(
  puppyId: string,
  activityType: Task['activityType'],
  time: Date,
  title: string,
  description?: string
): Promise<string> {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const docRef = await addDoc(collection(db, 'tasks'), {
    puppyId,
    date: getTodayString(),
    scheduledTime: Timestamp.fromDate(time),
    actualTime: Timestamp.fromDate(time),
    activityType,
    title,
    ...(description !== undefined && { description }),
    isCompleted: false,
    isEdited: true, // User-added tasks are always marked as edited
    isUserAdded: true,
    lastEditedBy: userId,
    lastEditedAt: serverTimestamp(),
    createdAt: Timestamp.now(),
  });

  return docRef.id;
}

// Edit existing task
export async function editTask(
  taskId: string,
  updates: {
    actualTime?: Date;
    activityType?: Task['activityType'];
    title?: string;
    description?: string;
  }
): Promise<void> {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const taskRef = doc(db, 'tasks', taskId);

  await updateDoc(taskRef, {
    ...(updates.actualTime && { actualTime: Timestamp.fromDate(updates.actualTime) }),
    ...(updates.activityType && { activityType: updates.activityType }),
    ...(updates.title && { title: updates.title }),
    // description can be set to empty string (clearing notes), so check for undefined specifically
    ...(updates.description !== undefined && { description: updates.description }),
    isEdited: true,
    lastEditedBy: userId,
    lastEditedAt: serverTimestamp(),
  });
}

// Delete task
export async function deleteTask(taskId: string): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  await deleteDoc(taskRef);
}

// Complete task
export async function completeTask(taskId: string): Promise<void> {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const taskRef = doc(db, 'tasks', taskId);

  await updateDoc(taskRef, {
    isCompleted: true,
    completedBy: userId,
    completedAt: Timestamp.now(),
    lastEditedBy: userId,
    lastEditedAt: serverTimestamp(),
  });
}
