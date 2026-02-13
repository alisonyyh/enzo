import { useEffect, useState } from 'react';
import { subscribeToTasks, Task } from '../../lib/services/tasks';
import { signInToFirebase } from '../../lib/firebase';
import { SwipeableTaskCard } from './SwipeableTaskCard';
import { AddTaskFAB } from './AddTaskFAB';
import { NetworkStatusBanner } from './NetworkStatusBanner';

interface TaskManagementDashboardProps {
  puppyId: string;
  puppyName: string;
}

export function TaskManagementDashboard({ puppyId, puppyName }: TaskManagementDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function init() {
      try {
        // Sign in to Firebase (get Custom Token from Supabase)
        await signInToFirebase();

        // Subscribe to tasks
        unsubscribe = subscribeToTasks(
          puppyId,
          (updatedTasks) => {
            setTasks(updatedTasks);
            setIsLoading(false);
          },
          (err) => {
            setError(err.message);
            setIsLoading(false);
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        setIsLoading(false);
      }
    }

    init();

    return () => {
      unsubscribe?.();
    };
  }, [puppyId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">🐾</div>
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto p-6">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-gray-800 font-semibold mb-2">Unable to load tasks</p>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentDate = new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <NetworkStatusBanner />

      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{puppyName}'s Routine</h1>
          <p className="text-sm text-gray-600">
            {currentDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric"
            })}
          </p>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2">🐾</div>
              <p>No tasks for today</p>
              <p className="text-sm">Tap + to add a task</p>
            </div>
          ) : (
            tasks.map((task) => (
              <SwipeableTaskCard key={task.id} task={task} />
            ))
          )}
        </div>
      </div>

      <AddTaskFAB puppyId={puppyId} />
    </div>
  );
}
