#!/usr/bin/env node

/**
 * Fusion XBTC Integration Test
 * Tests all components to ensure they work together properly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Fusion XBTC Integration Test');
console.log('================================\n');

// Test configuration
const testConfig = {
  orderId: 'test-integration-001',
  amount: '50000',
  minFillAmount: '10000',
  maxFillAmount: '25000',
  recipientAddress: 'tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z',
  refundAddress: 'tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z',
  locktime: '3600',
  network: 'testnet',
  fillAmount: '15000',
  recipientPubkey: '0291de523acb2e4016266c7cae54dd01d4de143584851945d3926a4e75647279f1',
  refundPubkey: '0291de523acb2e4016266c7cae54dd01d4de143584851945d3926a4e75647279f1',
  utxos: '[{"txid":"818f6764b8a1705517122a6692213a712ca4cdaf593a16ad5a1a17113dde7d62","vout":1,"amount":104689,"wif":"cVTqEAVYb5Mu7GwJPirVS6GzG2saQLfbyqNVZJGUivQXofJ8mKSC"}]',
  changeAddress: 'tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z',
  feeSats: '1000',
  electrumHost: 'testnet.hsmiths.com',
  electrumPort: '53011',
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function runTest(name, testFn) {
  console.log(`\n🔍 Testing: ${name}`);
  try {
    testFn();
    console.log(`✅ PASS: ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
  }
}

function execCommand(command) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      timeout: 30000 
    });
  } catch (error) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

// Test 1: Check if all required files exist
runTest('File Structure Check', () => {
  const requiredFiles = [
    'cli/create-order.ts',
    'cli/list-orders.ts',
    'cli/partial-fill.ts',
    'cli/btc-lock.ts',
    'cli/eth-lock.ts',
    'btc-scripts/htlc.ts',
    'btc-scripts/tx-builder.ts',
    'relayer/index.ts',
    'relayer/bitcoin-relayer.ts',
    'relayer/ethereum-relayer.ts',
    'relayer/event-processor.ts',
    'relayer/order-manager.ts',
    'relayer/logger.ts',
    'relayer/bitcoin-resolver.ts',
    'relayer/ethereum-resolver.ts',
    'relayer/package.json',
    'relayer/README.md',
    'relayer/start.sh',
    'package.json',
    'cli-swap-commands.sh',
    'cli-partial-fill-commands.sh',
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
});

// Test 2: Check if CLI package.json has required dependencies
runTest('CLI Dependencies Check', () => {
  const cliPackage = JSON.parse(fs.readFileSync('cli/package.json', 'utf8'));
  const requiredDeps = ['zod', 'bitcoinjs-lib', 'ecpair', 'tiny-secp256k1'];
  
  for (const dep of requiredDeps) {
    if (!cliPackage.dependencies[dep] && !cliPackage.devDependencies[dep]) {
      throw new Error(`Missing CLI dependency: ${dep}`);
    }
  }
});

// Test 3: Check if Relayer package.json has required dependencies
runTest('Relayer Dependencies Check', () => {
  const relayerPackage = JSON.parse(fs.readFileSync('relayer/package.json', 'utf8'));
  const requiredDeps = [
    'bitcoinjs-lib', 'ecpair', 'tiny-secp256k1', 'electrum-client', 
    'ethers', 'dotenv', 'zod'
  ];
  
  for (const dep of requiredDeps) {
    if (!relayerPackage.dependencies[dep] && !relayerPackage.devDependencies[dep]) {
      throw new Error(`Missing relayer dependency: ${dep}`);
    }
  }
});

// Test 4: Test order creation
runTest('Order Creation', () => {
  const command = `pnpm --filter cli exec ts-node create-order.ts \
    --orderId=${testConfig.orderId} \
    --amount=${testConfig.amount} \
    --minFillAmount=${testConfig.minFillAmount} \
    --maxFillAmount=${testConfig.maxFillAmount} \
    --recipientAddress=${testConfig.recipientAddress} \
    --refundAddress=${testConfig.refundAddress} \
    --locktime=${testConfig.locktime} \
    --network=${testConfig.network}`;
  
  const output = execCommand(command);
  const result = JSON.parse(output);
  
  if (!result.orderId || !result.hashlock || !result.secret) {
    throw new Error('Order creation failed - missing required fields');
  }
  
  // Store the hashlock for later tests
  testConfig.hashlock = result.hashlock;
  testConfig.secret = result.secret;
});

// Test 5: Test order listing
runTest('Order Listing', () => {
  const command = 'pnpm --filter cli exec ts-node list-orders.ts';
  const output = execCommand(command);
  
  if (!output.includes(testConfig.orderId)) {
    throw new Error('Order listing failed - created order not found');
  }
});

// Test 6: Test partial fill
runTest('Partial Fill', () => {
  const command = `pnpm --filter cli exec ts-node partial-fill.ts \
    --orderId=${testConfig.orderId} \
    --fillAmount=${testConfig.fillAmount} \
    --maxFillAmount=${testConfig.maxFillAmount} \
    --recipientPubkey=${testConfig.recipientPubkey} \
    --refundPubkey=${testConfig.refundPubkey} \
    --locktime=${testConfig.locktime} \
    --utxos='${testConfig.utxos}' \
    --changeAddress=${testConfig.changeAddress} \
    --feeSats=${testConfig.feeSats} \
    --electrumHost=${testConfig.electrumHost} \
    --electrumPort=${testConfig.electrumPort} \
    --network=${testConfig.network}`;
  
  const output = execCommand(command);
  const result = JSON.parse(output);
  
  if (!result.txid && !result.event) {
    throw new Error('Partial fill failed - no transaction or event returned');
  }
});

// Test 7: Test BTC lock script compilation
runTest('BTC Lock Script Compilation', () => {
  const command = `pnpm --filter cli exec ts-node btc-lock.ts \
    --hashlock=${testConfig.hashlock} \
    --recipientPubkey=${testConfig.recipientPubkey} \
    --refundPubkey=${testConfig.refundPubkey} \
    --locktime=${testConfig.locktime} \
    --amount=${testConfig.fillAmount} \
    --utxos='${testConfig.utxos}' \
    --changeAddress=${testConfig.changeAddress} \
    --feeSats=${testConfig.feeSats} \
    --electrumHost=${testConfig.electrumHost} \
    --electrumPort=${testConfig.electrumPort} \
    --network=${testConfig.network}`;
  
  const output = execCommand(command);
  const result = JSON.parse(output);
  
  if (!result.txid && !result.event) {
    throw new Error('BTC lock failed - no transaction or event returned');
  }
});

// Test 8: Test relayer configuration
runTest('Relayer Configuration', () => {
  const configPath = 'relayer/config.example.ts';
  if (!fs.existsSync(configPath)) {
    throw new Error('Relayer config example not found');
  }
  
  const configContent = fs.readFileSync(configPath, 'utf8');
  if (!configContent.includes('bitcoin') || !configContent.includes('ethereum')) {
    throw new Error('Relayer config missing required sections');
  }
});

// Test 9: Test relayer startup script
runTest('Relayer Startup Script', () => {
  const scriptPath = 'relayer/start.sh';
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Relayer startup script not found');
  }
  
  // Check if script is executable
  const stats = fs.statSync(scriptPath);
  if (!(stats.mode & fs.constants.S_IXUSR)) {
    throw new Error('Relayer startup script is not executable');
  }
});

// Test 10: Test CLI command scripts
runTest('CLI Command Scripts', () => {
  const scripts = ['cli-swap-commands.sh', 'cli-partial-fill-commands.sh'];
  
  for (const script of scripts) {
    if (!fs.existsSync(script)) {
      throw new Error(`CLI command script not found: ${script}`);
    }
    
    const content = fs.readFileSync(script, 'utf8');
    if (!content.includes('pnpm --filter cli exec ts-node')) {
      throw new Error(`CLI command script missing proper commands: ${script}`);
    }
  }
});

// Test 11: Test BTC scripts module
runTest('BTC Scripts Module', () => {
  const htlcPath = 'btc-scripts/htlc.ts';
  const txBuilderPath = 'btc-scripts/tx-builder.ts';
  
  if (!fs.existsSync(htlcPath) || !fs.existsSync(txBuilderPath)) {
    throw new Error('BTC scripts module files not found');
  }
  
  const htlcContent = fs.readFileSync(htlcPath, 'utf8');
  const txBuilderContent = fs.readFileSync(txBuilderPath, 'utf8');
  
  if (!htlcContent.includes('buildHTLCScript') || !txBuilderContent.includes('buildLockTx')) {
    throw new Error('BTC scripts module missing required functions');
  }
});

// Test 12: Test order file creation
runTest('Order File Creation', () => {
  const orderPath = `examples/swaps/${testConfig.orderId}.json`;
  
  if (!fs.existsSync(orderPath)) {
    throw new Error('Order file was not created');
  }
  
  const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
  
  if (orderData.orderId !== testConfig.orderId) {
    throw new Error('Order file contains incorrect order ID');
  }
  
  if (!orderData.hashlock || !orderData.secret) {
    throw new Error('Order file missing required fields');
  }
});

// Print results
console.log('\n📊 Test Results');
console.log('===============');
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

console.log('\n📋 Detailed Results:');
results.tests.forEach(test => {
  const status = test.status === 'PASS' ? '✅' : '❌';
  console.log(`${status} ${test.name}`);
  if (test.error) {
    console.log(`   Error: ${test.error}`);
  }
});

// Cleanup
console.log('\n🧹 Cleaning up test data...');
try {
  const orderPath = `examples/swaps/${testConfig.orderId}.json`;
  if (fs.existsSync(orderPath)) {
    fs.unlinkSync(orderPath);
  }
  
  // Remove any fill logs
  const fillLogs = fs.readdirSync('examples/swaps')
    .filter(file => file.startsWith(`fill-${testConfig.orderId}`));
  
  for (const log of fillLogs) {
    fs.unlinkSync(`examples/swaps/${log}`);
  }
  
  console.log('✅ Cleanup completed');
} catch (error) {
  console.log('⚠️  Cleanup failed:', error.message);
}

// Exit with appropriate code
if (results.failed > 0) {
  console.log('\n❌ Integration test failed!');
  process.exit(1);
} else {
  console.log('\n🎉 All integration tests passed!');
  console.log('🚀 Fusion XBTC system is ready for use.');
  process.exit(0);
} 