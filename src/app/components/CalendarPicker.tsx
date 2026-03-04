import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarPickerProps {
  /** Currently selected date */
  selectedDate: Date;
  /** Earliest allowed date (puppy creation date) */
  minDate: Date;
  /** Latest allowed date (tomorrow) — computed by parent */
  maxDate: Date;
  /** Called when user taps a valid date cell */
  onSelectDate: (date: Date) => void;
  /** Called when user taps backdrop or Close button */
  onClose: () => void;
  /** Called when user taps "Today" button */
  onGoToToday: () => void;
}

/**
 * CalendarPicker — Custom monthly calendar bottom sheet (D58, D66)
 *
 * - 7-column CSS grid with day-of-week headers
 * - Bounded from puppy creation date to tomorrow (D59)
 * - Highlights today with orange ring, selected date with filled orange
 * - "Today" button for quick return (D61)
 * - Month nav arrows with boundary enforcement
 */
export function CalendarPicker({
  selectedDate,
  minDate,
  maxDate,
  onSelectDate,
  onClose,
  onGoToToday,
}: CalendarPickerProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // The month being viewed in the calendar (defaults to selectedDate's month)
  const [viewMonth, setViewMonth] = useState(() => {
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  });

  // Generate calendar grid for the current view month
  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Build array: leading empties + day numbers
    const days: (Date | null)[] = [];

    // Add leading empty cells for days before the 1st
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add each day of the month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }, [viewMonth]);

  // Normalize dates for comparison (strip time)
  const normalizeDate = (d: Date) => {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n;
  };

  const normalizedMin = useMemo(() => normalizeDate(minDate), [minDate]);
  const normalizedMax = useMemo(() => normalizeDate(maxDate), [maxDate]);
  const normalizedSelected = useMemo(() => normalizeDate(selectedDate), [selectedDate]);

  const isDateDisabled = (date: Date) => {
    const normalized = normalizeDate(date);
    return normalized < normalizedMin || normalized > normalizedMax;
  };

  const isToday = (date: Date) => {
    return normalizeDate(date).getTime() === today.getTime();
  };

  const isSelected = (date: Date) => {
    return normalizeDate(date).getTime() === normalizedSelected.getTime();
  };

  // Can navigate to previous/next month?
  const canGoPrev = useMemo(() => {
    // Can go to prev month if the first day of current viewMonth is after minDate's month
    const prevMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
    const minMonth = new Date(normalizedMin.getFullYear(), normalizedMin.getMonth(), 1);
    return prevMonth >= minMonth;
  }, [viewMonth, normalizedMin]);

  const canGoNext = useMemo(() => {
    const nextMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    const maxMonth = new Date(normalizedMax.getFullYear(), normalizedMax.getMonth(), 1);
    return nextMonth <= maxMonth;
  }, [viewMonth, normalizedMax]);

  const handlePrevMonth = () => {
    if (canGoPrev) {
      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    }
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    }
  };

  const handleDateTap = (date: Date) => {
    if (!isDateDisabled(date)) {
      onSelectDate(normalizeDate(date));
    }
  };

  const monthLabel = viewMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Check if selectedDate is today
  const isViewingToday = normalizedSelected.getTime() === today.getTime();

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-t-3xl p-6 w-full max-w-[390px] mx-auto"
        style={{ boxShadow: '0 -4px 24px rgba(45, 27, 14, 0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />

        {/* Month navigation header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="size-5 text-foreground" />
          </button>

          <h3 className="text-lg font-semibold text-foreground">{monthLabel}</h3>

          <button
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="size-5 text-foreground" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayHeaders.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="h-10" />;
            }

            const disabled = isDateDisabled(date);
            const selected = isSelected(date);
            const todayCell = isToday(date);

            return (
              <button
                key={date.getDate()}
                onClick={() => handleDateTap(date)}
                disabled={disabled}
                className={`
                  h-10 w-full rounded-full flex items-center justify-center text-sm font-medium transition-all
                  ${disabled ? 'text-muted-foreground/30 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                  ${selected && !todayCell ? 'bg-primary text-primary-foreground' : ''}
                  ${selected && todayCell ? 'bg-primary text-primary-foreground' : ''}
                  ${todayCell && !selected ? 'ring-2 ring-primary text-primary' : ''}
                  ${!selected && !todayCell && !disabled ? 'text-foreground hover:bg-accent' : ''}
                `}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 mt-5">
          {!isViewingToday && (
            <button
              onClick={onGoToToday}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all"
            >
              Go to Today
            </button>
          )}
          <button
            onClick={onClose}
            className={`py-3 px-4 text-muted-foreground hover:text-foreground transition-colors ${isViewingToday ? 'flex-1' : 'flex-1'}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
