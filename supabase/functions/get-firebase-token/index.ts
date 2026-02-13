import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as admin from 'https://esm.sh/firebase-admin@11.10.1';

// Initialize Firebase Admin SDK (server-side only)
const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

serve(async (req) => {
  try {
    // Verify Supabase auth
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get user's puppy access (owner OR caretaker)
    const { data: memberships, error: membershipError } = await supabaseClient
      .from('puppy_memberships')
      .select('puppy_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membershipError) {
      throw membershipError;
    }

    const puppyIds = memberships.map(m => m.puppy_id);

    // Generate Firebase Custom Token with puppyIds claim
    const firebaseToken = await admin.auth().createCustomToken(user.id, {
      puppyIds: puppyIds,
      email: user.email
    });

    return new Response(
      JSON.stringify({ firebaseToken }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating Firebase token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
