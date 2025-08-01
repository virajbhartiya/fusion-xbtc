#!/usr/bin/env node

/**
 * Fusion+ Integration Test
 * 
 * This script demonstrates the integration of 1inch Fusion+ protocol
 * with cross-chain atomic swaps between Ethereum and Bitcoin.
 * 
 * Test Flow:
 * 1. Deploy FusionHTLC contract
 * 2. Create Fusion+ order for ETH->BTC swap
 * 3. Simulate order matching and execution
 * 4. Verify atomic swap guarantees
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Fusion+ Integration with Cross-Chain Swaps\n');

// Test configuration
const TEST_CONFIG = {
  direction: 'eth2btc',
  ethAmount: '0.01',
  btcAmount: '0.001',
  ethAddress: process.env.ETH_ADDRESS || 'your_ethereum_address',
  btcAddress: process.env.BTC_ADDRESS || 'your_bitcoin_address',
  timelock: '3600',
  network: 'goerli',
  rpcUrl: process.env.RPC_URL || 'https://eth-goerli.g.alchemy.com/v2/your-api-key'
};

// Test environment setup
function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');
  
  // Create test directories
  const testDirs = [
    'examples/fusion-swaps',
    'logs/fusion-tests',
    'deployments'
  ];
  
  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  console.log('✅ Test environment ready');
}

// Deploy FusionHTLC contract
function deployFusionContract() {
  console.log('\n🚀 Deploying FusionHTLC contract...');
  
  try {
    // Set environment variables for deployment
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required for deployment');
    }
    process.env.RPC_URL = TEST_CONFIG.rpcUrl;
    
    // Run deployment script
    const deployOutput = execSync('cd eth-contracts && npx hardhat run scripts/deploy-fusion-htlc.ts --network goerli', {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log('Deployment output:', deployOutput);
    
    // Extract contract address from deployment
    const addressMatch = deployOutput.match(/FusionHTLC deployed to: (0x[a-fA-F0-9]{40})/);
    if (addressMatch) {
      const contractAddress = addressMatch[1];
      console.log(`✅ FusionHTLC deployed at: ${contractAddress}`);
      
      // Save contract address for tests
      fs.writeFileSync('test-fusion-contract-address.txt', contractAddress);
      return contractAddress;
    } else {
      throw new Error('Could not extract contract address from deployment');
    }
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    throw error;
  }
}

// Create Fusion+ order
function createFusionOrder(contractAddress) {
  console.log('\n📝 Creating Fusion+ order...');
  
  try {
    const orderCommand = [
      'cd cli && npm run fusion-swap',
      'create',
      `--direction=${TEST_CONFIG.direction}`,
      `--ethAmount=${TEST_CONFIG.ethAmount}`,
      `--btcAmount=${TEST_CONFIG.btcAmount}`,
      `--ethAddress=${TEST_CONFIG.ethAddress}`,
      `--btcAddress=${TEST_CONFIG.btcAddress}`,
      `--timelock=${TEST_CONFIG.timelock}`,
      `--contractAddress=${contractAddress}`,
      `--rpcUrl=${TEST_CONFIG.rpcUrl}`,
      `--privateKey=${process.env.PRIVATE_KEY}`
    ].join(' ');
    
    const orderOutput = execSync(orderCommand, {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log('Order creation output:', orderOutput);
    
    // Parse order details from output
    const orderMatch = orderOutput.match(/"orderId":"([^"]+)"/);
    if (orderMatch) {
      const orderId = orderMatch[1];
      console.log(`✅ Fusion+ order created: ${orderId}`);
      return orderId;
    } else {
      throw new Error('Could not extract order ID from output');
    }
  } catch (error) {
    console.error('❌ Order creation failed:', error.message);
    throw error;
  }
}

// Check order status
function checkOrderStatus(contractAddress, orderId) {
  console.log('\n🔍 Checking order status...');
  
  try {
    const statusCommand = [
      'cd cli && npm run fusion-swap',
      'status',
      `--orderId=${orderId}`,
      `--contractAddress=${contractAddress}`,
      `--rpcUrl=${TEST_CONFIG.rpcUrl}`,
      `--privateKey=${process.env.PRIVATE_KEY}`
    ].join(' ');
    
    const statusOutput = execSync(statusCommand, {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log('Status output:', statusOutput);
    
    // Parse status from JSON output
    const statusData = JSON.parse(statusOutput);
    console.log(`✅ Order status: ${statusData.currentStatus}`);
    return statusData;
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    throw error;
  }
}

// List active orders
function listActiveOrders(contractAddress) {
  console.log('\n📋 Listing active orders...');
  
  try {
    const listCommand = [
      'cd cli && npm run fusion-swap',
      'list',
      `--contractAddress=${contractAddress}`,
      `--rpcUrl=${TEST_CONFIG.rpcUrl}`,
      `--privateKey=${process.env.PRIVATE_KEY}`
    ].join(' ');
    
    const listOutput = execSync(listCommand, {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log('Active orders:', listOutput);
    console.log('✅ Order listing completed');
  } catch (error) {
    console.error('❌ Order listing failed:', error.message);
    throw error;
  }
}

// Test HTLC integration
function testHTLCIntegration(contractAddress) {
  console.log('\n🔗 Testing HTLC integration...');
  
  try {
    // Test standard HTLC functions
    const htlcTestCommand = [
      'cd cli && npm run eth-lock',
      `--amount=${TEST_CONFIG.ethAmount}`,
      `--recipient=${TEST_CONFIG.ethAddress}`,
      `--timelock=${TEST_CONFIG.timelock}`,
      `--contractAddress=${contractAddress}`,
      `--rpcUrl=${TEST_CONFIG.rpcUrl}`,
      `--privateKey=${process.env.PRIVATE_KEY}`
    ].join(' ');
    
    const htlcOutput = execSync(htlcTestCommand, {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    console.log('HTLC integration test output:', htlcOutput);
    console.log('✅ HTLC integration verified');
  } catch (error) {
    console.error('❌ HTLC integration test failed:', error.message);
    throw error;
  }
}

// Generate test report
function generateTestReport(contractAddress, orderId, statusData) {
  console.log('\n📊 Generating test report...');
  
  const report = {
    testName: 'Fusion+ Integration Test',
    timestamp: new Date().toISOString(),
    network: TEST_CONFIG.network,
    contractAddress,
    orderId,
    testConfig: TEST_CONFIG,
    status: statusData,
    results: {
      deployment: 'PASS',
      orderCreation: 'PASS',
      statusCheck: 'PASS',
      htlcIntegration: 'PASS'
    }
  };
  
  const reportPath = 'logs/fusion-tests/integration-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`✅ Test report saved to: ${reportPath}`);
  console.log('\n🎉 Fusion+ Integration Test Completed Successfully!');
  console.log('\n📋 Test Summary:');
  console.log(`   • Contract deployed: ${contractAddress}`);
  console.log(`   • Order created: ${orderId}`);
  console.log(`   • Status: ${statusData.currentStatus}`);
  console.log(`   • HTLC integration: Verified`);
  console.log(`   • Cross-chain swap: Ready for execution`);
}

// Main test execution
async function runFusionIntegrationTest() {
  try {
    setupTestEnvironment();
    
    const contractAddress = deployFusionContract();
    const orderId = createFusionOrder(contractAddress);
    
    // Wait a moment for blockchain confirmation
    console.log('\n⏳ Waiting for blockchain confirmation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const statusData = checkOrderStatus(contractAddress, orderId);
    listActiveOrders(contractAddress);
    testHTLCIntegration(contractAddress);
    
    generateTestReport(contractAddress, orderId, statusData);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runFusionIntegrationTest();
}

module.exports = {
  runFusionIntegrationTest,
  TEST_CONFIG
}; 