import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.getenzo.enzo',
  appName: 'Enzo',
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
    scheme: 'app.getenzo.enzo',
  },
};

export default config;
