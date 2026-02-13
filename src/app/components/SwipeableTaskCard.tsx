import { useSwipeable } from 'react-swipeable';
import { useState } from 'react';
import { Task, deleteTask } from '../../lib/services/tasks';
import { TaskCard } from './TaskCard';

export function SwipeableTaskCard({ task }: { task: Task }) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left' && eventData.deltaX < 0) {
        setSwipeOffset(Math.max(eventData.deltaX, -100));
      }
    },
    onSwiped: (eventData) => {
      if (eventData.dir === 'Left' && Math.abs(eventData.deltaX) > 60) {
        setSwipeOffset(-100); // Reveal delete button
      } else {
        setSwipeOffset(0); // Reset
      }
    },
    trackMouse: true, // Enable mouse drag for desktop
  });

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteTask(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  return (
    <>
      <div className="relative overflow-hidden">
        {/* Delete button (revealed on swipe) */}
        <div className="absolute right-0 top-0 h-full w-24 bg-red-500 flex items-center justify-center">
          <button
            onClick={handleDelete}
            className="text-white font-medium"
          >
            Delete
          </button>
        </div>

        {/* Task card (swipeable) */}
        <div
          {...handlers}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
          }}
          className="relative z-10 bg-white"
        >
          <TaskCard task={task} />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Task?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-white bg-red-600 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
