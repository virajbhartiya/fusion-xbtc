/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ETH_HTLC_ADDRESS: string;
  readonly VITE_UNISAT_PUBKEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
