import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { WeightLog } from '../../lib/database.types';

interface LogWeightSheetProps {
  /** When provided, the sheet opens in edit mode with pre-populated data */
  editingEntry?: WeightLog | null;
  /** Default unit for new entries */
  defaultUnit: string;
  /** Earliest date allowed (puppy created_at) */
  minDate: string;
  onSave: (data: {
    weight_value: number;
    weight_unit: string;
    logged_at: string;
    note: string | null;
  }) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

export function LogWeightSheet({
  editingEntry,
  defaultUnit,
  minDate,
  onSave,
  onDelete,
  onClose,
}: LogWeightSheetProps) {
  const isEditMode = !!editingEntry;

  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState(defaultUnit || 'lbs');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pre-populate when editing
  useEffect(() => {
    if (editingEntry) {
      setWeight(String(editingEntry.weight_value));
      setUnit(editingEntry.weight_unit);
      setDate(editingEntry.logged_at);
      setNote(editingEntry.note || '');
    }
  }, [editingEntry]);

  const weightNum = parseFloat(weight);
  const isValid = !isNaN(weightNum) && weightNum > 0 && weightNum <= 300 && date;

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);
    try {
      await onSave({
        weight_value: weightNum,
        weight_unit: unit,
        logged_at: date,
        note: note.trim() || null,
      });
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete?.();
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const minDateFormatted = minDate ? minDate.split('T')[0] : undefined;

  return (
    <>
      {/* Bottom Sheet Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-end"
        onClick={onClose}
      >
        <div
          className="bg-background rounded-t-3xl p-6 w-full max-w-[390px] mx-auto max-h-[70vh] flex flex-col"
          style={{ boxShadow: '0 -4px 24px rgba(45, 27, 14, 0.15)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4 flex-shrink-0" />

          {/* Title */}
          <h3 className="text-xl font-bold text-foreground mb-5 flex-shrink-0">
            {isEditMode ? 'Edit Weight Entry' : 'Log Weight'}
          </h3>

          {/* Scrollable content */}
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Weight + Unit Row */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Weight
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0.1"
                  max="300"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 px-3 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm"
                  autoFocus
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-20 px-3 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm appearance-none text-center"
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={today}
                min={minDateFormatted}
                className="w-full px-3 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm"
              />
            </div>

          </div>

          {/* Footer Buttons */}
          <div className="flex gap-3 pt-4 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 px-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            {isEditMode && !editingEntry?.is_onboarding && onDelete && (
              <button
                onClick={handleDeleteClick}
                disabled={isSaving}
                className="py-3 px-4 text-destructive hover:opacity-80 transition-opacity"
              >
                Delete
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isValid || isSaving}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              {isSaving
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && editingEntry && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-6"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-[320px] w-full"
            style={{ boxShadow: '0 8px 32px rgba(45, 27, 14, 0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-bold text-foreground text-center">
              Delete Weight Entry?
            </h4>
            <p className="text-sm text-muted-foreground text-center mt-3">
              Are you sure you want to delete the weight entry from{' '}
              {format(new Date(editingEntry.logged_at + 'T00:00:00'), 'MMM d, yyyy')} ({editingEntry.weight_value} {editingEntry.weight_unit})?
            </p>
            <p className="text-sm text-destructive text-center mt-2">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 px-4 border border-border rounded-xl text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-3 px-4 bg-destructive text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
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
