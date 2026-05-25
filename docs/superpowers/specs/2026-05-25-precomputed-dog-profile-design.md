# Pre-Computed Dog Profile Layer

## Summary

Move breed-derived scheduling parameters out of the LLM prompt and into a pre-computed profile layer. The LLM currently does deterministic table lookups (breed → size, energy, brachycephalic) and arithmetic (age → bracket → parameter values). This work belongs in code where it's fast, testable, and consistent.

## Goals

1. Consistent schedule parameters for the same dog across regenerations
2. Reduce LLM input tokens by ~40-50% (remove lookup tables from prompt)
3. Enable age-aware scheduling that auto-updates as the puppy grows (DOB-based)
4. Surface breed classification to the user for transparency/future editability

## Non-Goals

- Removing the LLM entirely (it still handles schedule assembly and adaptive adjustments)
- Changing the activity types or visual design of the schedule
- Adding new breeds beyond the current 30

---

## Data Model

### New Table: `breed_profiles`

Single source of truth for breed characteristics. Drives the onboarding dropdown.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default gen_random_uuid() | |
| breed_name | TEXT | UNIQUE, NOT NULL | Display name shown in dropdown |
| breed_size | TEXT | NOT NULL, CHECK in (toy, small, medium, large, giant) | Adult size category |
| energy_level | TEXT | NOT NULL, CHECK in (high, moderate, low) | Exercise needs at maturity |
| is_brachycephalic | BOOLEAN | NOT NULL, DEFAULT false | Flat-faced breed flag |

Seeded with 30 breeds matching the current dropdown, plus "Mixed/Unknown" (defaults: medium, moderate, false).

### Puppies Table: New Columns

| Column | Type | Description |
|--------|------|-------------|
| date_of_birth | DATE | Used to compute current age. Nullable for existing puppies. |
| breed_size | TEXT | Copied from breed_profiles at creation |
| energy_level | TEXT | Copied from breed_profiles at creation |
| is_brachycephalic | BOOLEAN | Copied from breed_profiles at creation |

Existing `age_months` and `age_weeks` columns are retained for backward compatibility. For puppies without a DOB, the system falls back to `age_months * 4 + age_weeks` for age calculation.

---

## Breed Data

Mappings derived from the system prompt reference tables:

| Breed | Size | Energy | Brachycephalic |
|-------|------|--------|----------------|
| Mixed/Unknown | medium | moderate | false |
| Australian Shepherd | medium | high | false |
| Beagle | small | moderate | false |
| Bernese Mountain Dog | giant | moderate | false |
| Border Collie | medium | high | false |
| Boston Terrier | small | low | true |
| Boxer | large | moderate | true |
| Brittany | medium | high | false |
| Bulldog | medium | low | true |
| Cavalier King Charles Spaniel | small | low | true |
| Chihuahua | toy | low | false |
| Cocker Spaniel | small | moderate | false |
| Dachshund | small | moderate | false |
| Doberman Pinscher | large | high | false |
| French Bulldog | small | low | true |
| German Shepherd | large | high | false |
| German Shorthaired Pointer | large | high | false |
| Golden Retriever | large | high | false |
| Great Dane | giant | low | false |
| Havanese | toy | moderate | false |
| Labrador Retriever | large | high | false |
| Miniature Schnauzer | small | moderate | false |
| Pembroke Welsh Corgi | small | moderate | false |
| Pomeranian | toy | moderate | false |
| Poodle | medium | moderate | false |
| Rottweiler | large | moderate | false |
| Shetland Sheepdog | small | high | false |
| Shih Tzu | small | low | true |
| Siberian Husky | large | high | false |
| Yorkshire Terrier | toy | moderate | false |

---

## Age Bracket Computation

Computed at routine generation time from `today - date_of_birth`:

| Bracket Label | Age Range |
|---------------|-----------|
| newborn | 8-10 weeks |
| early_puppy | 10-12 weeks |
| puppy | 12-16 weeks |
| junior | 4-5 months (17-21 weeks) |
| pre_adolescent | 5-6 months (22-26 weeks) |
| adolescent_early | 6-8 months (27-34 weeks) |
| adolescent_mid | 8-10 months (35-43 weeks) |
| adolescent_late | 10-12 months (44-52 weeks) |
| young_adult | 12+ months (53+ weeks) |

---

## Schedule Parameter Computation

A pure function `computeScheduleParams(ageBracket, breedSize, energyLevel, isBrachycephalic)` that returns all scheduling parameters. This function encodes the parameter tables from the system prompt as code.

### Output Shape

```typescript
interface ScheduleParams {
  ageBracket: AgeBracket;
  ageWeeks: number;

  // Potty
  pottyModel: 'event_based' | 'time_based';
  pottyMaxIntervalHours: [number, number] | null; // [min, max] for time-based, null for event-based
  overnightPottyBreaks: [number, number]; // [min, max]

  // Meals
  mealsPerDay: number;

  // Walks
  walkDurationMin: number;
  walkSessions: number;

  // Training
  trainingDurationMin: [number, number];
  trainingSessionsPerDay: [number, number];

  // Naps/Sleep
  awakeWindowMin: [number, number];
  napDurationMin: [number, number];
  napsPerDay: [number, number];

  // Play
  playDurationMin: [number, number];
  playSessionsPerDay: [number, number];

  // Calm bonding
  calmBondingDurationMin: [number, number];
  calmBondingSessionsPerDay: [number, number];
}
```

### Meal Timing Algorithm (also pre-computed)

Meal times are deterministic given wake time, bed time, and meals per day:

1. First meal = wake time + 15 min
2. Last meal = first meal + 12 hours. If last meal is less than 2 hours before bedtime, set last meal = bedtime - 2 hours.
3. Intermediate meals (if 3+) spaced evenly between first and last.

This is computed server-side and passed to the LLM as exact times.

### Modifiers Applied

- Brachycephalic: walk duration capped at 15 min/session regardless of age/energy
- High energy: play duration +25%
- Low energy: play duration -15-20%
- Toy/small breeds: potty intervals reduced by ~25% (time-based model)
- Young adult walks: determined by energy level instead of age formula

---

## Onboarding Flow Changes

### Step 1 (Puppy Info)
- Name: unchanged
- Breed: dropdown populated by fetching `breed_profiles` table (instead of hardcoded array)
- Photo: unchanged

### Step 2 (Age & Weight)
- **Date of birth**: replaces separate month/week inputs. Date picker, required.
- Weight: unchanged

### Step 3 (Schedule)
- Wake time / bed time: unchanged

### On Submit
- Frontend looks up the selected breed's size/energy/brachycephalic from the fetched breed_profiles data
- Creates puppy record with: name, breed, date_of_birth, breed_size, energy_level, is_brachycephalic, weight, questionnaire_data

---

## Edge Function Changes

The `generate-routine` Edge Function becomes:

1. Read puppy record (now includes DOB + breed fields)
2. Compute age: `Math.floor((today - date_of_birth) / 7)` → weeks
3. Map weeks → age bracket
4. Call `computeScheduleParams(ageBracket, breedSize, energyLevel, isBrachycephalic)`
5. Compute meal times from wake/bed time using the meal timing algorithm
6. Build slim LLM prompt with pre-computed values
7. LLM assembles the schedule timeline

### Slim Prompt Structure

The LLM receives:
- Dog summary (name, age bracket, size, energy, brachycephalic)
- Owner schedule (wake/bed time)
- All computed parameters as a concise list
- Activity distribution rules (from system prompt Step 3)
- Output format specification
- 7-day history data if available (for adaptive adjustments)

The prompt no longer contains breed lookup tables, age bracket definitions, or parameter tables.

---

## Migration Strategy

### For existing puppies (no DOB)
- `date_of_birth` is nullable
- Fallback: synthesize DOB as `created_at - (age_months * 4 + age_weeks) weeks`. This gives an approximate DOB that produces the correct age bracket relative to when the puppy was registered.
- Breed fields (size/energy/brachycephalic) populated via a data migration that matches `puppies.breed` against `breed_profiles.breed_name`

### For the onboarding questionnaire data interface
- `QuestionnaireData` adds `dateOfBirth: string` (ISO date)
- Removes `ageMonths` and `ageWeeks`
- The Edge Function accepts both old format (for in-flight requests) and new format

---

## File Locations

| What | Where |
|------|-------|
| Migration: breed_profiles table + seed data | `supabase/migrations/YYYYMMDD_breed_profiles.sql` |
| Migration: puppies table new columns | `supabase/migrations/YYYYMMDD_puppy_profile_fields.sql` |
| Migration: backfill existing puppies | `supabase/migrations/YYYYMMDD_backfill_puppy_profiles.sql` |
| Schedule params computation | `supabase/functions/generate-routine/schedule-params.ts` |
| Age bracket computation | `supabase/functions/generate-routine/age-bracket.ts` |
| Updated Edge Function | `supabase/functions/generate-routine/index.ts` |
| Updated onboarding component | `src/app/components/OnboardingQuestionnaire.tsx` |
| Updated database types | `src/lib/database.types.ts` |
| Updated puppies service | `src/lib/services/puppies.ts` |
| Breed profiles service (new) | `src/lib/services/breed-profiles.ts` |
