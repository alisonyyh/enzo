import { useEffect, useState, useCallback, useRef } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { OnboardingQuestionnaire } from "./components/OnboardingQuestionnaire";
import { AIRoutineGenerator } from "./components/AIRoutineGenerator";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { Toaster } from "./components/ui/sonner";
import { supabase } from "../lib/supabase";
import {
  signInWithGoogle,
  signOut,
  getProfile,
  getUserPuppies,
  getActiveRoutine,
  createPuppy,
  saveRoutine,
  uploadPuppyPhoto,
  generateRoutineWithAI,
} from "../lib/services";
import type { User } from "@supabase/supabase-js";
import type { Profile, Puppy, PuppyMembership } from "../lib/database.types";
import type { RoutineWithItems } from "../lib/services/routines";

type AppState =
  | "loading"
  | "welcome"
  | "questionnaire"
  | "generating-routine"
  | "dashboard"
  | "settings";

export interface QuestionnaireData {
  puppyName: string;
  breed: string;
  photoUrl: string;
  photoFile: File | null;
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
  const [appState, setAppState] = useState<AppState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPuppy, setCurrentPuppy] = useState<Puppy | null>(null);
  const [currentMembership, setCurrentMembership] = useState<PuppyMembership | null>(null);
  const [routine, setRoutine] = useState<RoutineWithItems | null>(null);
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);

  // Load user data when authenticated
  const loadUserData = useCallback(async (authUser: User) => {
    try {
      const userProfile = await getProfile(authUser.id);
      setProfile(userProfile);

      const memberships = await getUserPuppies(authUser.id);
      console.log("loadUserData: memberships found:", memberships.length);

      if (memberships.length > 0) {
        const membership = memberships[0];
        setCurrentMembership(membership);
        setCurrentPuppy(membership.puppy);

        const activeRoutine = await getActiveRoutine(membership.puppy.id);
        console.log("loadUserData: activeRoutine:", activeRoutine ? "found" : "not found");

        if (activeRoutine) {
          setRoutine(activeRoutine);
          setAppState("dashboard");
        } else {
          setQuestionnaireData(puppyToQuestionnaireData(membership.puppy));
          setAppState("generating-routine");
        }
      } else {
        setAppState((current) => {
          if (current === "generating-routine" || current === "dashboard" || current === "settings") {
            console.log("loadUserData: skipping redirect, already in flow:", current);
            return current;
          }
          return "questionnaire";
        });
      }
    } catch (err) {
      console.error("Error loading user data:", err);
      setAppState((current) => {
        if (current === "generating-routine" || current === "dashboard" || current === "settings") {
          return current;
        }
        return "questionnaire";
      });
    }
  }, []);

  // Listen for auth state changes - runs ONCE on mount
  useEffect(() => {
    let mounted = true;
    let hasLoadedInitially = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        hasLoadedInitially = true;
        loadUserData(session.user);
      } else {
        setAppState("welcome");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log("onAuthStateChange:", event, "hasLoadedInitially:", hasLoadedInitially);

        if (event === "SIGNED_IN" && session?.user) {
          setUser(session.user);
          if (!hasLoadedInitially) {
            hasLoadedInitially = true;
            loadUserData(session.user);
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setCurrentPuppy(null);
          setCurrentMembership(null);
          setRoutine(null);
          setQuestionnaireData(null);
          hasLoadedInitially = false;
          setAppState("welcome");
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle sign in
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Sign in error:", err);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // ---- ONBOARDING FLOW ----
  // We store the questionnaire data and the created puppy in refs so they
  // survive across the AIRoutineGenerator's stale-closure timer callback.
  // The flow is:
  //   1. User submits questionnaire → handleQuestionnaireComplete
  //      - Stores data, switches to "generating-routine" screen
  //      - Kicks off async puppy creation (stored in ref as promise)
  //   2. After 8s animation → handleRoutineGenerated
  //      - Awaits puppy promise if needed
  //      - Saves routine to Supabase
  //      - Transitions to dashboard

  const puppyPromiseRef = useRef<Promise<Puppy | null> | null>(null);
  const currentPuppyRef = useRef<Puppy | null>(null);
  const userRef = useRef<User | null>(null);

  // Keep refs in sync
  useEffect(() => { currentPuppyRef.current = currentPuppy; }, [currentPuppy]);
  useEffect(() => { userRef.current = user; }, [user]);

  const handleQuestionnaireComplete = async (data: QuestionnaireData) => {
    if (!user) return;

    setQuestionnaireData(data);
    setAppState("generating-routine");

    // Start creating the puppy immediately (runs in parallel with animation)
    const promise = (async (): Promise<Puppy | null> => {
      try {
        // Ensure we have a valid Supabase session before making DB calls
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("Creating puppy: session check:", sessionData.session ? "valid" : "NO SESSION");
        if (!sessionData.session) {
          console.error("Creating puppy: No active session! Cannot insert.");
          return null;
        }

        let photoUrl: string | null = null;
        if (data.photoFile) {
          console.log("Creating puppy: uploading photo...");
          photoUrl = await uploadPuppyPhoto(user.id, data.photoFile);
          console.log("Creating puppy: photo uploaded:", photoUrl);
        }

        console.log("Creating puppy: inserting into Supabase...");
        const puppy = await createPuppy(user.id, {
          name: data.puppyName,
          breed: data.breed,
          age_months: parseInt(data.ageMonths) || 0,
          age_weeks: parseInt(data.ageWeeks) || 0,
          weight_value: parseFloat(data.weight) || null,
          weight_unit: data.weightUnit,
          living_situation: data.livingSituation,
          photo_url: photoUrl,
          questionnaire_data: {
            workArrangement: data.workArrangement,
            wakeUpTime: data.wakeUpTime,
            bedTime: data.bedTime,
          },
        });

        console.log("Creating puppy: SUCCESS, id:", puppy.id);
        setCurrentPuppy(puppy);
        currentPuppyRef.current = puppy;
        setIsFirstTime(true);
        return puppy;
      } catch (err) {
        console.error("Creating puppy: FAILED:", err);
        return null;
      }
    })();

    // Store in ref immediately (synchronous — before any re-render)
    puppyPromiseRef.current = promise;
    console.log("handleQuestionnaireComplete: promise stored in ref");
  };

  // Called by AIRoutineGenerator after the 8-second animation.
  // IMPORTANT: This is called from inside a setTimeout in a useEffect,
  // so it runs with a stale closure. We use refs to access current values.
  const handleRoutineGenerated = useCallback(async (generatedRoutine: any) => {
    console.log("=== handleRoutineGenerated START ===");

    // Read from refs (not state) to avoid stale closure
    let puppy = currentPuppyRef.current;
    const promise = puppyPromiseRef.current;
    const currentUser = userRef.current;

    console.log("handleRoutineGenerated: puppy from ref:", puppy?.id ?? "null");
    console.log("handleRoutineGenerated: promise from ref:", promise ? "exists" : "null");
    console.log("handleRoutineGenerated: user from ref:", currentUser?.id ?? "null");

    // Wait for puppy creation if it hasn't finished yet
    if (!puppy && promise) {
      console.log("handleRoutineGenerated: awaiting puppy promise...");
      puppy = await promise;
      console.log("handleRoutineGenerated: promise resolved, puppy:", puppy?.id ?? "null");
    }

    if (!puppy) {
      console.error("handleRoutineGenerated: CRITICAL - no puppy available. Cannot save routine.");
      // Something went very wrong — fall back to dashboard anyway and let DashboardLoader retry
      setAppState("dashboard");
      return;
    }

    // Convert client-side routine format to DB format
    const items = generatedRoutine.dailySchedule.map((item: any, index: number) => ({
      activity_type: item.category || "other",
      title: item.activity,
      description: item.description,
      scheduled_time: item.time + ":00",
      sort_order: index,
    }));

    try {
      console.log("handleRoutineGenerated: saving", items.length, "items for puppy", puppy.id);
      const savedRoutine = await saveRoutine(puppy.id, items);
      console.log("handleRoutineGenerated: routine saved, id:", savedRoutine.id);

      setRoutine(savedRoutine);
      setCurrentPuppy(puppy);
      currentPuppyRef.current = puppy;

      // Ensure membership is in state for Dashboard rendering
      setCurrentMembership((prev) => {
        if (prev) return prev;
        return {
          id: "local",
          puppy_id: puppy!.id,
          user_id: currentUser?.id || "",
          role: "owner",
          status: "active",
          joined_at: new Date().toISOString(),
        } as any;
      });
    } catch (err) {
      console.error("handleRoutineGenerated: Error saving routine:", err);
      // Even if save fails, go to dashboard — DashboardLoader will retry fetching
    }

    console.log("=== handleRoutineGenerated: transitioning to dashboard ===");
    setAppState("dashboard");
  }, []);

  // Build account data for components
  const accountData = {
    name: profile?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User",
    email: user?.email || "",
  };

  // Build puppy profile for Settings
  const puppyProfile = currentPuppy
    ? {
        name: currentPuppy.name,
        breed: currentPuppy.breed,
        photoUrl: currentPuppy.photo_url || "",
        age: `${currentPuppy.age_months} months, ${currentPuppy.age_weeks} weeks`,
        weight: `${currentPuppy.weight_value || ""} ${currentPuppy.weight_unit || ""}`.trim(),
        livingSituation: currentPuppy.living_situation.replace(/-/g, " "),
        workArrangement: (currentPuppy.questionnaire_data as any)?.workArrangement?.replace(/-/g, " ") || "",
      }
    : null;

  // Convert routine to legacy format for Dashboard
  const legacyRoutine = routine
    ? {
        dailySchedule: routine.routine_items
          .filter((item) => item.is_enabled)
          .map((item) => ({
            id: item.id,
            time: item.scheduled_time.slice(0, 5),
            activity: item.title,
            description: item.description || "",
            category: item.activity_type,
          })),
      }
    : null;

  return (
    <>
      {appState === "loading" && (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🐶</div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}

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

      {appState === "dashboard" && legacyRoutine && currentPuppy && (
        <Dashboard
          routine={legacyRoutine}
          accountData={accountData}
          puppyName={currentPuppy.name}
          puppyId={currentPuppy.id}
          userId={user?.id || ""}
          userRole={currentMembership?.role || "owner"}
          isFirstTime={isFirstTime}
          onOpenSettings={() => setAppState("settings")}
        />
      )}

      {appState === "dashboard" && (!legacyRoutine || !currentPuppy) && (
        <DashboardLoader
          user={user}
          onDataLoaded={(puppy, membership, activeRoutine) => {
            setCurrentPuppy(puppy);
            setCurrentMembership(membership);
            setRoutine(activeRoutine);
          }}
        />
      )}

      {appState === "settings" && currentPuppy && puppyProfile && (
        <Settings
          accountData={accountData}
          puppyProfile={puppyProfile}
          puppyId={currentPuppy.id}
          userId={user?.id || ""}
          onBack={() => setAppState("dashboard")}
          onSignOut={handleSignOut}
        />
      )}

      <Toaster />
    </>
  );
}

// Fallback loader when dashboard has no data yet — retries fetching from Supabase
function DashboardLoader({
  user,
  onDataLoaded,
}: {
  user: User | null;
  onDataLoaded: (puppy: Puppy, membership: PuppyMembership, routine: RoutineWithItems) => void;
}) {
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(async () => {
      console.log(`DashboardLoader: retry attempt ${retryCount + 1}...`);
      try {
        const memberships = await getUserPuppies(user.id);
        console.log("DashboardLoader: memberships found:", memberships.length);

        if (memberships.length > 0) {
          const membership = memberships[0];
          const activeRoutine = await getActiveRoutine(membership.puppy.id);
          console.log("DashboardLoader: routine found:", !!activeRoutine);

          if (activeRoutine) {
            onDataLoaded(membership.puppy, membership, activeRoutine);
            return;
          }
        }

        if (retryCount < 10) {
          setRetryCount((c) => c + 1);
        }
      } catch (err) {
        console.error("DashboardLoader: error:", err);
        if (retryCount < 10) {
          setRetryCount((c) => c + 1);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, retryCount, onDataLoaded]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🐶</div>
        <p className="text-muted-foreground">Loading your puppy's routine...</p>
      </div>
    </div>
  );
}

// Helper: convert a Puppy DB record back to QuestionnaireData format
function puppyToQuestionnaireData(puppy: Puppy): QuestionnaireData {
  const q = puppy.questionnaire_data as any;
  return {
    puppyName: puppy.name,
    breed: puppy.breed,
    photoUrl: puppy.photo_url || "",
    photoFile: null,
    ageMonths: String(puppy.age_months),
    ageWeeks: String(puppy.age_weeks),
    weight: String(puppy.weight_value || ""),
    weightUnit: (puppy.weight_unit as "lbs" | "kg") || "lbs",
    livingSituation: puppy.living_situation,
    workArrangement: q?.workArrangement || "",
    wakeUpTime: q?.wakeUpTime || "07:00",
    bedTime: q?.bedTime || "22:00",
  };
}
