import { useState } from 'react';
import { Plus } from 'lucide-react';
import { addTask } from '../../lib/services/tasks';

const ACTIVITY_OPTIONS = [
  { value: 'potty_break', label: 'Potty Break', emoji: '🚽' },
  { value: 'meal', label: 'Meal', emoji: '🍽️' },
  { value: 'training', label: 'Training', emoji: '🎓' },
  { value: 'nap', label: 'Nap', emoji: '😴' },
  { value: 'calm_time', label: 'Calm Time', emoji: '🧘' },
  { value: 'play_time', label: 'Play Time', emoji: '🎾' },
  { value: 'walk', label: 'Walk', emoji: '🚶' },
];

export function AddTaskFAB({ puppyId }: { puppyId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedTime, setSelectedTime] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!selectedActivity) return;

    setIsAdding(true);
    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const time = new Date();
      time.setHours(hours, minutes, 0, 0);

      const activityLabel = ACTIVITY_OPTIONS.find(
        (opt) => opt.value === selectedActivity
      )?.label || selectedActivity;

      await addTask(puppyId, selectedActivity as any, time, activityLabel);

      setSelectedActivity('');
      setSelectedTime(new Date().toTimeString().slice(0, 5));
      setShowModal(false);
    } catch (error) {
      console.error('Failed to add task:', error);
      alert('Failed to add task. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-10 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all z-40"
        style={{ boxShadow: '0 4px 16px rgba(232, 114, 42, 0.35)' }}
        aria-label="Add new task"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      {/* Add Task Bottom Sheet */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-background rounded-t-3xl p-6 w-full max-w-[390px] mx-auto"
            style={{ boxShadow: '0 -4px 24px rgba(45, 27, 14, 0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />

            <h3 className="text-xl font-bold text-foreground mb-5">Add Custom Task</h3>

            <div className="space-y-4">
              {/* Time Picker */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Time</label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm"
                />
              </div>

              {/* Activity Type */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Activity Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedActivity(option.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                        selectedActivity === option.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-foreground hover:bg-accent/80'
                      }`}
                    >
                      <span>{option.emoji}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={isAdding}
                  className="flex-1 py-3 px-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!selectedActivity || isAdding}
                  className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
                >
                  {isAdding ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
