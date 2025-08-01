import fs from 'fs';
import path from 'path';

declare const hre: any;

async function main() {
  const ETHHTLC = await hre.ethers.getContractFactory("ETHHTLC");
  const contract = await ETHHTLC.deploy();
  await contract.waitForDeployment();
  console.log("ETHHTLC deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 