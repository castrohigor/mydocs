import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydocs.app',
  appName: 'MyDocs',
  webDir: 'www',
  plugins: {
    SocialLogin: {
      providers: { google: true, apple: false, facebook: false, twitter: false },
    },
    CapacitorShareTarget: {
      // iOS: precisa bater com o App Group criado no Xcode (veja docs/ios-share-extension.md)
      appGroupId: 'group.com.mydocs.app',
    },
  },
};

export default config;
