import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

/**
 * Target: Polygon Amoy testnet for KYCRegistry (near-zero gas).
 * Mainnet equivalent: Polygon PoS.
 */
const config: HardhatUserConfig = {
  solidity: '0.8.20',
  networks: {
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      accounts: process.env.KYC_VERIFIER_PRIVATE_KEY
        ? [process.env.KYC_VERIFIER_PRIVATE_KEY]
        : [],
      chainId: 80002,
    },
    hardhat: {},
  },
};

export default config;
