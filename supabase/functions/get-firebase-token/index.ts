import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initializeApp, cert } from 'npm:firebase-admin@12.0.0/app';
import { getAuth } from 'npm:firebase-admin@12.0.0/auth';
import * as jose from 'jsr:@panva/jose@6';

// Initialize Firebase Admin SDK (server-side only)
const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
let app;
try {
  app = initializeApp({
    credential: cert(serviceAccount)
  });
} catch (error) {
  // App already initialized
}

// JWT verification using Supabase's JWKS endpoint (ES256 asymmetric keys)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_JWT_ISSUER = Deno.env.get('SB_JWT_ISSUER') ?? `${SUPABASE_URL}/auth/v1`;
const SUPABASE_JWT_KEYS = jose.createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[Edge Function] Request received');

    // Extract the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[Edge Function] Authorization header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Edge Function] Missing or malformed Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT using Supabase's JWKS endpoint (supports ES256 asymmetric tokens)
    let jwtPayload;
    try {
      const { payload } = await jose.jwtVerify(token, SUPABASE_JWT_KEYS, {
        issuer: SUPABASE_JWT_ISSUER,
      });
      jwtPayload = payload;
    } catch (jwtError) {
      console.error('[Edge Function] JWT verification failed:', jwtError.message);
      return new Response(
        JSON.stringify({ error: 'Invalid JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = jwtPayload.sub;
    const userEmail = jwtPayload.email as string | undefined;

    console.log('[Edge Function] JWT verified, user:', userId);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing sub claim' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key to bypass RLS
    // (this is a trusted server context — user identity is already verified via JWKS above)
    const supabaseClient = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user's puppy access (owner OR caretaker)
    const { data: memberships, error: membershipError } = await supabaseClient
      .from('puppy_memberships')
      .select('puppy_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (membershipError) {
      console.error('[Edge Function] Membership query failed:', membershipError);
      throw membershipError;
    }

    const puppyIds = memberships?.map(m => m.puppy_id) || [];
    console.log('[Edge Function] Found puppy memberships:', puppyIds.length);

    // Generate Firebase Custom Token with puppyIds claim
    const auth = getAuth();
    const firebaseToken = await auth.createCustomToken(userId, {
      puppyIds: puppyIds,
      email: userEmail
    });

    console.log('[Edge Function] Firebase token generated successfully');

    return new Response(
      JSON.stringify({ firebaseToken }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Edge Function] Error generating Firebase token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
