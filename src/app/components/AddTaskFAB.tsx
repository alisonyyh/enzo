import { useState } from 'react';
import { addTask } from '../../lib/services/tasks';

const ACTIVITY_OPTIONS = [
  { value: 'potty_break', label: 'Potty Break' },
  { value: 'meal', label: 'Meal' },
  { value: 'training', label: 'Training' },
  { value: 'nap', label: 'Nap' },
  { value: 'calm_time', label: 'Calm Time' },
  { value: 'play_time', label: 'Play Time' },
  { value: 'walk', label: 'Walk' },
];

export function AddTaskFAB({ puppyId }: { puppyId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedTime, setSelectedTime] = useState(
    new Date().toTimeString().slice(0, 5) // HH:MM
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

      // Reset form
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
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition-colors z-40"
        aria-label="Add new task"
      >
        +
      </button>

      {/* Add Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add New Task</h3>

            <div className="space-y-4">
              {/* Time Picker */}
              <div>
                <label className="block text-sm font-medium mb-1">Time</label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* Activity Type Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1">Activity Type</label>
                <select
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select activity</option>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={isAdding}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!selectedActivity || isAdding}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg disabled:bg-gray-300"
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
