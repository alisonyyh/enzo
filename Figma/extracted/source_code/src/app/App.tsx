import { useState } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { OnboardingQuestionnaire } from "./components/OnboardingQuestionnaire";
import { AIRoutineGenerator } from "./components/AIRoutineGenerator";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { Toaster } from "./components/ui/sonner";

type AppState = 
  | "welcome"
  | "questionnaire" 
  | "generating-routine" 
  | "dashboard"
  | "settings";

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

export default function App() {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(null);
  const [routine, setRoutine] = useState<any>(null);

  // Mock account data from Google Sign-In
  const mockAccountData = {
    name: "John Smith",
    email: "john.smith@gmail.com"
  };

  const handleSignIn = () => {
    // Simulate Google Sign-In
    // In real implementation, this would trigger Google OAuth authentication
    // Check if user is new or returning
    const hasExistingAccount = localStorage.getItem("puppyAppUser");
    
    if (hasExistingAccount) {
      // Returning user - load their data and go to dashboard
      const savedData = JSON.parse(hasExistingAccount);
      setQuestionnaireData(savedData.puppy);
      const savedRoutine = localStorage.getItem("puppyRoutine");
      if (savedRoutine) {
        setRoutine(JSON.parse(savedRoutine));
        setAppState("dashboard");
      } else {
        // Data exists but no routine, regenerate
        setAppState("generating-routine");
      }
    } else {
      // New user - show onboarding
      setAppState("questionnaire");
    }
  };

  const handleQuestionnaireComplete = (data: QuestionnaireData) => {
    setQuestionnaireData(data);
    // Save to local storage
    localStorage.setItem("puppyAppUser", JSON.stringify({
      account: mockAccountData,
      puppy: data
    }));
    setAppState("generating-routine");
  };

  const handleRoutineGenerated = (generatedRoutine: any) => {
    setRoutine(generatedRoutine);
    // Save routine to local storage
    localStorage.setItem("puppyRoutine", JSON.stringify(generatedRoutine));
    setAppState("dashboard");
  };

  return (
    <>
      {appState === "welcome" && (
        <WelcomeScreen onSignIn={handleSignIn} />
      )}

      {appState === "questionnaire" && (
        <OnboardingQuestionnaire onComplete={handleQuestionnaireComplete} />
      )}

      {appState === "generating-routine" && questionnaireData && (
        <AIRoutineGenerator
          questionnaireData={questionnaireData}
          onComplete={handleRoutineGenerated}
        />
      )}

      {appState === "dashboard" && routine && questionnaireData && (
        <Dashboard
          routine={routine}
          accountData={mockAccountData}
          puppyName={questionnaireData.puppyName}
          isFirstTime={!localStorage.getItem("hasSeenReveal")}
          onOpenSettings={() => setAppState("settings")}
        />
      )}

      {appState === "settings" && routine && questionnaireData && (
        <Settings
          accountData={mockAccountData}
          puppyProfile={{
            name: questionnaireData.puppyName,
            breed: questionnaireData.breed,
            photoUrl: questionnaireData.photoUrl,
            age: `${questionnaireData.ageMonths} months, ${questionnaireData.ageWeeks} weeks`,
            weight: `${questionnaireData.weight} ${questionnaireData.weightUnit}`,
            livingSituation: questionnaireData.livingSituation.replace(/-/g, " "),
            workArrangement: questionnaireData.workArrangement.replace(/-/g, " ")
          }}
          onBack={() => setAppState("dashboard")}
        />
      )}

      <Toaster />
    </>
  );
}