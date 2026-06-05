import { initializeApp } from 'firebase/app';
import { initializeAuth, signInWithCustomToken, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);

// Use localStorage persistence on native platforms (IndexedDB hangs in WKWebView)
const isNative = Capacitor.isNativePlatform();
export const firebaseAuth = initializeAuth(app, {
  persistence: isNative ? browserLocalPersistence : indexedDBLocalPersistence,
});

export const db = getFirestore(app);

// Sign in to Firebase with Custom Token from Supabase
export async function signInToFirebase() {
  console.log('Firebase auth: signInToFirebase() called, native:', isNative);

  // First try to get the current session
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();

  console.log('Firebase auth: getSession() result:', {
    hasSession: !!session,
    hasError: !!sessionError,
    errorMessage: sessionError?.message
  });

  // If no session or error, try to refresh
  if (sessionError || !session) {
    console.log('Firebase auth: No valid session, attempting refresh...');
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshedSession) {
      console.error('Firebase auth: Refresh failed:', refreshError?.message);
      throw new Error(`Not authenticated with Supabase: ${refreshError?.message || 'No session found'}`);
    }

    session = refreshedSession;
    console.log('Firebase auth: Session refreshed successfully');
  }

  console.log('Firebase auth: Supabase session valid, requesting Custom Token...');

  // Call Edge Function to get Firebase Custom Token
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/get-firebase-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': anonKey
    }
  });

  console.log('Firebase auth: Edge Function response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Firebase auth: Edge Function error:', errorData);
    throw new Error(`Failed to get Firebase token: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  console.log('Firebase auth: Edge Function response:', { hasData: !!data, hasToken: !!data.firebaseToken });

  if (!data || !data.firebaseToken) {
    throw new Error('Edge Function returned no token');
  }

  console.log('Firebase auth: Custom Token received, signing in...');

  await signInWithCustomToken(firebaseAuth, data.firebaseToken);

  console.log('Firebase auth: Successfully signed in to Firebase, uid:', firebaseAuth.currentUser?.uid);
}
