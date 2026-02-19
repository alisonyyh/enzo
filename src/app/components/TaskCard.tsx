import { CheckCircle2, Circle } from 'lucide-react';
import { Task } from '../../lib/services/tasks';

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

interface TaskCardProps {
  task: Task;
  /** Called when the user taps the card (opens edit bottom sheet). */
  onEdit?: (task: Task) => void;
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const categoryColor = getCategoryColor(task.activityType);
  const taskDate = task.actualTime.toDate();

  return (
    <div
      onClick={() => onEdit?.(task)}
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
                {task.activityType === 'potty_break' && (task.pottyDetails?.poop || task.pottyDetails?.pee) && (
                  <span className="ml-1">
                    {task.pottyDetails.poop && '💩'}
                    {task.pottyDetails.pee && '💦'}
                  </span>
                )}
              </h3>
            </div>
            {task.description ? (
              <p className="text-[13px] text-muted-foreground mt-0.5 ml-3.5" style={{ lineHeight: '1.5' }}>
                {task.description}
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground mt-0.5 ml-3.5" style={{ lineHeight: '1.5' }}>
                {task.activityType.replace(/_/g, ' ')}
                {task.isUserAdded && ' · custom'}
              </p>
            )}
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
