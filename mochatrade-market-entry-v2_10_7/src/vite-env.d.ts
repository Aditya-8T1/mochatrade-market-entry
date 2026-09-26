/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** REST Countries v5 key. Must allow the page's hostname under CORS origins. */
  readonly VITE_RESTCOUNTRIES_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
