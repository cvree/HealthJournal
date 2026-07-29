import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cvree.healthjournal",
  appName: "Health Journal",
  webDir: "dist",
  ios: {
    contentInset: "always",
  },
};

export default config;
