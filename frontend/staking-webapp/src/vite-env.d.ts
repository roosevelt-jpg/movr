/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_STAKING_POOL_ADDRESS?: string;
  readonly VITE_DVT_TOKEN_ADDRESS?: string;
  readonly VITE_DVT_MERKLE_DISTRIBUTOR_ADDRESS?: string;
  readonly VITE_CLAIM_PAGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
