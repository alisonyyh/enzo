import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Settings } from "lucide-react";
import { RoutineReveal } from "./RoutineReveal";
import { SwipeableTaskCard } from "./SwipeableTaskCard";
import { AddTaskFAB, type EditingItem } from "./AddTaskFAB";
import { NetworkStatusBanner } from "./NetworkStatusBanner";
import { CompletionAvatar } from "./CompletionAvatar";
import { SwipeableRoutineCard } from "./SwipeableRoutineCard";
import { subscribeToTasks, Task } from "../../lib/services/tasks";
import { subscribeToDeletedRoutineItems } from "../../lib/services/deleted-routine-items";
import { subscribeToEditedRoutineItems, type RoutineItemEdit } from "../../lib/services/edited-routine-items";
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
  onOpenSettings
}: DashboardProps) {
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
  useEffect(() => {
    async function loadLogs() {
      try {
        const logs = await getTodayLogs(puppyId);
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

    // Subscribe to real-time updates (INSERT/UPDATE and DELETE)
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
  }, [puppyId]);

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
  useEffect(() => {
    let unsubscribeTasks: (() => void) | null = null;
    let unsubscribeDeleted: (() => void) | null = null;
    let unsubscribeEdited: (() => void) | null = null;

    async function init() {
      try {
        await signInToFirebase();

        unsubscribeTasks = subscribeToTasks(
          puppyId,
          (updatedTasks) => {
            setCustomTasks(updatedTasks);
            setIsLoadingCustomTasks(false);
          },
          (err) => {
            setCustomTasksError(err.message);
            setIsLoadingCustomTasks(false);
          }
        );

        // Subscribe to deleted routine item IDs
        unsubscribeDeleted = subscribeToDeletedRoutineItems(
          puppyId,
          (deletedIds) => {
            setDeletedRoutineItemIds(deletedIds);
          },
          (err) => {
            console.error('Failed to load deleted routine items:', err);
          }
        );

        // Subscribe to edited routine item overrides
        unsubscribeEdited = subscribeToEditedRoutineItems(
          puppyId,
          (edits) => {
            setEditedRoutineItems(edits);
          },
          (err) => {
            console.error('Failed to load edited routine items:', err);
          }
        );
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
  }, [puppyId]);

  const handleRevealDismiss = () => {
    setShowReveal(false);
    if (isFirstTime) {
      setTimeout(() => {
        setShowFirstTimeTooltip(true);
        setTimeout(() => setShowFirstTimeTooltip(false), 5000);
      }, 500);
    }
  };

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
      ? { ...item, time: edit.time, activity: edit.title, description: edit.description, category: edit.activityType, isEdited: true }
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

          {/* Date below title */}
          <p className="text-sm text-muted-foreground text-center">
            {currentDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric"
            })}
          </p>
        </div>

        {/* Stats Overview - Progress Ring */}
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

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 pb-20 space-y-3">
          {timelineItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-2">🐾</div>
              <p>No activities for today</p>
              <p className="text-xs mt-1">Tap + to add a custom task</p>
            </div>
          )}

          {timelineItems.map((entry, index) => {
            if (entry.type === 'custom') {
              // Custom task — swipeable, tapping opens edit bottom sheet
              return (
                <SwipeableTaskCard
                  key={`custom-${entry.task.id}`}
                  task={entry.task}
                  onEdit={(task) => setEditingItem({ type: 'custom', task })}
                />
              );
            }

            // Routine item — original Figma Make card style
            const item = entry.item;
            const log = activityLogs.get(item.id);
            const isCompleted = log?.status === 'completed';
            const completerProfile = log?.completer_profile;
            const { isPast } = getActivityStatus(item.time);
            const isCurrent = !isCompleted && isPast;
            const categoryColor = getCategoryColor(item.category);

            return (
              <SwipeableRoutineCard
                key={`routine-${item.id}`}
                puppyId={puppyId}
                routineItemId={item.id}
              >
                <div
                  onClick={() => {
                    // Open edit bottom sheet for routine item
                    setEditingItem({
                      type: 'routine',
                      routineItemId: item.id,
                      puppyId,
                      time: item.time,
                      category: item.category,
                      activity: item.activity,
                      description: item.description || '',
                    });
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
                          </h3>
                        </div>
                        {item.description && (
                          <p className="text-[13px] text-muted-foreground mt-0.5 ml-3.5" style={{ lineHeight: '1.5' }}>
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Tappable Status Icon on RIGHT — toggles complete/undo */}
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
                    </div>
                  </div>
                </div>
              </SwipeableRoutineCard>
            );
          })}
        </div>

        {/* FAB Button for Adding Custom Tasks + Edit Bottom Sheet */}
        <AddTaskFAB
          puppyId={puppyId}
          editingItem={editingItem}
          onEditDone={() => setEditingItem(null)}
        />

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
