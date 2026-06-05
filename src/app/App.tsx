import { useEffect, useState, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { NewUserChoiceScreen } from "./components/NewUserChoiceScreen";
import { InviteCodeEntryScreen } from "./components/InviteCodeEntryScreen";
import { InviteCodeSuccessScreen } from "./components/InviteCodeSuccessScreen";
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
  validateInviteCode,
  createInviteCode,
  computeAgeDisplay,
} from "../lib/services";
import {
  needsRegeneration,
  isRegenerationInProgress,
  clearStaleLock,
  triggerRegeneration,
  cleanupFirebaseOverlays,
} from "../lib/services/routine-evolution";
import type { User } from "@supabase/supabase-js";
import type { Profile, Puppy, PuppyMembership } from "../lib/database.types";
import type { RoutineWithItems } from "../lib/services/routines";
import type { PuppyJoinData } from "./components/InviteCodeEntryScreen";
import type { QuestionnaireData } from "./components/OnboardingQuestionnaire";

type AppState =
  | "loading"
  | "welcome"
  | "choice"
  | "invite-code-entry"
  | "invite-success"
  | "questionnaire"
  | "generating-routine"
  | "dashboard"
  | "settings";

export default function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPuppy, setCurrentPuppy] = useState<Puppy | null>(null);
  const [currentMembership, setCurrentMembership] = useState<PuppyMembership | null>(null);
  const [routine, setRoutine] = useState<RoutineWithItems | null>(null);
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [joinedPuppyData, setJoinedPuppyData] = useState<PuppyJoinData | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Load user data when authenticated
  const loadUserData = useCallback(async (authUser: User) => {
    console.log("[loadUserData] START for user:", authUser.id);
    try {
      const userProfile = await getProfile(authUser.id);
      console.log("[loadUserData] profile:", userProfile ? "found" : "null");
      setProfile(userProfile);
      setAvatarUrl(userProfile?.avatar_url ?? null);

      const memberships = await getUserPuppies(authUser.id);
      console.log("[loadUserData] memberships found:", memberships.length, memberships.map(m => ({ role: m.role, puppyId: m.puppy_id })));

      if (memberships.length > 0) {
        const membership = memberships[0];
        setCurrentMembership(membership);
        setCurrentPuppy(membership.puppy);

        const activeRoutine = await getActiveRoutine(membership.puppy.id);
        console.log("[loadUserData] activeRoutine:", activeRoutine ? "found" : "not found");

        if (activeRoutine) {
          setRoutine(activeRoutine);
          console.log("[loadUserData] → dashboard (has routine)");
          setAppState("dashboard");
        } else {
          setQuestionnaireData(puppyToQuestionnaireData(membership.puppy));
          console.log("[loadUserData] → generating-routine (no routine)");
          setAppState("generating-routine");
        }
      } else {
        console.log("[loadUserData] No memberships → choice");
        setAppState((current) => {
          if (current === "generating-routine" || current === "dashboard" || current === "settings") {
            console.log("[loadUserData] skipping redirect, already in flow:", current);
            return current;
          }
          console.log("[loadUserData] transitioning from", current, "→ choice");
          return "choice";
        });
      }
    } catch (err) {
      console.error("[loadUserData] ERROR:", err);
      setAppState((current) => {
        if (current === "generating-routine" || current === "dashboard" || current === "settings") {
          return current;
        }
        console.log("[loadUserData] error recovery → choice");
        return "choice";
      });
    }
  }, []);

  // Listen for OAuth deep link callbacks on iOS
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      const { App: CapApp } = await import("@capacitor/app");
      const { handleOAuthDeepLink } = await import("../lib/services/auth");

      const listener = await CapApp.addListener("appUrlOpen", async ({ url }) => {
        console.log("[DeepLink] Received:", url);
        if (url.includes("login-callback")) {
          try {
            await handleOAuthDeepLink(url);
          } catch (err) {
            console.error("[DeepLink] OAuth exchange error:", err);
          }
        }
      });

      cleanup = () => listener.remove();
    })();

    return () => cleanup?.();
  }, []);

  // Listen for auth state changes - runs ONCE on mount.
  //
  // Strategy: use BOTH onAuthStateChange AND getSession() as a fallback.
  // - onAuthStateChange fires INITIAL_SESSION once _initialize() completes,
  //   which handles OAuth redirects, stored sessions, and first visits.
  // - getSession() runs after a short delay as a safety net in case
  //   INITIAL_SESSION was missed (e.g. fired before listener was registered).
  useEffect(() => {
    let mounted = true;
    let hasLoadedInitially = false;

    const handleSession = (source: string, authUser: User) => {
      if (!mounted || hasLoadedInitially) return;
      console.log(`[Auth] ${source}: loading user data for`, authUser.id);
      hasLoadedInitially = true;
      setUser(authUser);
      loadUserData(authUser);
    };

    const handleNoSession = (source: string) => {
      if (!mounted || hasLoadedInitially) return;
      console.log(`[Auth] ${source}: no session — showing welcome`);
      hasLoadedInitially = true;
      setAppState("welcome");
    };

    // Primary: listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log("[Auth] onAuthStateChange:", event, "session:", !!session, "user:", !!session?.user, "hasLoaded:", hasLoadedInitially);

        if (event === "SIGNED_IN" && session?.user) {
          // SIGNED_IN must always load user data — even if INITIAL_SESSION
          // already ran (e.g. OAuth deep link on iOS where INITIAL_SESSION
          // fires with no session, then SIGNED_IN fires after the token exchange).
          hasLoadedInitially = true;
          setUser(session.user);
          loadUserData(session.user);
        } else if (event === "INITIAL_SESSION" && session?.user) {
          // Cached session — verify user still exists server-side
          const { data: verified, error: verifyErr } = await supabase.auth.getUser();
          if (verifyErr || !verified.user) {
            console.warn("[Auth] Cached session is stale (user deleted server-side). Signing out.");
            await supabase.auth.signOut();
            handleNoSession(`onAuthStateChange(${event}) — stale`);
            return;
          }
          handleSession(`onAuthStateChange(${event})`, verified.user);
        } else if (event === "INITIAL_SESSION") {
          // INITIAL_SESSION with no session (or no user) — unauthenticated
          handleNoSession(`onAuthStateChange(${event})`);
        } else if (event === "SIGNED_OUT") {
          console.log("[Auth] SIGNED_OUT — resetting state");
          setUser(null);
          setProfile(null);
          setAvatarUrl(null);
          setCurrentPuppy(null);
          setCurrentMembership(null);
          setRoutine(null);
          setQuestionnaireData(null);
          setJoinedPuppyData(null);
          hasLoadedInitially = false;
          setAppState("welcome");
        }
      }
    );

    // Fallback: if onAuthStateChange hasn't resolved after 2s, try getSession()
    const fallbackTimer = setTimeout(async () => {
      if (!mounted || hasLoadedInitially) return;
      console.log("[Auth] Fallback: onAuthStateChange did not fire in 2s, trying getSession()");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          handleSession("getSession() fallback", session.user);
        } else {
          handleNoSession("getSession() fallback");
        }
      } catch (err) {
        console.error("[Auth] Fallback getSession() failed:", err);
        handleNoSession("getSession() fallback (error)");
      }
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F14: Check if routine needs weekly regeneration on dashboard load
  useEffect(() => {
    if (appState !== "dashboard" || !routine || !currentPuppy) return;

    let cancelled = false;

    async function checkRegeneration() {
      if (!routine || !currentPuppy) return;

      if (!needsRegeneration(routine)) return;

      // Handle stale lock
      if (isRegenerationInProgress(routine)) return;
      if (routine.regeneration_status === 'in_progress') {
        await clearStaleLock(routine.id);
      }

      setIsRegenerating(true);

      const questionnaireInfo = {
        puppyName: currentPuppy.name,
        breed: currentPuppy.breed,
        dateOfBirth: currentPuppy.date_of_birth || '',
        weight: currentPuppy.weight_value,
        weightUnit: (currentPuppy.weight_unit as 'lbs' | 'kg') || 'lbs',
        wakeUpTime: (currentPuppy.questionnaire_data as any)?.wakeUpTime || '07:00',
        bedTime: (currentPuppy.questionnaire_data as any)?.bedTime || '22:00',
      };

      const newRoutine = await triggerRegeneration(currentPuppy.id, questionnaireInfo);

      if (cancelled) return;
      setIsRegenerating(false);

      if (newRoutine) {
        const oldItems = routine.routine_items;
        setRoutine(newRoutine);
        cleanupFirebaseOverlays(currentPuppy.id, oldItems);
      }
    }

    checkRegeneration();

    return () => { cancelled = true; };
  // Only run once when dashboard first renders with routine data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, routine?.id, currentPuppy?.id]);

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

  // Handle invite code submission via Edge Function
  const handleInviteCodeSubmit = async (code: string): Promise<{ success: boolean; error?: string; puppyData?: PuppyJoinData }> => {
    if (!user) return { success: false, error: "Not authenticated." };

    try {
      const result = await validateInviteCode(code);

      if (result.success && result.puppy) {
        const puppyData: PuppyJoinData = {
          puppyName: result.puppy.name,
          breed: result.puppy.breed,
          ageWeeks: result.puppy.ageWeeks,
          photoUrl: result.puppy.photoUrl,
        };
        return { success: true, puppyData };
      }

      return { success: false, error: result.error };
    } catch (err) {
      console.error("handleInviteCodeSubmit: error:", err);
      return { success: false, error: "Something went wrong. Please try again." };
    }
  };

  // Handle successful invite code acceptance — refresh Firebase token and load joined puppy
  const handleInviteSuccess = async () => {
    if (!user) return;

    // Re-authenticate with Firebase to get updated Custom Claims (includes new puppyId)
    try {
      const { signInToFirebase } = await import("../lib/firebase");
      await signInToFirebase();
    } catch (err) {
      console.error("Failed to refresh Firebase token:", err);
      // Non-blocking — will be refreshed on next app load
    }

    // Reload user data which will now find the new membership and route to dashboard
    await loadUserData(user);
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
        // Validate user exists server-side (getUser() calls the auth API,
        // unlike getSession() which only checks the local JWT)
        const { data: userData, error: userError } = await supabase.auth.getUser();
        console.log("Creating puppy: session check:", userData.user ? "valid" : "NO USER", userError ? `error: ${userError.message}` : "");
        if (!userData.user || userError) {
          console.error("Creating puppy: User not found server-side — stale session. Signing out.");
          await supabase.auth.signOut();
          setUser(null);
          setAppState("welcome");
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
          date_of_birth: data.dateOfBirth,
          breed_size: data.breedSize,
          energy_level: data.energyLevel,
          is_brachycephalic: data.isBrachycephalic,
          weight_value: parseFloat(data.weight) || null,
          weight_unit: data.weightUnit,
          photo_url: photoUrl,
          questionnaire_data: {
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
  const handleRoutineGenerated = useCallback(async (generatedRoutine: any, source: 'ai' | 'fallback') => {
    console.log("=== handleRoutineGenerated START ===", { source });

    let puppy = currentPuppyRef.current;
    const promise = puppyPromiseRef.current;
    const currentUser = userRef.current;

    console.log("handleRoutineGenerated: puppy from ref:", puppy?.id ?? "null");
    console.log("handleRoutineGenerated: promise from ref:", promise ? "exists" : "null");

    if (!puppy && promise) {
      console.log("handleRoutineGenerated: awaiting puppy promise...");
      puppy = await promise;
      console.log("handleRoutineGenerated: promise resolved, puppy:", puppy?.id ?? "null");
    }

    if (!puppy) {
      console.error("handleRoutineGenerated: CRITICAL - no puppy available.");
      setAppState("dashboard");
      return;
    }

    try {
      if (source === 'ai') {
        // AI routine is already saved to DB by the Edge Function
        console.log("handleRoutineGenerated: AI routine already saved, id:", generatedRoutine.id);
        setRoutine(generatedRoutine);
      } else {
        // Fallback: save client-side routine to DB
        const items = generatedRoutine.dailySchedule.map((item: any, index: number) => ({
          activity_type: item.category || "other",
          title: item.activity,
          description: item.description,
          scheduled_time: item.time + ":00",
          sort_order: index,
        }));

        console.log("handleRoutineGenerated: saving fallback routine,", items.length, "items for puppy", puppy.id);
        const savedRoutine = await saveRoutine(puppy.id, items);
        console.log("handleRoutineGenerated: routine saved, id:", savedRoutine.id);
        setRoutine(savedRoutine);
      }

      setCurrentPuppy(puppy);
      currentPuppyRef.current = puppy;

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
        age: computeAgeDisplay(currentPuppy.date_of_birth, currentPuppy.age_months, currentPuppy.age_weeks),
        weight: `${currentPuppy.weight_value || ""} ${currentPuppy.weight_unit || ""}`.trim(),
        weightValue: currentPuppy.weight_value,
        weightUnit: currentPuppy.weight_unit || "lbs",
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
            durationMinutes: item.duration_minutes ?? null,
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

      {appState === "choice" && (
        <NewUserChoiceScreen
          onHasInviteCode={() => setAppState("invite-code-entry")}
          onNoInviteCode={() => setAppState("questionnaire")}
        />
      )}

      {appState === "invite-code-entry" && (
        <InviteCodeEntryScreen
          onBack={() => setAppState("choice")}
          onSubmit={handleInviteCodeSubmit}
          onSuccess={(puppyData) => {
            setJoinedPuppyData(puppyData);
            setAppState("invite-success");
          }}
        />
      )}

      {appState === "invite-success" && joinedPuppyData && (
        <InviteCodeSuccessScreen
          puppyData={joinedPuppyData}
          onViewRoutine={handleInviteSuccess}
        />
      )}

      {appState === "questionnaire" && (
        <OnboardingQuestionnaire
          onComplete={handleQuestionnaireComplete}
          onBack={() => setAppState("choice")}
        />
      )}

      {appState === "generating-routine" && questionnaireData && (
        <AIRoutineGenerator
          questionnaireData={questionnaireData}
          puppyId={currentPuppy?.id ?? null}
          puppyIdPromise={puppyPromiseRef.current}
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
          puppyCreatedAt={currentPuppy.created_at}
          isRegenerating={isRegenerating}
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
          onSignOut={handleSignOut}
        />
      )}

      {appState === "settings" && currentPuppy && puppyProfile && (
        <Settings
          accountData={accountData}
          avatarUrl={avatarUrl}
          puppyProfile={puppyProfile}
          puppyId={currentPuppy.id}
          puppyCreatedAt={currentPuppy.created_at}
          userId={user?.id || ""}
          userRole={currentMembership?.role || "owner"}
          onBack={() => setAppState("dashboard")}
          onSignOut={handleSignOut}
          onAvatarUpdate={(newUrl) => setAvatarUrl(newUrl)}
          onWeightUpdate={(weightValue, weightUnit) => {
            setCurrentPuppy((prev) =>
              prev ? { ...prev, weight_value: weightValue, weight_unit: weightUnit } : prev
            );
          }}
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
  onSignOut,
}: {
  user: User | null;
  onDataLoaded: (puppy: Puppy, membership: PuppyMembership, routine: RoutineWithItems) => void;
  onSignOut: () => void;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(async () => {
      console.log(`[DashboardLoader] retry ${retryCount + 1}/${maxRetries}`);
      try {
        const memberships = await getUserPuppies(user.id);
        console.log("[DashboardLoader] memberships:", memberships.length);

        if (memberships.length > 0) {
          const membership = memberships[0];
          const activeRoutine = await getActiveRoutine(membership.puppy.id);
          console.log("[DashboardLoader] routine:", !!activeRoutine);

          if (activeRoutine) {
            onDataLoaded(membership.puppy, membership, activeRoutine);
            return;
          }
        }

        if (retryCount < maxRetries) {
          setRetryCount((c) => c + 1);
        }
      } catch (err) {
        console.error("[DashboardLoader] error:", err);
        if (retryCount < maxRetries) {
          setRetryCount((c) => c + 1);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, retryCount, onDataLoaded]);

  const exhausted = retryCount >= maxRetries;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-6xl mb-4 animate-bounce">🐶</div>
        {!exhausted ? (
          <p className="text-muted-foreground">Loading your puppy's routine...</p>
        ) : (
          <>
            <p className="text-foreground font-medium mb-2">
              Unable to load your routine
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Your data may be incomplete. You can sign out and try again.
            </p>
            <button
              onClick={onSignOut}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Sign Out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function puppyToQuestionnaireData(puppy: Puppy): QuestionnaireData {
  const q = puppy.questionnaire_data as any;
  return {
    puppyName: puppy.name,
    breed: puppy.breed,
    photoUrl: puppy.photo_url || "",
    photoFile: null,
    dateOfBirth: puppy.date_of_birth || "",
    weight: String(puppy.weight_value || ""),
    weightUnit: (puppy.weight_unit as "lbs" | "kg") || "lbs",
    wakeUpTime: q?.wakeUpTime || "07:00",
    bedTime: q?.bedTime || "22:00",
    breedSize: puppy.breed_size || "medium",
    energyLevel: puppy.energy_level || "moderate",
    isBrachycephalic: puppy.is_brachycephalic ?? false,
  };
}
