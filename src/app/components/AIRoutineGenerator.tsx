import { useEffect, useState, useRef } from "react";
import type { QuestionnaireData } from "./OnboardingQuestionnaire";
import { generateRoutineWithAI } from "../../lib/services/routines";

interface AIRoutineGeneratorProps {
  questionnaireData: QuestionnaireData;
  puppyId: string | null;
  puppyIdPromise?: Promise<any> | null;
  onComplete: (routine: any, source: 'ai' | 'fallback') => void;
}

const LOADING_MESSAGES = [
  `Analyzing ${"{puppyName}"}'s breed...`,
  "Computing schedule parameters...",
  "Building a personalized routine...",
  "Almost ready!"
];

export function AIRoutineGenerator({ questionnaireData, puppyId, puppyIdPromise, onComplete }: AIRoutineGeneratorProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const onCompleteRef = useRef(onComplete);
  const questionnaireDataRef = useRef(questionnaireData);
  const puppyIdRef = useRef(puppyId);
  const puppyIdPromiseRef = useRef(puppyIdPromise);
  const hasCompletedRef = useRef(false);

  onCompleteRef.current = onComplete;
  questionnaireDataRef.current = questionnaireData;
  puppyIdRef.current = puppyId;
  puppyIdPromiseRef.current = puppyIdPromise;

  useEffect(() => {
    hasCompletedRef.current = false;

    const totalDuration = 8000;

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1.25;
      });
    }, totalDuration / 80);

    const messageInterval = totalDuration / LOADING_MESSAGES.length;
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => {
        if (prev >= LOADING_MESSAGES.length - 1) {
          clearInterval(messageTimer);
          return prev;
        }
        return prev + 1;
      });
    }, messageInterval);

    // Start AI generation in parallel with animation
    let aiResult: any = null;
    let aiError: any = null;

    const aiPromise = (async () => {
      const data = questionnaireDataRef.current;

      // Wait for puppy creation to complete if puppyId isn't available yet
      let id = puppyIdRef.current;
      if (!id && puppyIdPromiseRef.current) {
        console.log('AIRoutineGenerator: waiting for puppy creation...');
        const puppy = await puppyIdPromiseRef.current;
        id = puppy?.id ?? null;
        console.log('AIRoutineGenerator: puppy created, id =', id);
      }

      if (id) {
        try {
          console.log('AIRoutineGenerator: calling Edge Function...');
          const routine = await generateRoutineWithAI(id, {
            puppyName: data.puppyName,
            breed: data.breed,
            dateOfBirth: data.dateOfBirth,
            weight: parseFloat(data.weight) || null,
            weightUnit: data.weightUnit,
            wakeUpTime: data.wakeUpTime,
            bedTime: data.bedTime,
          });
          console.log('AIRoutineGenerator: Edge Function SUCCESS');
          aiResult = routine;
        } catch (err: any) {
          console.error('AI routine generation failed:', err);
          aiError = err;
        }
      } else {
        console.error('AIRoutineGenerator: puppy creation failed, no ID available');
      }
    })();

    const completionTimer = setTimeout(async () => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;

      // Wait for AI call to finish
      await aiPromise;

      if (aiResult) {
        console.log("AIRoutineGenerator: using AI-generated routine");
        onCompleteRef.current(aiResult, 'ai');
      } else {
        console.log("AIRoutineGenerator: falling back to client-side generation");
        const fallback = generateFallbackRoutine(questionnaireDataRef.current);
        onCompleteRef.current(fallback, 'fallback');
      }
    }, totalDuration);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageTimer);
      clearTimeout(completionTimer);
    };
  }, []);

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
        <div className="flex justify-center mb-12">
          <div className="text-[140px] leading-none animate-bounce">
            🐶
          </div>
        </div>

        <p className="text-lg font-medium text-foreground text-center mb-6 px-8 min-h-[60px] flex items-center">
          {currentMessage}
        </p>

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

function generateFallbackRoutine(data: QuestionnaireData) {
  const dob = new Date(data.dateOfBirth + "T00:00:00");
  const now = new Date();
  const totalWeeks = Math.floor((now.getTime() - dob.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const isYoungPuppy = totalWeeks < 12;

  const [wakeHour] = data.wakeUpTime.split(":").map(Number);
  const [bedHour] = data.bedTime.split(":").map(Number);

  const feedingTimes = isYoungPuppy
    ? [fmt(wakeHour, 0), fmt(wakeHour + 4, 0), fmt(wakeHour + 8, 0), fmt(bedHour - 3, 0)]
    : [fmt(wakeHour, 0), fmt(wakeHour + 5, 0), fmt(bedHour - 3, 0)];

  const exerciseDuration = isYoungPuppy ? "15-20 minutes" : "30-40 minutes";

  return {
    dailySchedule: [
      { time: fmt(wakeHour, 0), activity: "Wake up & Potty Break", description: null, category: "potty" },
      { time: feedingTimes[0], activity: "Breakfast", description: null, category: "feeding" },
      { time: fmt(wakeHour + 0.5, 30), activity: "Post-meal Potty Break", description: null, category: "potty" },
      { time: fmt(wakeHour + 1, 0), activity: "Morning Training Session", description: null, category: "training" },
      { time: fmt(wakeHour + 2, 0), activity: "Play Session", description: null, category: "play" },
      { time: fmt(wakeHour + 3, 0), activity: "Nap Time", description: null, category: "rest" },
      ...(isYoungPuppy ? [{ time: feedingTimes[1], activity: "Lunch", description: null, category: "feeding" }] : []),
      { time: fmt(wakeHour + 5.5, 30), activity: "Midday Potty & Walk", description: null, category: "exercise" },
      { time: fmt(wakeHour + 6, 0), activity: "Afternoon Nap", description: null, category: "rest" },
      ...(isYoungPuppy ? [{ time: fmt(wakeHour + 8, 0), activity: "Afternoon Snack", description: null, category: "feeding" }] : []),
      { time: fmt(bedHour - 6, 0), activity: "Training & Socialization", description: null, category: "training" },
      { time: fmt(bedHour - 4.5, 30), activity: "Evening Exercise", description: null, category: "exercise" },
      { time: feedingTimes[isYoungPuppy ? 3 : 2], activity: "Dinner", description: null, category: "feeding" },
      { time: fmt(bedHour - 2.5, 30), activity: "Post-dinner Potty", description: null, category: "potty" },
      { time: fmt(bedHour - 2, 0), activity: "Calm Evening Time", description: null, category: "bonding" },
      { time: fmt(bedHour - 0.5, 30), activity: "Final Potty Break", description: null, category: "potty" },
      { time: fmt(bedHour, 0), activity: "Bedtime", description: null, category: "rest" },
    ],
  };
}

function fmt(hours: number, minutes: number): string {
  let h = Math.floor(hours);
  if (h >= 24) h = h % 24;
  if (h < 0) h = 24 + h;
  return `${h.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}
