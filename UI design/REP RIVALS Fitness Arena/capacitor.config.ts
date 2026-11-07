import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.reprivals.app',
  appName: 'REP RIVALS',
  webDir: 'dist',
  // Serve the bundled build in a secure WebView context. No live-reload URL.
  server: { hostname: 'localhost', androidScheme: 'https', cleartext: false },
  android: { allowMixedContent: false },
  // The Capacitor debug bridge otherwise logs plugin method arguments.
  loggingBehavior: 'none',
  plugins: { SystemBars: { insetsHandling: 'native' } },
};

export default config;
