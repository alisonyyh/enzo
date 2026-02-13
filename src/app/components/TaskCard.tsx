import { useState } from 'react';
import { Task, editTask } from '../../lib/services/tasks';
import { format } from 'date-fns';

const ACTIVITY_OPTIONS = [
  { value: 'potty_break', label: 'Potty Break' },
  { value: 'meal', label: 'Meal' },
  { value: 'training', label: 'Training' },
  { value: 'nap', label: 'Nap' },
  { value: 'calm_time', label: 'Calm Time' },
  { value: 'play_time', label: 'Play Time' },
  { value: 'walk', label: 'Walk' },
];

export function TaskCard({ task }: { task: Task }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedTime, setEditedTime] = useState(
    format(task.actualTime.toDate(), 'HH:mm')
  );
  const [editedActivity, setEditedActivity] = useState(task.activityType);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const [hours, minutes] = editedTime.split(':').map(Number);
      const newTime = new Date();
      newTime.setHours(hours, minutes, 0, 0);

      await editTask(task.id, {
        actualTime: newTime,
        activityType: editedActivity,
      });

      setIsExpanded(false);
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to current values
    setEditedTime(format(task.actualTime.toDate(), 'HH:mm'));
    setEditedActivity(task.activityType);
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-4 p-4 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <input
          type="checkbox"
          checked={task.isCompleted}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5"
          readOnly
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {format(task.actualTime.toDate(), 'h:mm a')}
            </span>
            <span>{task.title}</span>
            {task.isEdited && <span className="text-gray-400">✏️</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border-2 border-blue-500 rounded-lg">
      <h3 className="font-semibold mb-4">{task.title}</h3>

      <div className="space-y-4">
        {/* Time Picker */}
        <div>
          <label className="block text-sm font-medium mb-1">Time</label>
          <input
            type="time"
            value={editedTime}
            onChange={(e) => setEditedTime(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        {/* Activity Type Dropdown */}
        <div>
          <label className="block text-sm font-medium mb-1">Activity Type</label>
          <select
            value={editedActivity}
            onChange={(e) => setEditedActivity(e.target.value as Task['activityType'])}
            className="w-full px-3 py-2 border rounded-lg"
          >
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
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
