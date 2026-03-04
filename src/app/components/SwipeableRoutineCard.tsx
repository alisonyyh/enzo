import { useSwipeable } from 'react-swipeable';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteRoutineItem } from '../../lib/services/deleted-routine-items';

interface SwipeableRoutineCardProps {
  puppyId: string;
  routineItemId: string;
  children: React.ReactNode;
}

/**
 * Wraps a routine item card with swipe-to-delete.
 * Swiping left reveals a circular trash icon button.
 * Tapping trash shows a confirmation modal before deleting.
 */
export function SwipeableRoutineCard({
  puppyId,
  routineItemId,
  children,
}: SwipeableRoutineCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleTrashTap = () => {
    setSwipeOffset(0);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRoutineItem(puppyId, routineItemId);
    } catch (error) {
      console.error('Failed to delete routine item:', error);
      alert('Failed to delete task. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  return (
    <>
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
            onClick={handleTrashTap}
            className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            style={{ boxShadow: '0 2px 8px rgba(212, 87, 78, 0.3)' }}
          >
            <Trash2 className="size-5 text-destructive-foreground" />
          </button>
        </div>

        {/* Card content (swipeable) */}
        <div
          {...handlers}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
          }}
          className="relative z-10 w-full"
        >
          {children}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={handleCancelDelete}
        >
          <div
            className="bg-card rounded-2xl p-6 mx-5 w-full max-w-[340px]"
            style={{ boxShadow: '0 8px 32px rgba(45, 27, 14, 0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Task?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl border border-border text-foreground font-medium hover:bg-accent transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl bg-destructive text-destructive-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
