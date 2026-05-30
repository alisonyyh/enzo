import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { computeScheduleParams, type ScheduleParams, type BreedSize, type EnergyLevel } from './schedule-params.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuestionnaireData {
  puppyName: string;
  breed: string;
  dateOfBirth: string;
  weight: number | null;
  weightUnit: 'lbs' | 'kg';
  wakeUpTime: string;
  bedTime: string;
}

interface RoutineActivity {
  time: string;
  activity: string;
  category: string;
  description: string;
}

function buildSystemPrompt(): string {
  return `You are PupPlanner, a schedule assembler. All scheduling parameters (meal counts, walk durations, potty models, nap windows) have been pre-computed by the application. Your sole job is to arrange these pre-computed activities into a natural, conflict-free daily timeline.

Do NOT recalculate any parameters. Use the exact values provided.

POTTY MODEL RULES:

EVENT-BASED potty:
Each awake window gets a maximum of 2 potty trips: wake-up potty (first activity, always) and pre-nap potty (last activity before nap/bed, always).
A 3rd post-meal potty is added ONLY if the post-meal time (meal end + 15 min) is at least 45 min after the wake-up potty AND at least 45 min before the pre-nap potty. Otherwise, drop it.
No potty trips between play, training, or calm bonding.

TIME-BASED potty:
Potty is spaced by time, not tied to activities:
1. Morning wake-up potty
2. Post-meal potty — only if 45+ min after the previous potty (if Meal 1 is within 30 min of waking, the wake-up potty covers it — skip the post-meal trip)
3. Final potty — immediately before bed
4. Additional trips if a gap would exceed the max interval provided in the parameters
No potty before/after naps, play, training, or walks.

SCHEDULE CONSTRUCTION:

EVENT-BASED POTTY:
Potty (wake) -> Meal (if scheduled) -> Activities (walk/play/training) -> Calm bonding -> Potty (pre-nap) -> Nap. Post-meal potty only if it fits 45+ min from both wake-up and pre-nap potty. Repeat until bedtime.

TIME-BASED POTTY:
Potty (wake) -> Meal -> Activities distributed across the day -> Nap (no potty around it) -> more activities -> Meal 2 -> Potty (post-meal, only if 45+ min from previous) -> evening activities -> Calm bonding -> Potty (final) -> Overnight sleep.

ACTIVITY DISTRIBUTION RULES:
1. Place meals at the exact pre-computed times. Do not adjust meal times.
2. Never place two of the same activity back-to-back. Minimum 2-hour gap between any two walks, any two training sessions, or any two play sessions.
3. Each awake window: ONE primary activity (walk, play, or training) plus calm bonding. Multiple primaries only if the window is 3+ hours with adequate spacing.
4. Spread activities proportionally across the entire waking day. Do not cluster everything in the morning and leave the afternoon/evening empty.
5. The final 2 hours before bedtime must contain at least one activity (calm bonding as wind-down + final potty).
6. Morning walk after first meal. Evening walk in second half of day.
7. Training after naps (when alert). Calm bonding as evening wind-down.
8. Enforce awake window maximums — insert nap when window is reached.

RESPONSE RULES:
1. Use the pre-computed parameters exactly as provided. Do not recalculate or override any values.
2. Every potty trip and every nap must appear explicitly in the output with time and duration.
3. Output exactly ONE timeline. Resolve all conflicts (meal-nap overlaps, potty consolidation, activity spacing) internally before producing output.
4. Use only these activity types: Potty, Meal, Walk, Training, Play, Calm bonding, Nap, Overnight sleep. No "free time," "settle," "rest," or filler entries.
5. Each activity gets a 1-2 sentence description with practical guidance for the owner.

OUTPUT FORMAT:
Return ONLY a JSON array. No markdown, no explanation, no preamble.
Each element: { "time": "HH:MM", "activity": "Activity Name", "category": "type", "description": "1-2 sentence guidance" }
Categories: feeding, potty, exercise, training, rest, play, bonding`;
}

function buildUserPrompt(puppyName: string, params: ScheduleParams): string {
  const pottyLine = params.pottyModel === 'event_based'
    ? `  Wake-up potty + pre-nap potty each awake window. Post-meal potty only if 45+ min from adjacent potties.`
    : `  Max daytime gap: ${params.pottyMaxDaytimeGapHours}h. Wake-up + final potty always. Post-meal potty if 45+ min from previous.`;

  return `Generate a daily schedule for ${puppyName}.

SCHEDULE: ${params.wakeUpTime} wake -> ${params.bedTime} bed (${params.wakingHours} waking hours)

PRE-COMPUTED PARAMETERS (use these exact values):
- Potty model: ${params.pottyModel}
${pottyLine}
- Overnight potty breaks: ${params.pottyOvernightBreaks}
- Meals: ${params.mealsPerDay}/day at [${params.mealTimes.join(', ')}]
- Walks: ${params.walkDurationMinutes} min x ${params.walkSessionsPerDay}/day
- Training: ${params.trainingSessionMinutes} min x ${params.trainingSessionsPerDay}/day
- Naps: ${params.napDurationMinutes} min x ${params.napsPerDay}/day (max awake window: ${params.awakeWindowMinutes} min)
- Play: ${params.playSessionMinutes} min x ${params.playSessionsPerDay}/day
- Calm bonding: ${params.calmBondingMinutes} min x ${params.calmBondingSessions}/day

Return ONLY the JSON array.`;
}

function validateRoutine(activities: RoutineActivity[]): boolean {
  if (!Array.isArray(activities) || activities.length < 10 || activities.length > 25) {
    return false;
  }

  const validCategories = ['feeding', 'potty', 'exercise', 'training', 'rest', 'play', 'bonding'];

  for (const activity of activities) {
    if (!activity.time || !activity.activity || !activity.category || !activity.description) {
      return false;
    }
    if (!validCategories.includes(activity.category)) {
      return false;
    }
    if (!/^\d{2}:\d{2}$/.test(activity.time)) {
      return false;
    }
  }

  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { puppyId, questionnaireData } = await req.json();

    if (!puppyId || !questionnaireData) {
      return new Response(
        JSON.stringify({ error: 'Missing puppyId or questionnaireData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user has access to this puppy
    const { data: membership, error: membershipError } = await supabase
      .from('puppy_memberships')
      .select('role')
      .eq('puppy_id', puppyId)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - you do not have access to this puppy' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read puppy record to get denormalized breed fields
    const { data: puppy, error: puppyError } = await supabase
      .from('puppies')
      .select('date_of_birth, breed_size, energy_level, is_brachycephalic')
      .eq('id', puppyId)
      .single();

    if (puppyError || !puppy) {
      return new Response(
        JSON.stringify({ error: 'Puppy not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = questionnaireData as QuestionnaireData;
    const dateOfBirth = puppy.date_of_birth || data.dateOfBirth;
    const breedSize = (puppy.breed_size || 'medium') as BreedSize;
    const energyLevel = (puppy.energy_level || 'moderate') as EnergyLevel;
    const isBrachycephalic = puppy.is_brachycephalic ?? false;

    console.log('Computing schedule params for puppy:', puppyId);

    // Layer 1: Deterministic parameter computation
    const params = computeScheduleParams({
      dateOfBirth,
      breedSize,
      energyLevel,
      isBrachycephalic,
      wakeUpTime: data.wakeUpTime,
      bedTime: data.bedTime,
    });

    console.log('Schedule params:', JSON.stringify({ ageBracket: params.ageBracket, ageWeeks: params.ageWeeks, mealsPerDay: params.mealsPerDay }));

    // Layer 2: LLM schedule assembly
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(data.puppyName, params);

    console.log('Calling Claude API with system + user prompt...');
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errBody);
      throw new Error(`Claude API returned ${claudeResponse.status}: ${errBody}`);
    }

    const response = await claudeResponse.json();
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let activities: RoutineActivity[];
    try {
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      activities = JSON.parse(jsonText);
    } catch {
      console.error('Failed to parse Claude response:', content.text);
      throw new Error('Invalid JSON response from Claude');
    }

    if (!validateRoutine(activities)) {
      console.error('Invalid routine structure:', activities);
      throw new Error('Generated routine failed validation');
    }

    console.log('Generated', activities.length, 'activities');

    // Save to database
    await supabase
      .from('routines')
      .update({ is_active: false })
      .eq('puppy_id', puppyId)
      .eq('is_active', true);

    const { data: routine, error: routineError } = await supabase
      .from('routines')
      .insert({
        puppy_id: puppyId,
        source: 'ai_generated',
        is_active: true,
      })
      .select()
      .single();

    if (routineError) {
      console.error('Failed to create routine:', routineError);
      throw routineError;
    }

    const routineItems = activities.map((activity, index) => ({
      routine_id: routine.id,
      activity_type: activity.category,
      title: activity.activity,
      description: activity.description,
      scheduled_time: activity.time + ':00',
      sort_order: index,
      is_enabled: true,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('routine_items')
      .insert(routineItems)
      .select();

    if (itemsError) {
      console.error('Failed to insert routine items:', itemsError);
      throw itemsError;
    }

    console.log('Inserted', insertedItems?.length, 'routine items');

    const result = {
      routine: {
        ...routine,
        routine_items: (insertedItems || []).sort((a, b) =>
          a.scheduled_time.localeCompare(b.scheduled_time)
        ),
      },
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-routine:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to generate routine',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
