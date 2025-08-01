/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ETH_HTLC_ADDRESS: string;
  readonly VITE_UNISAT_PUBKEY: string;
  readonly VITE_FUSION_API_BASE_URL: string;
  readonly VITE_FUSION_API_KEY: string;
  readonly VITE_FUSION_HTLC_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
