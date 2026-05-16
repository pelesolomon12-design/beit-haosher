import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beithaosher.app',
  appName: 'בית האושר',
  webDir: 'dist/public',
  server: {
    url: 'https://beit-haosher-production.up.railway.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0e1320',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0e1320',
      showSpinner: false,
    },
  },
};

export default config;
