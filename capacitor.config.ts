import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cvree.bellwether",
  appName: "Bellwether",
  webDir: "dist",
  ios: {
    contentInset: "always",
  },
};

export default config;
