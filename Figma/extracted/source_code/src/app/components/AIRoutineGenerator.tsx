import { useEffect, useState } from "react";

interface QuestionnaireData {
  puppyName: string;
  breed: string;
  photoUrl: string;
  ageMonths: string;
  ageWeeks: string;
  weight: string;
  weightUnit: "lbs" | "kg";
  livingSituation: string;
  workArrangement: string;
  wakeUpTime: string;
  bedTime: string;
}

interface AIRoutineGeneratorProps {
  questionnaireData: QuestionnaireData;
  onComplete: (routine: any) => void;
}

const LOADING_MESSAGES = [
  `Analyzing ${"{puppyName}"}'s breed...`,
  "Building a personalized routine...",
  "Almost ready!"
];

export function AIRoutineGenerator({ questionnaireData, onComplete }: AIRoutineGeneratorProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const totalDuration = 8000; // 8 seconds
    const messageInterval = totalDuration / LOADING_MESSAGES.length;
    
    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1.25;
      });
    }, totalDuration / 80);

    // Message rotation
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => {
        if (prev >= LOADING_MESSAGES.length - 1) {
          clearInterval(messageTimer);
          return prev;
        }
        return prev + 1;
      });
    }, messageInterval);

    // Complete after duration
    const completionTimer = setTimeout(() => {
      const routine = generateRoutine(questionnaireData);
      onComplete(routine);
    }, totalDuration);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageTimer);
      clearTimeout(completionTimer);
    };
  }, [questionnaireData, onComplete]);

  const currentMessage = LOADING_MESSAGES[messageIndex].replace(
    "{puppyName}",
    questionnaireData.puppyName
  );

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-0"
      style={{
        background: 'linear-gradient(to bottom, #FFF9F5, #FFECD2)'
      }}
    >
      <div className="w-[390px] h-screen flex flex-col items-center justify-center" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
        {/* Animated puppy illustration */}
        <div className="flex justify-center mb-12">
          <div className="text-[140px] leading-none animate-bounce">
            🐶
          </div>
        </div>
        
        {/* Rotating message */}
        <p className="text-lg font-medium text-foreground text-center mb-6 px-8 min-h-[60px] flex items-center">
          {currentMessage}
        </p>
        
        {/* Progress bar */}
        <div className="w-64 h-1 bg-white/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function generateRoutine(data: QuestionnaireData) {
  const totalWeeks = parseInt(data.ageMonths) * 4 + parseInt(data.ageWeeks);
  const isYoungPuppy = totalWeeks < 12;
  
  // Parse wake and bed times
  const [wakeHour] = data.wakeUpTime.split(":").map(Number);
  const [bedHour] = data.bedTime.split(":").map(Number);
  
  // Calculate feeding times based on age and schedule
  const feedingTimes = isYoungPuppy 
    ? [
        formatTime(wakeHour, 0),
        formatTime(wakeHour + 4, 0),
        formatTime(wakeHour + 8, 0),
        formatTime(bedHour - 3, 0)
      ]
    : [
        formatTime(wakeHour, 0),
        formatTime(wakeHour + 5, 0),
        formatTime(bedHour - 3, 0)
      ];

  // Calculate potty break interval
  const pottyBreakInterval = isYoungPuppy ? "Every 2 hours" : "Every 3-4 hours";

  // Exercise recommendations based on living situation
  const hasYard = data.livingSituation === "house-with-yard";
  const exerciseDuration = isYoungPuppy ? "15-20 minutes" : "30-40 minutes";

  return {
    dailySchedule: [
      {
        time: formatTime(wakeHour - 0.5, 30),
        activity: "Wake up & Potty Break",
        description: "First thing in the morning, take outside for potty break",
        category: "potty"
      },
      {
        time: feedingTimes[0],
        activity: "Breakfast",
        description: `Morning meal`,
        category: "feeding"
      },
      {
        time: formatTime(wakeHour + 0.5, 30),
        activity: "Post-meal Potty Break",
        description: "Take outside 15-30 minutes after eating",
        category: "potty"
      },
      {
        time: formatTime(wakeHour + 1, 0),
        activity: "Morning Training Session",
        description: "5-10 minutes of basic commands (sit, stay, come)",
        category: "training"
      },
      {
        time: formatTime(wakeHour + 2, 0),
        activity: hasYard ? "Yard Playtime" : "Indoor Play",
        description: `${exerciseDuration} of active play`,
        category: "play"
      },
      {
        time: formatTime(wakeHour + 3, 0),
        activity: "Nap Time",
        description: "Quiet time in crate or designated area",
        category: "rest"
      },
      ...(isYoungPuppy ? [{
        time: feedingTimes[1],
        activity: "Lunch",
        description: "Midday meal",
        category: "feeding"
      }] : []),
      {
        time: formatTime(wakeHour + 5.5, 30),
        activity: "Midday Potty & Walk",
        description: "Short walk around the block",
        category: "exercise"
      },
      {
        time: formatTime(wakeHour + 6, 0),
        activity: "Afternoon Nap",
        description: "Rest time for growing puppy",
        category: "rest"
      },
      ...(isYoungPuppy ? [{
        time: formatTime(wakeHour + 8, 0),
        activity: "Afternoon Snack",
        description: "Light meal",
        category: "feeding"
      }] : []),
      {
        time: formatTime(bedHour - 6, 0),
        activity: "Training & Socialization",
        description: "Practice commands and expose to new experiences",
        category: "training"
      },
      {
        time: formatTime(bedHour - 4.5, 30),
        activity: "Evening Exercise",
        description: `${exerciseDuration} of play or walk`,
        category: "exercise"
      },
      {
        time: feedingTimes[isYoungPuppy ? 3 : 2],
        activity: "Dinner",
        description: "Evening meal",
        category: "feeding"
      },
      {
        time: formatTime(bedHour - 2.5, 30),
        activity: "Post-dinner Potty",
        description: "Take outside after meal",
        category: "potty"
      },
      {
        time: formatTime(bedHour - 2, 0),
        activity: "Calm Evening Time",
        description: "Quiet bonding time, gentle play",
        category: "bonding"
      },
      {
        time: formatTime(bedHour - 0.5, 30),
        activity: "Final Potty Break",
        description: "Last chance before bedtime",
        category: "potty"
      },
      {
        time: formatTime(bedHour, 0),
        activity: "Bedtime",
        description: "Sleep time in designated area",
        category: "rest"
      }
    ],
    tips: [
      `${data.puppyName} is ${data.ageMonths} months and ${data.ageWeeks} weeks old - consistency is key!`,
      `Take ${data.puppyName} outside ${pottyBreakInterval.toLowerCase()} for house training`,
      `${isYoungPuppy ? 'Young' : 'Growing'} puppies need ${exerciseDuration} of exercise daily`,
      hasYard ? "Take advantage of your yard for quick potty breaks and play sessions" : "Regular walks are important for socialization and exercise",
      data.workArrangement === "work-from-home" 
        ? "Working from home? Use breaks to interact with your puppy" 
        : "Consider a midday dog walker if you're away during the day",
    ],
    puppyProfile: {
      name: data.puppyName,
      breed: data.breed,
      photoUrl: data.photoUrl,
      age: `${data.ageMonths} months, ${data.ageWeeks} weeks`,
      weight: `${data.weight} ${data.weightUnit}`,
      livingSituation: data.livingSituation.replace(/-/g, " "),
      workArrangement: data.workArrangement.replace(/-/g, " ")
    }
  };
}

function formatTime(hours: number, minutes: number): string {
  let h = Math.floor(hours);
  let m = minutes;
  
  // Handle overflow
  if (h >= 24) h = h % 24;
  if (h < 0) h = 24 + h;
  
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
