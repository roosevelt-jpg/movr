/**
 * Deploy KYCRegistry to Polygon Amoy (testnet) / Polygon PoS (mainnet).
 * Gas per attestation should be near-zero on Polygon.
 *
 * Usage: pnpm --filter @movr/blockchain deploy:amoy
 */
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  const verifier = process.env.KYC_VERIFIER_ADDRESS || deployer.address;

  const Registry = await ethers.getContractFactory('KYCRegistry');
  const registry = await Registry.deploy(deployer.address, verifier);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log('KYCRegistry deployed to', address);
  console.log('Admin', deployer.address);
  console.log('Verifier', verifier);
  console.log('Paste this address as kyc_registry.contract_address in Integrations Hub (or KYC_REGISTRY_ADDRESS in .env).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
