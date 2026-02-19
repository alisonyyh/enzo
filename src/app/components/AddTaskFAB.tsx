import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { addTask, editTask, Task } from '../../lib/services/tasks';
import { saveRoutineItemEdit } from '../../lib/services/edited-routine-items';
import { format } from 'date-fns';

const ACTIVITY_OPTIONS = [
  { value: 'potty_break', label: 'Potty', emoji: '🚽' },
  { value: 'meal', label: 'Meal', emoji: '🍽️' },
  { value: 'training', label: 'Training', emoji: '🎓' },
  { value: 'nap', label: 'Nap', emoji: '😴' },
  { value: 'calm_time', label: 'Calm Time', emoji: '🧘' },
  { value: 'play_time', label: 'Play Time', emoji: '🎾' },
  { value: 'walk', label: 'Walk', emoji: '🚶' },
];

// Map routine item categories (Supabase) to activity option values (Firebase)
const CATEGORY_TO_ACTIVITY: Record<string, string> = {
  feeding: 'meal',
  potty: 'potty_break',
  exercise: 'walk',
  play: 'play_time',
  training: 'training',
  rest: 'nap',
  bonding: 'calm_time',
  sleep: 'nap',
};

/** Represents an AI-generated routine item being edited */
export interface EditingRoutineItem {
  type: 'routine';
  routineItemId: string;
  puppyId: string;
  time: string;          // HH:mm
  category: string;      // Supabase category (feeding, potty, etc.)
  activity: string;      // Title (e.g., "Breakfast")
  description: string;   // AI description (e.g., "Take outside 15-30 min after eating")
  pottyDetails?: { poop: boolean; pee: boolean };
}

/** Represents a custom (Firebase) task being edited */
export interface EditingCustomTask {
  type: 'custom';
  task: Task;
}

export type EditingItem = EditingRoutineItem | EditingCustomTask;

interface AddTaskFABProps {
  puppyId: string;
  /** When set, the bottom sheet opens in "Edit Task" mode. */
  editingItem?: EditingItem | null;
  /** Called when the edit sheet closes (save or cancel) so the parent can clear editingItem. */
  onEditDone?: () => void;
}

export function AddTaskFAB({ puppyId, editingItem, onEditDone }: AddTaskFABProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedTime, setSelectedTime] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [notes, setNotes] = useState('');
  const [pottyPoop, setPottyPoop] = useState(false);
  const [pottyPee, setPottyPee] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const isEditMode = !!editingItem;

  // Open the sheet and pre-populate when editingItem is set
  useEffect(() => {
    if (editingItem) {
      if (editingItem.type === 'custom') {
        const task = editingItem.task;
        setSelectedActivity(task.activityType);
        setSelectedTime(format(task.actualTime.toDate(), 'HH:mm'));
        setNotes(task.description || '');
        setPottyPoop(task.pottyDetails?.poop ?? false);
        setPottyPee(task.pottyDetails?.pee ?? false);
      } else {
        // Routine item
        const mappedActivity = CATEGORY_TO_ACTIVITY[editingItem.category] || 'nap';
        setSelectedActivity(mappedActivity);
        setSelectedTime(editingItem.time);
        setNotes(editingItem.description || '');
        setPottyPoop(editingItem.pottyDetails?.poop ?? false);
        setPottyPee(editingItem.pottyDetails?.pee ?? false);
      }
      setShowModal(true);
    }
  }, [editingItem]);

  // Auto-resize textarea
  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = `${Math.min(notesRef.current.scrollHeight, 72)}px`; // 3 lines ≈ 72px
    }
  }, [notes]);

  const resetAndClose = () => {
    setSelectedActivity('');
    setSelectedTime(new Date().toTimeString().slice(0, 5));
    setNotes('');
    setPottyPoop(false);
    setPottyPee(false);
    setShowModal(false);
    onEditDone?.();
  };

  const handleSubmit = async () => {
    if (!selectedActivity) return;

    setIsSaving(true);
    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const time = new Date();
      time.setHours(hours, minutes, 0, 0);

      // Use "Potty Break" for the persisted title (timeline display), even though the grid label says "Potty"
      const activityLabel = selectedActivity === 'potty_break'
        ? 'Potty Break'
        : (ACTIVITY_OPTIONS.find((opt) => opt.value === selectedActivity)?.label || selectedActivity);

      // Only include pottyDetails when activity type is potty_break
      const pottyDetailsPayload = selectedActivity === 'potty_break'
        ? { poop: pottyPoop, pee: pottyPee }
        : undefined;

      if (isEditMode && editingItem) {
        if (editingItem.type === 'custom') {
          // Edit custom task in Firebase
          await editTask(editingItem.task.id, {
            actualTime: time,
            activityType: selectedActivity as Task['activityType'],
            title: activityLabel,
            description: notes,
            pottyDetails: pottyDetailsPayload,
          });
        } else {
          // Edit routine item — save override in Firebase editedRoutineItems collection
          await saveRoutineItemEdit(puppyId, editingItem.routineItemId, {
            time: selectedTime,
            activityType: selectedActivity,
            title: activityLabel,
            description: notes,
            pottyDetails: pottyDetailsPayload,
          });
        }
      } else {
        // Add mode: create new custom task
        await addTask(puppyId, selectedActivity as any, time, activityLabel, notes || undefined, pottyDetailsPayload);
      }

      resetAndClose();
    } catch (error) {
      console.error(isEditMode ? 'Failed to edit task:' : 'Failed to add task:', error);
      alert(isEditMode ? 'Failed to save changes. Please try again.' : 'Failed to add task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    resetAndClose();
  };

  // When opening via FAB (not edit mode), reset fields to defaults
  const handleFABClick = () => {
    setSelectedActivity('');
    setSelectedTime(new Date().toTimeString().slice(0, 5));
    setNotes('');
    setPottyPoop(false);
    setPottyPee(false);
    setShowModal(true);
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={handleFABClick}
        className="fixed bottom-10 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all z-40"
        style={{ boxShadow: '0 4px 16px rgba(232, 114, 42, 0.35)' }}
        aria-label="Add new task"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      {/* Bottom Sheet (tri-mode: Add Custom / Edit Custom / Edit Routine) */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={handleCancel}
        >
          <div
            className="bg-background rounded-t-3xl p-6 w-full max-w-[390px] mx-auto max-h-[70vh] flex flex-col"
            style={{ boxShadow: '0 -4px 24px rgba(45, 27, 14, 0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4 flex-shrink-0" />

            <h3 className="text-xl font-bold text-foreground mb-5 flex-shrink-0">
              {isEditMode ? 'Edit Task' : 'Add Custom Task'}
            </h3>

            <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
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

              {/* Activity Type Grid */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Activity Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedActivity(option.value);
                        // Clear potty details when switching away from potty
                        if (option.value !== 'potty_break') {
                          setPottyPoop(false);
                          setPottyPee(false);
                        }
                      }}
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

              {/* Potty Details — conditional, only when activity type is potty_break (D53) */}
              {selectedActivity === 'potty_break' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Details</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPottyPoop(!pottyPoop)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                        pottyPoop
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-foreground hover:bg-accent/80'
                      }`}
                    >
                      <span>💩</span>
                      <span>Poop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPottyPee(!pottyPee)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                        pottyPee
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-foreground hover:bg-accent/80'
                      }`}
                    >
                      <span>💦</span>
                      <span>Pee</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Notes Field */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => {
                    if (e.target.value.length <= 200) {
                      setNotes(e.target.value);
                    }
                  }}
                  placeholder="Add a note..."
                  rows={1}
                  maxLength={200}
                  className="w-full px-3 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm resize-none overflow-y-auto"
                  style={{ minHeight: '40px', maxHeight: '72px' }}
                />
                {notes.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1 text-right">
                    {notes.length}/200
                  </p>
                )}
              </div>

            </div>

            {/* Buttons — pinned at bottom outside scrollable area */}
            <div className="flex gap-3 pt-4 flex-shrink-0">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 py-3 px-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedActivity || isSaving}
                className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
              >
                {isSaving
                  ? (isEditMode ? 'Saving...' : 'Adding...')
                  : (isEditMode ? 'Save Changes' : 'Add Task')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
