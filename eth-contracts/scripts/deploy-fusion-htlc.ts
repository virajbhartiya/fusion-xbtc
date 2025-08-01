#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';

declare const hre: any;

async function main() {
  console.log('Deploying Fusion+ HTLC contract...');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', await hre.ethers.provider.getBalance(deployer.address));

  // Deploy FusionHTLC contract
  const FusionHTLC = await hre.ethers.getContractFactory('FusionHTLC');
  const fusionHTLC = await FusionHTLC.deploy();
  
  await fusionHTLC.waitForDeployment();
  const fusionHTLCAddress = await fusionHTLC.getAddress();

  console.log('FusionHTLC deployed to:', fusionHTLCAddress);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      FusionHTLC: {
        address: fusionHTLCAddress,
        constructorArgs: [],
        deployedAt: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber(),
      }
    },
    deploymentInfo: {
      timestamp: Date.now(),
      networkId: hre.network.config.chainId,
      gasUsed: await fusionHTLC.deploymentTransaction()?.gasLimit?.toString() || 'unknown',
    }
  };

  // Save to deployment file
  const deploymentPath = path.join(__dirname, '../deployments', `${hre.network.name}.json`);
  const deploymentDir = path.dirname(deploymentPath);
  
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('Deployment info saved to:', deploymentPath);

  // Verify contract on Etherscan (if not on local network)
  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    console.log('Waiting for block confirmations before verification...');
    await fusionHTLC.deploymentTransaction()?.wait(6);
    
    try {
      await hre.ethers.run('verify:verify', {
        address: fusionHTLCAddress,
        constructorArguments: [],
      });
      console.log('Contract verified on Etherscan');
    } catch (error) {
      console.log('Verification failed:', error);
    }
  }

  console.log('Deployment completed successfully!');
  console.log('FusionHTLC Address:', fusionHTLCAddress);
  
  // Output environment variables for easy setup
  console.log('\nEnvironment variables to set:');
  console.log(`FUSION_HTLC_ADDRESS=${fusionHTLCAddress}`);
  console.log(`NETWORK=${hre.network.name}`);
  console.log(`CHAIN_ID=${hre.network.config.chainId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 