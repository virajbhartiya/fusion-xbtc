/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ETH_HTLC_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
