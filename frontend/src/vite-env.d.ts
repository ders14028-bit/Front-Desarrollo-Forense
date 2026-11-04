/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string;
  readonly VITE_MOCK_ERROR?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_THEHIVE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
