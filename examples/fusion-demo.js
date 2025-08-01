#!/usr/bin/env node

/**
 * Fusion+ Cross-Chain Swap Demo
 * 
 * This script demonstrates a complete cross-chain swap using Fusion+ integration
 * between Ethereum and Bitcoin.
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Fusion+ Cross-Chain Swap Demo\n');

// Demo configuration
const DEMO_CONFIG = {
  direction: 'eth2btc',
  ethAmount: '0.005',
  btcAmount: '0.0005',
  ethAddress: process.env.ETH_ADDRESS || 'your_ethereum_address',
  btcAddress: process.env.BTC_ADDRESS || 'your_bitcoin_address',
  timelock: '1800', // 30 minutes
  network: 'goerli'
};

// Step 1: Deploy FusionHTLC contract
function deployContract() {
  console.log('📋 Step 1: Deploying FusionHTLC Contract');
  console.log('=' .repeat(50));
  
  try {
    const deployOutput = execSync('pnpm deploy:fusion --network goerli', {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log(deployOutput);
    
    // Extract contract address
    const addressMatch = deployOutput.match(/FusionHTLC deployed to: (0x[a-fA-F0-9]{40})/);
    if (addressMatch) {
      const contractAddress = addressMatch[1];
      console.log(`✅ Contract deployed successfully at: ${contractAddress}`);
      
      // Save for next steps
      fs.writeFileSync('demo-contract-address.txt', contractAddress);
      return contractAddress;
    } else {
      throw new Error('Could not extract contract address');
    }
  } catch (error) {
    console.error('❌ Contract deployment failed:', error.message);
    throw error;
  }
}

// Step 2: Create Fusion+ order
function createOrder(contractAddress) {
  console.log('\n📋 Step 2: Creating Fusion+ Order');
  console.log('=' .repeat(50));
  
  try {
    const orderCommand = [
      'pnpm fusion:swap create',
      `--direction=${DEMO_CONFIG.direction}`,
      `--ethAmount=${DEMO_CONFIG.ethAmount}`,
      `--btcAmount=${DEMO_CONFIG.btcAmount}`,
      `--ethAddress=${DEMO_CONFIG.ethAddress}`,
      `--btcAddress=${DEMO_CONFIG.btcAddress}`,
      `--timelock=${DEMO_CONFIG.timelock}`,
      `--contractAddress=${contractAddress}`,
      `--rpcUrl=${process.env.RPC_URL || 'https://eth-goerli.g.alchemy.com/v2/your-api-key'}`,
      `--privateKey=${process.env.PRIVATE_KEY}`
    ].join(' ');
    
    const orderOutput = execSync(orderCommand, {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log(orderOutput);
    
    // Parse order details
    const orderMatch = orderOutput.match(/"orderId":"([^"]+)"/);
    if (orderMatch) {
      const orderId = orderMatch[1];
      console.log(`✅ Fusion+ order created: ${orderId}`);
      
      // Save order details
      const orderData = {
        orderId,
        contractAddress,
        direction: DEMO_CONFIG.direction,
        ethAmount: DEMO_CONFIG.ethAmount,
        btcAmount: DEMO_CONFIG.btcAmount,
        ethAddress: DEMO_CONFIG.ethAddress,
        btcAddress: DEMO_CONFIG.btcAddress,
        timelock: DEMO_CONFIG.timelock,
        createdAt: new Date().toISOString()
      };
      
      fs.writeFileSync('demo-order.json', JSON.stringify(orderData, null, 2));
      return orderId;
    } else {
      throw new Error('Could not extract order ID');
    }
  } catch (error) {
    console.error('❌ Order creation failed:', error.message);
    throw error;
  }
}

// Step 3: Check order status
function checkOrderStatus(contractAddress, orderId) {
  console.log('\n📋 Step 3: Checking Order Status');
  console.log('=' .repeat(50));
  
  try {
    const statusCommand = [
      'pnpm fusion:swap status',
      `--orderId=${orderId}`,
      `--contractAddress=${contractAddress}`,
      `--rpcUrl=${process.env.RPC_URL || 'https://eth-goerli.g.alchemy.com/v2/your-api-key'}`,
      `--privateKey=${process.env.PRIVATE_KEY}`
    ].join(' ');
    
    const statusOutput = execSync(statusCommand, {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log(statusOutput);
    
    // Parse status
    const statusData = JSON.parse(statusOutput);
    console.log(`✅ Order status: ${statusData.currentStatus}`);
    return statusData;
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    throw error;
  }
}

// Step 4: List active orders
function listOrders(contractAddress) {
  console.log('\n📋 Step 4: Listing Active Orders');
  console.log('=' .repeat(50));
  
  try {
    const listCommand = [
      'pnpm fusion:swap list',
      `--contractAddress=${contractAddress}`,
      `--rpcUrl=${process.env.RPC_URL || 'https://eth-goerli.g.alchemy.com/v2/your-api-key'}`,
      `--privateKey=${process.env.PRIVATE_KEY}`
    ].join(' ');
    
    const listOutput = execSync(listCommand, {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log(listOutput);
    console.log('✅ Order listing completed');
  } catch (error) {
    console.error('❌ Order listing failed:', error.message);
    throw error;
  }
}

// Step 5: Demonstrate order matching (simulation)
function simulateOrderMatching(contractAddress, orderId) {
  console.log('\n📋 Step 5: Simulating Order Matching');
  console.log('=' .repeat(50));
  
  console.log('This step would typically involve:');
  console.log('1. Counterparty discovering the order through Fusion+ API');
  console.log('2. Counterparty providing the secret preimage');
  console.log('3. Executing the matchFusionOrder() function');
  console.log('4. Transferring ETH to both parties');
  console.log('5. Revealing secret for Bitcoin HTLC execution');
  
  console.log('\nTo execute a real match, use:');
  console.log(`pnpm fusion:swap match --orderId=${orderId} --secret=0x... --ethAmount=${DEMO_CONFIG.btcAmount} --contractAddress=${contractAddress}`);
  
  console.log('\n✅ Order matching simulation completed');
}

// Step 6: Generate demo report
function generateDemoReport(contractAddress, orderId, statusData) {
  console.log('\n📋 Step 6: Demo Summary');
  console.log('=' .repeat(50));
  
  const report = {
    demoName: 'Fusion+ Cross-Chain Swap Demo',
    timestamp: new Date().toISOString(),
    network: DEMO_CONFIG.network,
    contractAddress,
    orderId,
    demoConfig: DEMO_CONFIG,
    status: statusData,
    nextSteps: [
      '1. Wait for counterparty to match the order',
      '2. Execute Bitcoin HTLC with revealed secret',
      '3. Complete cross-chain atomic swap',
      '4. Verify balances on both chains'
    ],
    commands: {
      checkStatus: `pnpm fusion:swap status --orderId=${orderId}`,
      listOrders: 'pnpm fusion:swap list',
      matchOrder: `pnpm fusion:swap match --orderId=${orderId} --secret=0x... --ethAmount=${DEMO_CONFIG.btcAmount}`,
      cancelOrder: `pnpm fusion:swap cancel --orderId=${orderId}`
    }
  };
  
  const reportPath = 'demo-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('✅ Demo report saved to:', reportPath);
  console.log('\n🎉 Fusion+ Cross-Chain Swap Demo Completed!');
  console.log('\n📋 Demo Summary:');
  console.log(`   • Contract deployed: ${contractAddress}`);
  console.log(`   • Order created: ${orderId}`);
  console.log(`   • Direction: ${DEMO_CONFIG.direction}`);
  console.log(`   • ETH Amount: ${DEMO_CONFIG.ethAmount} ETH`);
  console.log(`   • BTC Amount: ${DEMO_CONFIG.btcAmount} BTC`);
  console.log(`   • Status: ${statusData.currentStatus}`);
  console.log(`   • Timelock: ${DEMO_CONFIG.timelock} seconds`);
  
  console.log('\n🚀 Ready for live cross-chain swap execution!');
}

// Main demo execution
async function runDemo() {
  try {
    console.log('Starting Fusion+ Cross-Chain Swap Demo...\n');
    
    // Check environment
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    
    const contractAddress = deployContract();
    const orderId = createOrder(contractAddress);
    
    // Wait for blockchain confirmation
    console.log('\n⏳ Waiting for blockchain confirmation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statusData = checkOrderStatus(contractAddress, orderId);
    listOrders(contractAddress);
    simulateOrderMatching(contractAddress, orderId);
    
    generateDemoReport(contractAddress, orderId, statusData);
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run demo if this script is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = {
  runDemo,
  DEMO_CONFIG
}; 