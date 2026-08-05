import { ethers } from 'hardhat';

/**
 * Deploy DriveToken to Polygon Amoy (or hardhat).
 * Usage: npx hardhat run scripts/deploy-drive-token.ts --network amoy
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const distributor = process.env.DVT_DISTRIBUTOR_ADDRESS || deployer.address;

  const Factory = await ethers.getContractFactory('DriveToken');
  const token = await Factory.deploy(deployer.address, distributor);
  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log('DriveToken deployed:', address);
  console.log('Owner:', deployer.address);
  console.log('Distributor:', distributor);
  console.log('Set DVT_TOKEN_ADDRESS=', address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
