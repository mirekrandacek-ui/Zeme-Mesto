import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.randis2288.zememesto",
  appName: "Země Město",
  webDir: "public",
  server: {
    url: "https://zeme-mesto.vercel.app",
    cleartext: false,
  },
};

export default config;
