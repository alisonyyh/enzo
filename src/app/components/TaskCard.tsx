import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
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

// Category dot colors matching the Dashboard's CATEGORY_COLORS
function getCategoryColor(activityType: string): string {
  const colors: Record<string, string> = {
    potty_break: '#4A9B5E',
    meal: '#E8722A',
    training: '#8B6FC0',
    nap: '#8B7355',
    calm_time: '#8B7355',
    play_time: '#5B8FD4',
    walk: '#5B8FD4',
  };
  return colors[activityType] || '#8B7355';
}

// Format time to 12-hour display (matches Dashboard's formatDisplayTime)
function formatDisplayTime(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

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
    setEditedTime(format(task.actualTime.toDate(), 'HH:mm'));
    setEditedActivity(task.activityType);
    setIsExpanded(false);
  };

  const categoryColor = getCategoryColor(task.activityType);
  const taskDate = task.actualTime.toDate();

  // Collapsed view — matches original Figma Make card layout
  // Time LEFT | Category dot + Activity name/description MIDDLE | Status icon RIGHT
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className={`
          bg-card rounded-xl p-4 min-h-[64px] flex gap-3 transition-all cursor-pointer active:scale-[0.98]
          ${task.isCompleted ? 'opacity-60' : ''}
        `}
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)'
        }}
      >
        {/* Time on LEFT */}
        <div className="flex-shrink-0 pt-0.5">
          <div className="text-sm font-bold text-foreground w-14 text-left">
            {formatDisplayTime(taskDate)}
          </div>
        </div>

        {/* Activity Content in MIDDLE */}
        <div className="flex-1 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {/* Category dot */}
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: categoryColor }}
                />
                <h3 className={`font-medium text-base text-foreground ${task.isCompleted ? 'line-through' : ''}`}>
                  {task.title}
                </h3>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5 ml-3.5" style={{ lineHeight: '1.5' }}>
                {task.activityType.replace(/_/g, ' ')}
                {task.isEdited && ' · edited'}
                {task.isUserAdded && ' · custom'}
              </p>
            </div>

            {/* Status Icon on RIGHT */}
            <div className="flex-shrink-0 pt-0.5">
              {task.isCompleted ? (
                <CheckCircle2 className="size-6 text-secondary" />
              ) : (
                <Circle className="size-6 text-border" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Expanded edit view — keeps the same card shape with an edit form inside
  return (
    <div
      className="bg-card rounded-xl p-4"
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 8px rgba(45, 27, 14, 0.12)',
        outline: '2px solid var(--primary)',
        outlineOffset: '-1px',
      }}
    >
      <h3 className="text-sm font-bold text-foreground mb-4">{task.title}</h3>

      <div className="space-y-3">
        {/* Time Picker */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Time</label>
          <input
            type="time"
            value={editedTime}
            onChange={(e) => setEditedTime(e.target.value)}
            className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground text-sm"
          />
        </div>

        {/* Activity Type Dropdown */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Activity Type</label>
          <select
            value={editedActivity}
            onChange={(e) => setEditedActivity(e.target.value as Task['activityType'])}
            className="w-full px-3 py-2 bg-accent border border-border rounded-lg text-foreground text-sm"
          >
            {ACTIVITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-muted-foreground bg-muted/50 rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
