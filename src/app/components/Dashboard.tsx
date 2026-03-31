import { useState, useEffect, useMemo, useCallback } from "react";
import { CheckCircle2, Circle, Settings, ChevronDown, ArrowLeft } from "lucide-react";
import { RoutineReveal } from "./RoutineReveal";
import { SwipeableTaskCard } from "./SwipeableTaskCard";
import { AddTaskFAB, type EditingItem } from "./AddTaskFAB";
import { NetworkStatusBanner } from "./NetworkStatusBanner";
import { CompletionAvatar } from "./CompletionAvatar";
import { SwipeableRoutineCard } from "./SwipeableRoutineCard";
import { CalendarPicker } from "./CalendarPicker";
import { subscribeToTasks, getTasksForDate, getTodayString, Task } from "../../lib/services/tasks";
import { subscribeToDeletedRoutineItems, getDeletedRoutineItemsForDate } from "../../lib/services/deleted-routine-items";
import { subscribeToEditedRoutineItems, getEditedRoutineItemsForDate, type RoutineItemEdit } from "../../lib/services/edited-routine-items";
import { signInToFirebase } from "../../lib/firebase";
import {
  getTodayLogs,
  completeActivity,
  undoActivity,
  subscribeToActivityLogs,
  type ActivityLogWithProfile
} from "../../lib/services/activity-logs";
import { subscribeToProfileChanges } from "../../lib/services/auth";

interface DashboardProps {
  routine: any;
  accountData: { name: string; email: string };
  puppyName: string;
  puppyId: string;
  userId: string;
  userRole: "owner" | "caretaker";
  isFirstTime?: boolean;
  onOpenSettings: () => void;
  /** Puppy creation date string (ISO) — used as calendar min bound (D59) */
  puppyCreatedAt?: string;
}

// Category color mapping (matches original Figma design)
const CATEGORY_COLORS: Record<string, string> = {
  feeding: "#E8722A",
  potty: "#4A9B5E",
  exercise: "#5B8FD4",
  play: "#5B8FD4",
  training: "#8B6FC0",
  rest: "#8B7355",
  bonding: "#8B7355",
  sleep: "#8B7355",
  default: "#8B7355"
};

export function Dashboard({
  routine,
  accountData,
  puppyName,
  puppyId,
  userId,
  userRole,
  isFirstTime = false,
  onOpenSettings,
  puppyCreatedAt
}: DashboardProps) {
  // Day Navigation — Calendar Picker state (D58, Flow 8)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Derived: is user viewing today? (D60)
  const isViewingToday = useMemo(() => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  }, [selectedDate]);

  // Selected date as YYYY-MM-DD string for service calls
  const selectedDateString = useMemo(() => getTodayString(selectedDate), [selectedDate]);

  // Calendar bounds (D59)
  const calendarMinDate = useMemo(() => {
    if (puppyCreatedAt) {
      const d = new Date(puppyCreatedAt);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    // Fallback: 30 days ago
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [puppyCreatedAt]);

  const calendarMaxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Flow 6 custom tasks (Firebase)
  const [customTasks, setCustomTasks] = useState<Task[]>([]);
  const [isLoadingCustomTasks, setIsLoadingCustomTasks] = useState(true);
  const [customTasksError, setCustomTasksError] = useState<string | null>(null);

  // Original routine activity logs (Supabase)
  const [activityLogs, setActivityLogs] = useState<Map<string, ActivityLogWithProfile>>(new Map());
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Deleted routine item IDs (Firebase — persists across refresh)
  const [deletedRoutineItemIds, setDeletedRoutineItemIds] = useState<Set<string>>(new Set());

  // Task or routine item being edited via bottom sheet (null = not editing)
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

  // View-only task detail for non-today views (D67)
  const [viewingItem, setViewingItem] = useState<{
    time: string;
    activity: string;
    description: string;
    category: string;
    pottyDetails?: { poop: boolean; pee: boolean };
    isCompleted: boolean;
    type: 'routine' | 'custom';
  } | null>(null);

  // Edited routine item overrides (Firebase — persists edits to AI-generated items)
  const [editedRoutineItems, setEditedRoutineItems] = useState<Map<string, RoutineItemEdit>>(new Map());

  const [showReveal, setShowReveal] = useState(isFirstTime);
  const [showFirstTimeTooltip, setShowFirstTimeTooltip] = useState(false);

  const currentDate = new Date();
  const currentTime = currentDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  // Load routine activity logs from Supabase
  // D64: Real-time subscription only for today; static fetch for other dates
  useEffect(() => {
    setIsLoadingLogs(true);

    async function loadLogs() {
      try {
        const logs = await getTodayLogs(puppyId, selectedDateString);
        const logMap = new Map<string, ActivityLogWithProfile>();
        logs.forEach(log => {
          logMap.set(log.routine_item_id, log);
        });
        setActivityLogs(logMap);
        setIsLoadingLogs(false);
      } catch (err) {
        console.error('Failed to load activity logs:', err);
        setIsLoadingLogs(false);
      }
    }

    loadLogs();

    // Only subscribe to real-time updates when viewing today (D64)
    if (isViewingToday) {
      const channel = subscribeToActivityLogs(
        puppyId,
        (log) => {
          setActivityLogs(prev => {
            const newMap = new Map(prev);
            newMap.set(log.routine_item_id, log);
            return newMap;
          });
        },
        (routineItemId) => {
          setActivityLogs(prev => {
            const newMap = new Map(prev);
            newMap.delete(routineItemId);
            return newMap;
          });
        }
      );

      return () => {
        channel.unsubscribe();
      };
    }
  }, [puppyId, selectedDateString, isViewingToday]);

  // Subscribe to profile picture changes for all users who have completed tasks today.
  // When a co-user updates their avatar, update their avatar_url in the activityLogs map
  // so CompletionAvatar re-renders with the new photo within ~1 second.
  useEffect(() => {
    const completedByIds = Array.from(activityLogs.values())
      .map(log => log.completed_by)
      .filter((id): id is string => !!id);

    const uniqueIds = [...new Set(completedByIds)];
    if (uniqueIds.length === 0) return;

    const unsubscribe = subscribeToProfileChanges(uniqueIds, (userId, newAvatarUrl) => {
      setActivityLogs(prev => {
        const newMap = new Map(prev);
        newMap.forEach((log, key) => {
          if (log.completed_by === userId && log.completer_profile) {
            newMap.set(key, {
              ...log,
              completer_profile: { ...log.completer_profile, avatar_url: newAvatarUrl },
            });
          }
        });
        return newMap;
      });
    });

    return unsubscribe;
  }, [activityLogs]);

  // Initialize Firebase and subscribe to custom tasks + deleted/edited routine items
  // D64: Real-time subscriptions for today; static fetch for other dates
  useEffect(() => {
    let unsubscribeTasks: (() => void) | null = null;
    let unsubscribeDeleted: (() => void) | null = null;
    let unsubscribeEdited: (() => void) | null = null;

    setIsLoadingCustomTasks(true);

    async function init() {
      try {
        await signInToFirebase();

        if (isViewingToday) {
          // Today: real-time subscriptions
          unsubscribeTasks = subscribeToTasks(
            puppyId,
            (updatedTasks) => {
              setCustomTasks(updatedTasks);
              setIsLoadingCustomTasks(false);
            },
            (err) => {
              setCustomTasksError(err.message);
              setIsLoadingCustomTasks(false);
            },
            selectedDateString
          );

          unsubscribeDeleted = subscribeToDeletedRoutineItems(
            puppyId,
            (deletedIds) => {
              setDeletedRoutineItemIds(deletedIds);
            },
            (err) => {
              console.error('Failed to load deleted routine items:', err);
            },
            selectedDateString
          );

          unsubscribeEdited = subscribeToEditedRoutineItems(
            puppyId,
            (edits) => {
              setEditedRoutineItems(edits);
            },
            (err) => {
              console.error('Failed to load edited routine items:', err);
            },
            selectedDateString
          );
        } else {
          // Non-today: one-time static fetch (D64, D65)
          const [tasks, deletedIds, edits] = await Promise.all([
            getTasksForDate(puppyId, selectedDateString),
            getDeletedRoutineItemsForDate(puppyId, selectedDateString),
            getEditedRoutineItemsForDate(puppyId, selectedDateString),
          ]);

          setCustomTasks(tasks);
          setDeletedRoutineItemIds(deletedIds);
          setEditedRoutineItems(edits);
          setIsLoadingCustomTasks(false);
        }
      } catch (err) {
        console.error('Dashboard: Firebase init failed:', err);
        setCustomTasksError(err instanceof Error ? err.message : 'Failed to load custom tasks');
        setIsLoadingCustomTasks(false);
      }
    }

    init();

    return () => {
      unsubscribeTasks?.();
      unsubscribeDeleted?.();
      unsubscribeEdited?.();
    };
  }, [puppyId, selectedDateString, isViewingToday]);

  const handleRevealDismiss = () => {
    setShowReveal(false);
    if (isFirstTime) {
      setTimeout(() => {
        setShowFirstTimeTooltip(true);
        setTimeout(() => setShowFirstTimeTooltip(false), 5000);
      }, 500);
    }
  };

  // Calendar navigation handlers (D58, D61)
  const handleGoToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
    setIsCalendarOpen(false);
  }, []);

  const handleCalendarSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsCalendarOpen(false);
  }, []);

  const handleRoutineActivityComplete = async (routineItemId: string) => {
    // Optimistic update — show completed immediately
    setActivityLogs(prev => {
      const newMap = new Map(prev);
      newMap.set(routineItemId, {
        routine_item_id: routineItemId,
        puppy_id: puppyId,
        status: 'completed',
        completed_by: userId,
        completed_at: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        completer_profile: { display_name: accountData.name, avatar_url: null },
      } as ActivityLogWithProfile);
      return newMap;
    });
    try {
      await completeActivity(routineItemId, puppyId, userId);
    } catch (err) {
      console.error('Error completing routine activity:', err);
      // Revert optimistic update on error
      setActivityLogs(prev => {
        const newMap = new Map(prev);
        newMap.delete(routineItemId);
        return newMap;
      });
    }
  };

  const handleRoutineActivityUndo = async (routineItemId: string) => {
    // Optimistic update — remove completed state immediately
    const previousLog = activityLogs.get(routineItemId);
    setActivityLogs(prev => {
      const newMap = new Map(prev);
      newMap.delete(routineItemId);
      return newMap;
    });
    try {
      await undoActivity(routineItemId);
    } catch (err) {
      console.error('Error undoing routine activity:', err);
      // Revert optimistic update on error
      if (previousLog) {
        setActivityLogs(prev => {
          const newMap = new Map(prev);
          newMap.set(routineItemId, previousLog);
          return newMap;
        });
      }
    }
  };

  // Determine activity status (matches original Figma logic)
  const getActivityStatus = (activityTime: string) => {
    const isPast = activityTime < currentTime;
    return { isPast };
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category?.toLowerCase()] || CATEGORY_COLORS.default;
  };

  // Calculate combined stats (routine + custom tasks), excluding deleted routine items
  const allRoutineItems = routine?.dailySchedule || [];
  const routineItems = allRoutineItems.filter((item: any) => !deletedRoutineItemIds.has(item.id));
  const completedRoutineCount = routineItems.filter((item: any) => {
    const log = activityLogs.get(item.id);
    return log?.status === 'completed';
  }).length;

  const completedCustomTasksCount = customTasks.filter(t => t.isCompleted).length;

  const totalTasks = routineItems.length + customTasks.length;
  const completedCount = completedRoutineCount + completedCustomTasksCount;
  const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const isLoading = isLoadingLogs || isLoadingCustomTasks;

  // Build unified timeline: merge routine items + custom tasks, sorted by time
  type TimelineItem =
    | { type: 'routine'; item: any; timeMinutes: number }
    | { type: 'custom'; task: Task; timeMinutes: number };

  const timelineItems: TimelineItem[] = [];

  // Add routine items (apply edits from editedRoutineItems overlay)
  routineItems.forEach((item: any) => {
    const edit = editedRoutineItems.get(item.id);
    const effectiveItem = edit
      ? { ...item, time: edit.time, activity: edit.title, description: edit.description, category: edit.activityType, pottyDetails: edit.pottyDetails, isEdited: true }
      : item;
    const [hours, minutes] = (effectiveItem.time || '00:00').split(':').map(Number);
    timelineItems.push({
      type: 'routine',
      item: effectiveItem,
      timeMinutes: hours * 60 + minutes,
    });
  });

  // Add custom tasks
  customTasks.forEach((task) => {
    const date = task.actualTime.toDate();
    timelineItems.push({
      type: 'custom',
      task,
      timeMinutes: date.getHours() * 60 + date.getMinutes(),
    });
  });

  // Sort by time
  timelineItems.sort((a, b) => a.timeMinutes - b.timeMinutes);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🐶</div>
          <p className="text-muted-foreground">Loading {puppyName}'s day...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div className="w-[390px] h-screen bg-background flex flex-col overflow-hidden" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
        {/* Network Status Banner */}
        <NetworkStatusBanner />

        {/* Header */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            {/* Left: Puppy emoji circle */}
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-lg">
              🐶
            </div>

            {/* Center: Title */}
            <h1 className="text-2xl font-bold text-foreground flex-1 text-center">
              {puppyName}'s Day
            </h1>

            {/* Right: Settings icon */}
            <button className="w-8 h-8 flex items-center justify-center" onClick={onOpenSettings}>
              <Settings className="size-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tappable date header — opens calendar picker (D58, Flow 8A) */}
          <button
            onClick={() => setIsCalendarOpen(true)}
            className="flex items-center justify-center gap-1 mx-auto active:opacity-70 transition-opacity"
          >
            <p className="text-sm text-muted-foreground">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric"
              })}
            </p>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>

          {/* "← Today" pill button — only visible when not viewing today (D61) */}
          {!isViewingToday && (
            <div className="flex justify-center mt-2">
              <button
                onClick={handleGoToToday}
                className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full hover:bg-primary/90 active:scale-95 transition-all"
              >
                <ArrowLeft className="size-3" />
                Today
              </button>
            </div>
          )}
        </div>

        {/* Stats Overview - Progress Ring (D68: hidden on non-today views) */}
        {isViewingToday ? (
          <div className="px-5 pb-4">
            <div className="bg-card rounded-2xl p-5" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">Today's Progress</h3>
                  <p className="text-3xl font-bold text-foreground">
                    {completedCount}<span className="text-lg text-muted-foreground">/{totalTasks}</span>
                  </p>
                </div>
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#F5E6DC"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#E8722A"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - completionPercentage / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-foreground">{completionPercentage}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Read-only banner for non-today views (D60) */
          <div className="px-5 pb-4">
            <div className="bg-accent rounded-2xl px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">
                {selectedDate > new Date() ? '📅 Tomorrow\'s Preview' : '📋 Past Day View'} — Read Only
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {completedCount}/{totalTasks} completed
              </p>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 pb-20 space-y-3">
          {timelineItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-2">🐾</div>
              <p>No activities for {isViewingToday ? 'today' : 'this day'}</p>
              {isViewingToday && <p className="text-xs mt-1">Tap + to add a custom task</p>}
            </div>
          )}

          {timelineItems.map((entry, index) => {
            if (entry.type === 'custom') {
              if (isViewingToday) {
                // Today: swipeable, tapping opens edit bottom sheet
                return (
                  <SwipeableTaskCard
                    key={`custom-${entry.task.id}`}
                    task={entry.task}
                    onEdit={(task) => setEditingItem({ type: 'custom', task })}
                  />
                );
              } else {
                // Non-today: read-only card, tapping opens view-only detail (D67)
                const task = entry.task;
                const taskDate = task.actualTime.toDate();
                const taskTime = `${taskDate.getHours().toString().padStart(2, '0')}:${taskDate.getMinutes().toString().padStart(2, '0')}`;
                return (
                  <div
                    key={`custom-${task.id}`}
                    onClick={() => setViewingItem({
                      time: taskTime,
                      activity: task.title,
                      description: task.description || '',
                      category: task.activityType,
                      pottyDetails: task.pottyDetails,
                      isCompleted: task.isCompleted,
                      type: 'custom',
                    })}
                    className={`
                      bg-card rounded-xl p-4 min-h-[64px] flex gap-3 transition-all cursor-pointer active:scale-[0.98]
                      ${task.isCompleted ? 'opacity-60' : ''}
                    `}
                    style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      <div className="text-sm font-bold text-foreground w-14 text-left">
                        {formatDisplayTime(taskTime)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: getCategoryColor(task.activityType) }} />
                            <h3 className={`font-medium text-base text-foreground ${task.isCompleted ? 'line-through' : ''}`}>
                              {task.title}
                              {task.activityType === 'potty_break' && (task.pottyDetails?.poop || task.pottyDetails?.pee) && (
                                <span className="ml-1">{task.pottyDetails?.poop && '💩'}{task.pottyDetails?.pee && '💦'}</span>
                              )}
                            </h3>
                          </div>
                          {task.description && (
                            <p className="text-[13px] text-muted-foreground mt-0.5 ml-3.5" style={{ lineHeight: '1.5' }}>{task.description}</p>
                          )}
                        </div>
                        {task.isCompleted ? (
                          <CheckCircle2 className="size-6 text-secondary flex-shrink-0 pt-0.5" />
                        ) : (
                          <Circle className="size-6 text-border flex-shrink-0 pt-0.5" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            }

            // Routine item — original Figma Make card style
            const item = entry.item;
            const log = activityLogs.get(item.id);
            const isCompleted = log?.status === 'completed';
            const completerProfile = log?.completer_profile;
            const { isPast } = getActivityStatus(item.time);
            // Only show "current" highlight on today's view (D69)
            const isCurrent = isViewingToday && !isCompleted && isPast;
            const categoryColor = getCategoryColor(item.category);

            // Routine card content (shared between swipeable and read-only)
            const routineCardContent = (
              <div
                onClick={() => {
                  if (isViewingToday) {
                    // Open edit bottom sheet for routine item
                    setEditingItem({
                      type: 'routine',
                      routineItemId: item.id,
                      puppyId,
                      time: item.time,
                      category: item.category,
                      activity: item.activity,
                      description: item.description || '',
                      pottyDetails: item.pottyDetails,
                    });
                  } else {
                    // Non-today: open view-only detail (D67)
                    setViewingItem({
                      time: item.time,
                      activity: item.activity,
                      description: item.description || '',
                      category: item.category,
                      pottyDetails: item.pottyDetails,
                      isCompleted: !!isCompleted,
                      type: 'routine',
                    });
                  }
                }}
                className={`
                  bg-card rounded-xl p-4 min-h-[64px] flex gap-3 transition-all cursor-pointer active:scale-[0.98]
                  ${isCurrent ? 'border-l-2 border-primary' : ''}
                  ${isCompleted ? 'opacity-60' : ''}
                `}
                style={{
                  backgroundColor: isCurrent ? '#FFF3EB' : '#FFFFFF',
                  boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)'
                }}
              >
                {/* Time on LEFT */}
                <div className="flex-shrink-0 pt-0.5">
                  <div className="text-sm font-bold text-foreground w-14 text-left">
                    {formatDisplayTime(item.time)}
                  </div>
                </div>

                {/* Activity Content in MIDDLE */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {/* Category dot */}
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                          style={{ backgroundColor: categoryColor }}
                        />
                        <h3 className={`font-medium text-base text-foreground ${isCompleted ? 'line-through' : ''}`}>
                          {item.activity}
                          {(item.category === 'potty' || item.category === 'potty_break') && (item.pottyDetails?.poop || item.pottyDetails?.pee) && (
                            <span className="ml-1">
                              {item.pottyDetails.poop && '💩'}
                              {item.pottyDetails.pee && '💦'}
                            </span>
                          )}
                        </h3>
                      </div>
                      {item.description && (
                        <p className="text-[13px] text-muted-foreground mt-0.5 ml-3.5" style={{ lineHeight: '1.5' }}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Status Icon on RIGHT */}
                    {isViewingToday ? (
                      /* Today: tappable toggle complete/undo */
                      <button
                        className="flex-shrink-0 pt-0.5 -m-1 p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCompleted) {
                            handleRoutineActivityUndo(item.id);
                          } else {
                            handleRoutineActivityComplete(item.id);
                          }
                        }}
                      >
                        {isCompleted && completerProfile ? (
                          <CompletionAvatar
                            avatarUrl={completerProfile.avatar_url}
                            displayName={completerProfile.display_name}
                            size={24}
                          />
                        ) : isCompleted ? (
                          <CheckCircle2 className="size-6 text-secondary" />
                        ) : (
                          <Circle className="size-6 text-border" />
                        )}
                      </button>
                    ) : (
                      /* Non-today: display-only status icon (D60) */
                      <div className="flex-shrink-0 pt-0.5">
                        {isCompleted ? (
                          <CheckCircle2 className="size-6 text-secondary" />
                        ) : (
                          <Circle className="size-6 text-border" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );

            if (isViewingToday) {
              return (
                <SwipeableRoutineCard
                  key={`routine-${item.id}`}
                  puppyId={puppyId}
                  routineItemId={item.id}
                >
                  {routineCardContent}
                </SwipeableRoutineCard>
              );
            } else {
              // Non-today: no swipe, just the card (D60)
              return (
                <div key={`routine-${item.id}`}>
                  {routineCardContent}
                </div>
              );
            }
          })}
        </div>

        {/* FAB Button for Adding Custom Tasks + Edit Bottom Sheet — only on today (D60) */}
        {isViewingToday && (
          <AddTaskFAB
            puppyId={puppyId}
            editingItem={editingItem}
            onEditDone={() => setEditingItem(null)}
          />
        )}

        {/* Calendar Picker Bottom Sheet (D58, D66) */}
        {isCalendarOpen && (
          <CalendarPicker
            selectedDate={selectedDate}
            minDate={calendarMinDate}
            maxDate={calendarMaxDate}
            onSelectDate={handleCalendarSelect}
            onClose={() => setIsCalendarOpen(false)}
            onGoToToday={handleGoToToday}
          />
        )}

        {/* View-Only Task Detail Bottom Sheet — for non-today views (D67) */}
        {viewingItem && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => setViewingItem(null)}
          >
            <div
              className="bg-background rounded-t-3xl p-6 w-full max-w-[390px] mx-auto"
              style={{ boxShadow: '0 -4px 24px rgba(45, 27, 14, 0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-5">Task Details</h3>

              <div className="space-y-4">
                {/* Time */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Time</label>
                  <p className="text-foreground text-sm">{formatDisplayTime(viewingItem.time)}</p>
                </div>

                {/* Activity Type */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Activity</label>
                  <p className="text-foreground text-sm">{viewingItem.activity}</p>
                </div>

                {/* Potty Details */}
                {(viewingItem.category === 'potty' || viewingItem.category === 'potty_break') && viewingItem.pottyDetails && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Potty Details</label>
                    <div className="flex gap-2">
                      {viewingItem.pottyDetails.poop && <span className="text-sm">💩 Poop</span>}
                      {viewingItem.pottyDetails.pee && <span className="text-sm">💦 Pee</span>}
                      {!viewingItem.pottyDetails.poop && !viewingItem.pottyDetails.pee && <span className="text-sm text-muted-foreground">None recorded</span>}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {viewingItem.description && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                    <p className="text-foreground text-sm">{viewingItem.description}</p>
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                  <div className="flex items-center gap-2">
                    {viewingItem.isCompleted ? (
                      <>
                        <CheckCircle2 className="size-4 text-secondary" />
                        <span className="text-sm text-foreground">Completed</span>
                      </>
                    ) : (
                      <>
                        <Circle className="size-4 text-border" />
                        <span className="text-sm text-muted-foreground">Not completed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Close button */}
              <div className="mt-5">
                <button
                  onClick={() => setViewingItem(null)}
                  className="w-full py-3 px-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* First Time Tooltip */}
        {showFirstTimeTooltip && (
          <div
            className="fixed left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-3 rounded-xl shadow-lg max-w-[350px] mx-auto animate-pulse z-50"
            style={{ bottom: '100px' }}
          >
            <p className="text-sm text-center">Tap the circle to mark complete, swipe left on any task to delete</p>
          </div>
        )}

        {/* Reveal Component */}
        {showReveal && (
          <RoutineReveal
            puppyName={puppyName}
            onDismiss={handleRevealDismiss}
          />
        )}
      </div>
    </div>
  );
}

// Format time to 12-hour display (matches original Figma design)
function formatDisplayTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}
