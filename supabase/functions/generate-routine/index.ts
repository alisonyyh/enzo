import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuestionnaireData {
  puppyName: string;
  breed: string;
  ageMonths: number;
  ageWeeks: number;
  weight: number | null;
  weightUnit: 'lbs' | 'kg';
  livingSituation: string;
  workArrangement: string;
  wakeUpTime: string;
  bedTime: string;
}

interface RoutineActivity {
  time: string;
  activity: string;
  category: string;
  description: string;
}

// Build Claude prompt for routine generation
function buildRoutinePrompt(data: QuestionnaireData): string {
  const totalWeeks = data.ageMonths * 4 + data.ageWeeks;
  const isYoung = totalWeeks < 16;

  return `You are a certified professional dog trainer (CPDT-KA) and veterinary advisor. Generate a personalized daily care routine for a puppy.

PUPPY DETAILS:
- Name: ${data.puppyName}
- Breed: ${data.breed}
- Age: ${data.ageMonths} months, ${data.ageWeeks} weeks (${totalWeeks} weeks total)
- Weight: ${data.weight || 'unknown'} ${data.weightUnit}
- Living Situation: ${data.livingSituation.replace(/-/g, ' ')}
- Owner's Work Schedule: ${data.workArrangement.replace(/-/g, ' ')}
- Wake-up Time: ${data.wakeUpTime}
- Bedtime: ${data.bedTime}

CRITICAL SAFETY RULES:
1. Exercise: Max ${Math.min(totalWeeks * 5, 60)} minutes per day (5 min/week of age)
2. Feeding: ${isYoung ? '4 meals/day' : '3 meals/day'} for this age
3. Potty breaks: Every ${isYoung ? '2' : '3'} hours minimum
4. Training sessions: 5-10 minutes max (puppies have short attention spans)
5. Avoid: dog parks until fully vaccinated (16 weeks), jumping/stairs (joint damage)

REQUIRED ACTIVITIES (15-20 total):
- Feeding (age-appropriate portions for ${data.breed})
- Potty breaks (frequent, after meals/play/naps)
- Exercise (gentle walks, no forced running)
- Training (positive reinforcement, basic commands)
- Nap/crate time (puppies need 18-20 hours sleep)
- Play sessions (interactive, mental stimulation)
- Socialization (safe exposure to sounds, surfaces, people)

SCHEDULE CONSTRAINTS:
- Align with owner's wake (${data.wakeUpTime}) and bed (${data.bedTime}) times
- If work arrangement is "office/hybrid", avoid activities requiring owner presence during typical work hours (9am-5pm)
- Space activities evenly throughout waking hours

OUTPUT FORMAT (JSON array):
[
  {
    "time": "07:00",
    "activity": "Morning Potty Break",
    "category": "potty",
    "description": "Take puppy outside immediately after waking. Praise enthusiastically when they go. Young puppies have small bladders—don't delay!"
  }
]

CATEGORIES (use exactly these):
- feeding
- potty
- exercise
- training
- rest
- play
- bonding

Return ONLY the JSON array. No additional text, explanations, or markdown formatting.`;
}

// Validate Claude response
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
    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(activity.time)) {
      return false;
    }
  }

  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { puppyId, questionnaireData } = await req.json();

    if (!puppyId || !questionnaireData) {
      return new Response(
        JSON.stringify({ error: 'Missing puppyId or questionnaireData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user owns this puppy
    const { data: membership, error: membershipError } = await supabase
      .from('puppy_memberships')
      .select('role')
      .eq('puppy_id', puppyId)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - you do not own this puppy' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating routine for puppy:', puppyId);

    // Call Claude API
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const prompt = buildRoutinePrompt(questionnaireData);

    console.log('Calling Claude API...');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    // Parse Claude response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let activities: RoutineActivity[];
    try {
      // Claude sometimes wraps JSON in markdown code blocks, so we need to extract it
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```')) {
        // Remove markdown code block
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      activities = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content.text);
      throw new Error('Invalid JSON response from Claude');
    }

    // Validate routine
    if (!validateRoutine(activities)) {
      console.error('Invalid routine structure:', activities);
      throw new Error('Generated routine failed validation');
    }

    console.log('Generated', activities.length, 'activities');

    // Deactivate existing routines for this puppy
    await supabase
      .from('routines')
      .update({ is_active: false })
      .eq('puppy_id', puppyId)
      .eq('is_active', true);

    // Create new routine
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

    console.log('Created routine:', routine.id);

    // Insert routine items
    const routineItems = activities.map((activity, index) => ({
      routine_id: routine.id,
      activity_type: activity.category,
      title: activity.activity,
      description: activity.description,
      scheduled_time: activity.time + ':00', // Convert HH:MM to HH:MM:SS
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

    // Return complete routine
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
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in generate-routine:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to generate routine',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
