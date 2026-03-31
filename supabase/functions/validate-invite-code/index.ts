import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse request
    const { code } = await req.json();
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invite code is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    // 2. Verify auth — create a client scoped to the user's JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Use service_role client for DB operations (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 4. Look up invite code
    const { data: inviteCode, error: lookupError } = await adminClient
      .from('invite_codes')
      .select('id, puppy_id')
      .eq('code', normalizedCode)
      .single();

    if (lookupError || !inviteCode) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "That code doesn't match any household. Please check with the puppy's owner and try again.",
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check if user is already a member of this household
    const { data: existingMembership } = await adminClient
      .from('puppy_memberships')
      .select('id')
      .eq('puppy_id', inviteCode.puppy_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingMembership) {
      return new Response(
        JSON.stringify({ success: false, error: "You're already a member of this household." }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Check caretaker limit (max 1 caretaker per puppy in v1)
    const { count: caretakerCount } = await adminClient
      .from('puppy_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('puppy_id', inviteCode.puppy_id)
      .eq('role', 'caretaker')
      .eq('status', 'active');

    if (caretakerCount && caretakerCount >= 1) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This household already has the maximum number of caretakers.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Create caretaker membership
    const { data: membership, error: membershipError } = await adminClient
      .from('puppy_memberships')
      .insert({
        puppy_id: inviteCode.puppy_id,
        user_id: user.id,
        role: 'caretaker',
        status: 'active',
      })
      .select('id, role, joined_at')
      .single();

    if (membershipError) {
      console.error('Failed to create membership:', membershipError);
      return new Response(
        JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Fetch puppy details for the success screen
    const { data: puppy, error: puppyError } = await adminClient
      .from('puppies')
      .select('id, name, breed, age_months, age_weeks, photo_url')
      .eq('id', inviteCode.puppy_id)
      .single();

    if (puppyError || !puppy) {
      console.error('Failed to fetch puppy:', puppyError);
      // Membership was already created — return success with minimal data
      return new Response(
        JSON.stringify({
          success: true,
          puppy: { id: inviteCode.puppy_id, name: 'Your puppy', breed: '', ageWeeks: 0, photoUrl: null },
          membership: { id: membership.id, role: membership.role, joinedAt: membership.joined_at },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Return success with puppy details
    return new Response(
      JSON.stringify({
        success: true,
        puppy: {
          id: puppy.id,
          name: puppy.name,
          breed: puppy.breed,
          ageWeeks: puppy.age_months * 4 + puppy.age_weeks,
          photoUrl: puppy.photo_url,
        },
        membership: {
          id: membership.id,
          role: membership.role,
          joinedAt: membership.joined_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('validate-invite-code error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
