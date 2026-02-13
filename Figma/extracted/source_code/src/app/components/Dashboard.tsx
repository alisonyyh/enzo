import { useState } from "react";
import { CheckCircle2, Circle, XCircle, Settings, User, Users } from "lucide-react";
import { toast } from "sonner";
import { RoutineReveal } from "./RoutineReveal";

interface DashboardProps {
  routine: any;
  accountData: { name: string; email: string };
  puppyName: string;
  isFirstTime?: boolean;
  onOpenSettings: () => void;
}

interface ActivityCompletion {
  time: string;
  completedBy: "owner" | "caretaker";
  timestamp: Date;
  avatarUrl?: string;
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  feeding: "#E8722A", // Orange for meals
  potty: "#4A9B5E", // Green for potty breaks
  exercise: "#5B8FD4", // Blue for exercise and play
  play: "#5B8FD4", // Blue for play
  training: "#8B6FC0", // Purple for training
  rest: "#8B7355", // Brown for rest/sleep
  bonding: "#8B7355", // Brown for bonding
  default: "#8B7355" // Brown for other activities
};

// Avatar URLs for completed tasks
const AVATAR_URLS = [
  "https://images.unsplash.com/photo-1689600944138-da3b150d9cb8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMGhlYWRzaG90JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzcwNjg5MTM0fDA&ixlib=rb-4.1.0&q=80&w=1080",
  "https://images.unsplash.com/photo-1672685667592-0392f458f46f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MDY5MzE0N3ww&ixlib=rb-4.1.0&q=80&w=1080",
  "https://images.unsplash.com/photo-1762753674498-73ec49feafc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGFkdWx0JTIwaGVhZHNob3QlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzA3ODMwNDZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
];

export function Dashboard({ routine, accountData, puppyName, isFirstTime = false, onOpenSettings }: DashboardProps) {
  const [completedActivities, setCompletedActivities] = useState<Map<string, ActivityCompletion>>(new Map());
  const [showReveal, setShowReveal] = useState(isFirstTime);
  const [showFirstTimeTooltip, setShowFirstTimeTooltip] = useState(false);
  const [currentUser, setCurrentUser] = useState<"owner" | "caretaker">("owner"); // Mock - in real app this would be determined by auth

  const currentDate = new Date();
  const currentTime = currentDate.toLocaleTimeString("en-US", { 
    hour: "2-digit", 
    minute: "2-digit",
    hour12: false 
  });

  const handleRevealDismiss = () => {
    setShowReveal(false);
    if (isFirstTime) {
      setTimeout(() => {
        setShowFirstTimeTooltip(true);
        setTimeout(() => setShowFirstTimeTooltip(false), 5000);
      }, 500);
    }
  };

  const toggleActivity = (time: string, activity: string) => {
    const newCompleted = new Map(completedActivities);
    if (newCompleted.has(time)) {
      newCompleted.delete(time);
    } else {
      const avatarUrl = AVATAR_URLS[Math.floor(Math.random() * AVATAR_URLS.length)];
      newCompleted.set(time, { time, completedBy: currentUser, timestamp: new Date(), avatarUrl });
      toast.success(`${activity} completed!`);
    }
    setCompletedActivities(newCompleted);
  };

  // Determine activity status
  const getActivityStatus = (activityTime: string) => {
    const isCompleted = completedActivities.has(activityTime);
    const isPast = activityTime < currentTime;
    const isCurrent = !isCompleted && isPast;
    
    return { isCompleted, isPast, isCurrent };
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  };

  // Calculate stats
  const totalActivities = routine.dailySchedule.length;
  const completedCount = completedActivities.size;
  const completionPercentage = Math.round((completedCount / totalActivities) * 100);
  
  const ownerCompletions = Array.from(completedActivities.values()).filter(a => a.completedBy === "owner").length;
  const caretakerCompletions = Array.from(completedActivities.values()).filter(a => a.completedBy === "caretaker").length;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div className="w-[390px] h-screen bg-background flex flex-col overflow-hidden" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
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

        {/* Stats Overview */}
        <div className="px-5 pb-4">
          <div className="bg-card rounded-2xl p-5" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
            {/* Main Progress */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm text-muted-foreground mb-1">Today's Progress</h3>
                <p className="text-3xl font-bold text-foreground">
                  {completedCount}<span className="text-lg text-muted-foreground">/{totalActivities}</span>
                </p>
              </div>
              <div className="relative w-16 h-16">
                {/* Circular Progress */}
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
        <div className="flex-1 overflow-y-auto px-5 space-y-3">
          {routine.dailySchedule.map((activity: any, index: number) => {
            const { isCompleted, isPast, isCurrent } = getActivityStatus(activity.time);
            const categoryColor = getCategoryColor(activity.category);
            const completion = completedActivities.get(activity.time);
            
            return (
              <button
                key={index}
                onClick={() => toggleActivity(activity.time, activity.activity)}
                className="w-full"
              >
                <div
                  className={`
                    bg-card rounded-xl p-4 min-h-[64px] flex gap-3 transition-all
                    ${isCurrent ? 'border-l-2 border-primary' : ''}
                    ${isCompleted ? 'opacity-60' : ''}
                  `}
                  style={{
                    backgroundColor: isCurrent ? '#FFF3EB' : '#FFFFFF',
                    boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)'
                  }}
                >
                  {/* Time */}
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="text-sm font-bold text-foreground w-14 text-left">
                      {formatDisplayTime(activity.time)}
                    </div>
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {/* Category dot */}
                          <div 
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                            style={{ backgroundColor: categoryColor }}
                          />
                          <h3 className={`font-medium text-base text-foreground ${isCompleted ? 'line-through' : ''}`}>
                            {activity.activity}
                          </h3>
                        </div>
                        <p className="text-[13px] text-muted-foreground mt-0.5 ml-3.5" style={{ lineHeight: '1.5' }}>
                          {activity.description}
                        </p>
                      </div>

                      {/* Status Icon or Profile Picture */}
                      <div className="flex-shrink-0 pt-0.5">
                        {isCompleted && completion?.avatarUrl ? (
                          <div className="relative">
                            <img 
                              src={completion.avatarUrl} 
                              alt="Completed by" 
                              className="w-6 h-6 rounded-full object-cover"
                              style={{ 
                                border: '2px solid white',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                            {/* Green checkmark on top-right corner */}
                            <div className="absolute -top-1 -right-1">
                              <CheckCircle2 className="size-3.5 text-secondary" fill="currentColor" />
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <CheckCircle2 className="size-6 text-secondary" />
                        ) : isPast && !isCurrent ? (
                          <XCircle className="size-6 text-destructive" />
                        ) : (
                          <Circle className="size-6 text-border" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* First Time Tooltip */}
        {showFirstTimeTooltip && (
          <div 
            className="fixed left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-3 rounded-xl shadow-lg max-w-[350px] mx-auto animate-pulse"
            style={{ bottom: '50px' }}
          >
            <p className="text-sm text-center">💡 Tap any activity to mark it done</p>
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

function formatDisplayTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}