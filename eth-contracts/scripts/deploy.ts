import { ethers } from "hardhat";

async function main() {
  const ETHHTLC = await ethers.getContractFactory("ETHHTLC");
  const contract = await ETHHTLC.deploy();
  await (contract as any).deployTransaction.wait();
  console.log("ETHHTLC deployed to:", (contract as any).address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 