import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fun.patharrows',
  appName: 'Path Arrows',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
