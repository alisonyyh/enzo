import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3';
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

function buildSlimPrompt(puppyName: string, params: ScheduleParams): string {
  const pottyLine = params.pottyModel === 'event_based'
    ? '  Wake-up potty + pre-nap potty each awake window. Post-meal potty only if 45+ min from adjacent potties.'
    : `  Max daytime gap: ${params.pottyMaxDaytimeGapHours}h. Wake-up + final potty always. Post-meal potty if 45+ min from previous.`;

  return `You are a puppy care schedule assembler. Your job is to arrange pre-computed activities into a natural daily timeline.

PUPPY: ${puppyName}
SCHEDULE: ${params.wakeUpTime} wake → ${params.bedTime} bed (${params.wakingHours} waking hours)

PRE-COMPUTED PARAMETERS (use these exact values):
- Potty model: ${params.pottyModel}
${pottyLine}
- Overnight potty breaks: ${params.pottyOvernightBreaks}
- Meals: ${params.mealsPerDay}/day at [${params.mealTimes.join(', ')}]
- Walks: ${params.walkDurationMinutes} min × ${params.walkSessionsPerDay}/day
- Training: ${params.trainingSessionMinutes} min × ${params.trainingSessionsPerDay}/day
- Naps: ${params.napDurationMinutes} min × ${params.napsPerDay}/day (max awake window: ${params.awakeWindowMinutes} min)
- Play: ${params.playSessionMinutes} min × ${params.playSessionsPerDay}/day
- Calm bonding: ${params.calmBondingMinutes} min × ${params.calmBondingSessions}/day

ASSEMBLY RULES:
1. Place meals at the exact pre-computed times.
2. Distribute walks, training, play, and calm bonding evenly across waking hours.
3. Never place two of the same activity back-to-back. Min 2h gap between walks, training, or play.
4. Enforce awake window maximums — insert nap when window is reached.
5. Morning walk after first meal. Evening walk in second half of day.
6. Training after naps (when alert). Calm bonding as evening wind-down.
7. Final 2 hours before bed: at least one activity (calm bonding + final potty).

OUTPUT: JSON array of activities. Each: { "time": "HH:MM", "activity": "title", "category": "type", "description": "1-2 sentence guidance" }
Categories: feeding, potty, exercise, training, rest, play, bonding
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

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const prompt = buildSlimPrompt(data.puppyName, params);

    console.log('Calling Claude API with slim prompt...');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

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
