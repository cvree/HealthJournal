/// <reference types="vite/client" />

// Claude artifact storage API (real inside Claude.ai, polyfilled by src/lib/storage.ts)
interface Window {
  storage?: {
    get(key: string): Promise<{ key: string; value: string } | null>;
    set(key: string, value: string): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    list(prefix?: string): Promise<{ keys: string[] }>;
  };
}
