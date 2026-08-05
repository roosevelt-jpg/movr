import { ethers } from 'hardhat';

/**
 * Deploy MerkleDistributor (Phase 8).
 * Requires DVT_TOKEN_ADDRESS and MERKLE_ROOT in env.
 */
async function main() {
  const token = process.env.DVT_TOKEN_ADDRESS;
  const root = process.env.MERKLE_ROOT;
  if (!token || !root) {
    throw new Error('Set DVT_TOKEN_ADDRESS and MERKLE_ROOT');
  }

  const Factory = await ethers.getContractFactory('MerkleDistributor');
  const distributor = await Factory.deploy(token, root);
  await distributor.waitForDeployment();
  const address = await distributor.getAddress();

  console.log('MerkleDistributor deployed:', address);
  console.log('Set DVT_MERKLE_DISTRIBUTOR_ADDRESS=', address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
