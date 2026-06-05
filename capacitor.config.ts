import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pupplan.app',
  appName: 'PupPlan',
  webDir: 'dist',
  server: {
    // Allow navigation to the custom scheme callback
    allowNavigation: ['*.supabase.co'],
  },
  plugins: {
    Browser: {
      // No extra config needed — we just use it to open the system browser
    },
  },
  ios: {
    scheme: 'com.pupplan.app',
  },
};

export default config;
