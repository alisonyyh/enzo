import { useSwipeable } from 'react-swipeable';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Task, deleteTask } from '../../lib/services/tasks';
import { TaskCard } from './TaskCard';

interface SwipeableTaskCardProps {
  task: Task;
  /** Called when the user taps the card (opens edit bottom sheet). */
  onEdit?: (task: Task) => void;
}

/**
 * Wraps a custom task card with swipe-to-delete.
 * Swiping left reveals a circular trash icon button to the right of the card.
 * Tapping the trash icon immediately deletes the task (no confirmation).
 */
export function SwipeableTaskCard({ task, onEdit }: SwipeableTaskCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left' && eventData.deltaX < 0) {
        setSwipeOffset(Math.max(eventData.deltaX, -80));
      }
    },
    onSwiped: (eventData) => {
      if (eventData.dir === 'Left' && Math.abs(eventData.deltaX) > 60) {
        setSwipeOffset(-80);
      } else {
        setSwipeOffset(0);
      }
    },
    trackMouse: true,
  });

  const handleDelete = async () => {
    try {
      await deleteTask(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  return (
    <div className="relative flex items-center">
      {/* Circular delete button — positioned to the right, vertically centered */}
      <div
        className="absolute right-0 flex items-center justify-center"
        style={{
          opacity: swipeOffset < 0 ? Math.min(1, Math.abs(swipeOffset) / 60) : 0,
          transform: `scale(${swipeOffset < 0 ? Math.min(1, Math.abs(swipeOffset) / 60) : 0})`,
          transition: swipeOffset === 0 ? 'all 0.3s ease-out' : 'none',
        }}
      >
        <button
          onClick={handleDelete}
          className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 8px rgba(212, 87, 78, 0.3)' }}
        >
          <Trash2 className="size-5 text-destructive-foreground" />
        </button>
      </div>

      {/* Task card (swipeable) */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
        }}
        className="relative z-10 w-full"
      >
        <TaskCard task={task} onEdit={onEdit} />
      </div>
    </div>
  );
}
