// Deterministic parameter engine (D70)
// Pure TypeScript — no network calls, no LLM. Encodes all scheduling
// parameter tables from the system prompt.

// --- Types ---

export type AgeBracket =
  | 'newborn'           // 8-10 weeks
  | 'early_puppy'       // 10-12 weeks
  | 'puppy'             // 12-16 weeks
  | 'junior'            // 16-22 weeks
  | 'pre_adolescent'    // 22-26 weeks
  | 'adolescent_early'  // 26-35 weeks
  | 'adolescent_mid'    // 35-44 weeks
  | 'adolescent_late'   // 44-52 weeks
  | 'young_adult';      // 52+ weeks

export type BreedSize = 'toy' | 'small' | 'medium' | 'large' | 'giant';
export type EnergyLevel = 'high' | 'moderate' | 'low';

export interface DogProfile {
  dateOfBirth: string;       // YYYY-MM-DD
  breedSize: BreedSize;
  energyLevel: EnergyLevel;
  isBrachycephalic: boolean;
  wakeUpTime: string;        // HH:MM
  bedTime: string;           // HH:MM
}

export interface ScheduleParams {
  ageBracket: AgeBracket;
  ageWeeks: number;

  pottyModel: 'event_based' | 'time_based';
  pottyMaxDaytimeGapHours: number | null;
  pottyOvernightBreaks: number;

  mealsPerDay: number;
  mealTimes: string[];

  walkDurationMinutes: number;
  walkSessionsPerDay: number;

  trainingSessionMinutes: number;
  trainingSessionsPerDay: number;

  awakeWindowMinutes: number;
  napDurationMinutes: number;
  napsPerDay: number;

  playSessionMinutes: number;
  playSessionsPerDay: number;

  calmBondingMinutes: number;
  calmBondingSessions: number;

  wakeUpTime: string;
  bedTime: string;
  wakingHours: number;
}

// --- Parameter Tables ---

const WALK_PARAMS: Record<AgeBracket, { duration: number; sessions: number }> = {
  newborn:          { duration: 10, sessions: 1 },
  early_puppy:      { duration: 12, sessions: 1 },
  puppy:            { duration: 15, sessions: 2 },
  junior:           { duration: 20, sessions: 2 },
  pre_adolescent:   { duration: 25, sessions: 2 },
  adolescent_early: { duration: 30, sessions: 2 },
  adolescent_mid:   { duration: 37, sessions: 2 },
  adolescent_late:  { duration: 45, sessions: 2 },
  young_adult:      { duration: 0, sessions: 2 },
};

const YOUNG_ADULT_WALK: Record<EnergyLevel, number> = {
  high: 52,
  moderate: 37,
  low: 20,
};

const TRAINING_PARAMS: Record<AgeBracket, { duration: number; sessions: number }> = {
  newborn:          { duration: 3, sessions: 4 },
  early_puppy:      { duration: 4, sessions: 4 },
  puppy:            { duration: 6, sessions: 3 },
  junior:           { duration: 8, sessions: 3 },
  pre_adolescent:   { duration: 10, sessions: 3 },
  adolescent_early: { duration: 12, sessions: 2 },
  adolescent_mid:   { duration: 12, sessions: 2 },
  adolescent_late:  { duration: 17, sessions: 2 },
  young_adult:      { duration: 17, sessions: 2 },
};

const NAP_PARAMS: Record<AgeBracket, { awakeWindow: number; napDuration: number; naps: number }> = {
  newborn:          { awakeWindow: 45,  napDuration: 105, naps: 5 },
  early_puppy:      { awakeWindow: 60,  napDuration: 105, naps: 4 },
  puppy:            { awakeWindow: 75,  napDuration: 105, naps: 3 },
  junior:           { awakeWindow: 105, napDuration: 90,  naps: 3 },
  pre_adolescent:   { awakeWindow: 105, napDuration: 90,  naps: 3 },
  adolescent_early: { awakeWindow: 150, napDuration: 75,  naps: 2 },
  adolescent_mid:   { awakeWindow: 210, napDuration: 75,  naps: 2 },
  adolescent_late:  { awakeWindow: 240, napDuration: 75,  naps: 1 },
  young_adult:      { awakeWindow: 300, napDuration: 75,  naps: 1 },
};

const PLAY_PARAMS: Record<AgeBracket, { duration: number; sessions: number }> = {
  newborn:          { duration: 7,  sessions: 4 },
  early_puppy:      { duration: 7,  sessions: 4 },
  puppy:            { duration: 12, sessions: 4 },
  junior:           { duration: 17, sessions: 4 },
  pre_adolescent:   { duration: 17, sessions: 3 },
  adolescent_early: { duration: 22, sessions: 3 },
  adolescent_mid:   { duration: 25, sessions: 3 },
  adolescent_late:  { duration: 25, sessions: 3 },
  young_adult:      { duration: 25, sessions: 2 },
};

const CALM_BONDING_PARAMS: Record<AgeBracket, { duration: number; sessions: number }> = {
  newborn:          { duration: 3,  sessions: 4 },
  early_puppy:      { duration: 4,  sessions: 4 },
  puppy:            { duration: 6,  sessions: 3 },
  junior:           { duration: 7,  sessions: 3 },
  pre_adolescent:   { duration: 9,  sessions: 3 },
  adolescent_early: { duration: 11, sessions: 2 },
  adolescent_mid:   { duration: 12, sessions: 2 },
  adolescent_late:  { duration: 12, sessions: 2 },
  young_adult:      { duration: 15, sessions: 2 },
};

const MEAL_COUNT: Record<AgeBracket, number> = {
  newborn: 3,
  early_puppy: 3,
  puppy: 3,
  junior: 3,
  pre_adolescent: 2,
  adolescent_early: 2,
  adolescent_mid: 2,
  adolescent_late: 2,
  young_adult: 2,
};

const POTTY_OVERNIGHT: Record<AgeBracket, number> = {
  newborn: 2,
  early_puppy: 1,
  puppy: 1,
  junior: 0,
  pre_adolescent: 0,
  adolescent_early: 0,
  adolescent_mid: 0,
  adolescent_late: 0,
  young_adult: 0,
};

// Time-based potty: max hours between daytime trips (brackets 6-9 only)
const POTTY_GAP: Record<string, Record<BreedSize, number>> = {
  adolescent_early: { toy: 2.5, small: 2.5, medium: 3, large: 4, giant: 4 },
  adolescent_mid:   { toy: 3,   small: 3,   medium: 4, large: 5, giant: 5 },
  adolescent_late:  { toy: 3,   small: 3,   medium: 5, large: 6, giant: 6 },
  young_adult:      { toy: 4,   small: 4,   medium: 6, large: 6, giant: 6 },
};

const EVENT_BASED_BRACKETS: AgeBracket[] = [
  'newborn', 'early_puppy', 'puppy', 'junior', 'pre_adolescent',
];

// --- Helper Functions ---

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(totalMin: number): string {
  let m = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// --- Core Functions ---

export function getAgeBracket(dateOfBirth: string): { bracket: AgeBracket; ageWeeks: number } {
  const dob = new Date(dateOfBirth + 'T00:00:00');
  const now = new Date();
  const ageMs = now.getTime() - dob.getTime();
  const ageWeeks = Math.floor(ageMs / (7 * 24 * 60 * 60 * 1000));

  if (ageWeeks < 10) return { bracket: 'newborn', ageWeeks };
  if (ageWeeks < 12) return { bracket: 'early_puppy', ageWeeks };
  if (ageWeeks < 16) return { bracket: 'puppy', ageWeeks };
  if (ageWeeks < 22) return { bracket: 'junior', ageWeeks };
  if (ageWeeks < 26) return { bracket: 'pre_adolescent', ageWeeks };
  if (ageWeeks < 35) return { bracket: 'adolescent_early', ageWeeks };
  if (ageWeeks < 44) return { bracket: 'adolescent_mid', ageWeeks };
  if (ageWeeks < 52) return { bracket: 'adolescent_late', ageWeeks };
  return { bracket: 'young_adult', ageWeeks };
}

export function computeMealTimes(
  mealsPerDay: number,
  wakeUpTime: string,
  bedTime: string,
): string[] {
  const wakeMin = parseTime(wakeUpTime);
  const bedMin = parseTime(bedTime);

  const firstMeal = wakeMin + 15;
  let lastMeal = firstMeal + 12 * 60;

  // Adjust if last meal is less than 2h before bed
  const bedMinAdjusted = bedMin <= wakeMin ? bedMin + 24 * 60 : bedMin;
  if (lastMeal > bedMinAdjusted - 120) {
    lastMeal = bedMinAdjusted - 120;
  }

  if (mealsPerDay <= 1) return [formatMinutes(firstMeal)];
  if (mealsPerDay === 2) return [formatMinutes(firstMeal), formatMinutes(lastMeal)];

  const gap = (lastMeal - firstMeal) / (mealsPerDay - 1);
  const times: string[] = [];
  for (let i = 0; i < mealsPerDay; i++) {
    times.push(formatMinutes(firstMeal + gap * i));
  }
  return times;
}

export function computeScheduleParams(profile: DogProfile): ScheduleParams {
  const { bracket, ageWeeks } = getAgeBracket(profile.dateOfBirth);
  const { breedSize, energyLevel, isBrachycephalic } = profile;

  // Waking hours
  const wakeMin = parseTime(profile.wakeUpTime);
  const bedMin = parseTime(profile.bedTime);
  const wakingMinutes = bedMin > wakeMin ? bedMin - wakeMin : bedMin + 24 * 60 - wakeMin;
  const wakingHours = Math.round((wakingMinutes / 60) * 10) / 10;

  // --- Potty ---
  const isEventBased = EVENT_BASED_BRACKETS.includes(bracket);
  const pottyModel = isEventBased ? 'event_based' as const : 'time_based' as const;
  let pottyMaxDaytimeGapHours: number | null = null;
  if (!isEventBased && POTTY_GAP[bracket]) {
    pottyMaxDaytimeGapHours = POTTY_GAP[bracket][breedSize];
  }
  const pottyOvernightBreaks = POTTY_OVERNIGHT[bracket];

  // --- Meals ---
  let mealsPerDay = MEAL_COUNT[bracket];
  // Toy breeds: +1 meal in early brackets (hypoglycemia risk)
  if (breedSize === 'toy') {
    if (bracket === 'newborn' || bracket === 'early_puppy') mealsPerDay = 4;
    if (bracket === 'puppy' || bracket === 'junior') mealsPerDay = 3;
  }
  // Giant breeds: stay at 3 in adolescent+ (bloat risk)
  if (breedSize === 'giant' && mealsPerDay === 2) {
    mealsPerDay = 3;
  }
  const mealTimes = computeMealTimes(mealsPerDay, profile.wakeUpTime, profile.bedTime);

  // --- Walks ---
  let walkDuration = WALK_PARAMS[bracket].duration;
  const walkSessions = WALK_PARAMS[bracket].sessions;
  if (bracket === 'young_adult') {
    walkDuration = YOUNG_ADULT_WALK[energyLevel];
  }
  if (isBrachycephalic && walkDuration > 15) {
    walkDuration = 15;
  }

  // --- Training ---
  const training = TRAINING_PARAMS[bracket];

  // --- Naps ---
  const naps = NAP_PARAMS[bracket];

  // --- Play ---
  let playDuration = PLAY_PARAMS[bracket].duration;
  const playSessions = PLAY_PARAMS[bracket].sessions;
  if (energyLevel === 'high') {
    playDuration = Math.round(playDuration * 1.25);
  } else if (energyLevel === 'low') {
    playDuration = Math.round(playDuration * 0.83);
  }

  // --- Calm Bonding ---
  const bonding = CALM_BONDING_PARAMS[bracket];

  return {
    ageBracket: bracket,
    ageWeeks,
    pottyModel,
    pottyMaxDaytimeGapHours,
    pottyOvernightBreaks,
    mealsPerDay,
    mealTimes,
    walkDurationMinutes: walkDuration,
    walkSessionsPerDay: walkSessions,
    trainingSessionMinutes: training.duration,
    trainingSessionsPerDay: training.sessions,
    awakeWindowMinutes: naps.awakeWindow,
    napDurationMinutes: naps.napDuration,
    napsPerDay: naps.naps,
    playSessionMinutes: playDuration,
    playSessionsPerDay: playSessions,
    calmBondingMinutes: bonding.duration,
    calmBondingSessions: bonding.sessions,
    wakeUpTime: profile.wakeUpTime,
    bedTime: profile.bedTime,
    wakingHours,
  };
}
