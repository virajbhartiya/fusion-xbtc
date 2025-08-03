#!/usr/bin/env ts-node

import * as bitcoin from 'bitcoinjs-lib';
import { buildHTLCScript, getNetwork } from './htlc';
import { getBitcoinConfig } from './config';
import fs from 'fs';

async function main() {
  console.log('Setting up Bitcoin Testnet HTLC addresses...');

  // Use testnet network
  const network = bitcoin.networks.testnet;
  const config = getBitcoinConfig('testnet');
  
  console.log('Using Bitcoin RPC:', config.rpcUrl);
  
  // Generate sample keys (in production, these would be real keys)
  const recipientKeyPair = bitcoin.ECPair.makeRandom({ network });
  const refundKeyPair = bitcoin.ECPair.makeRandom({ network });
  
  // Sample hashlock (32 bytes)
  const hashlock = Buffer.from('12345678901234567890123456789012', 'hex');
  
  // Sample locktime (2 hours from now)
  const locktime = Math.floor(Date.now() / 1000) + 7200;
  
  // Build HTLC script
  const htlcPayment = buildHTLCScript({
    hashlock,
    recipientPubkey: recipientKeyPair.publicKey,
    refundPubkey: refundKeyPair.publicKey,
    locktime,
    network
  });
  
  console.log('Bitcoin Testnet HTLC Setup:');
  console.log('Network: Bitcoin Testnet');
  console.log('RPC URL:', config.rpcUrl);
  console.log('HTLC Address:', htlcPayment.address);
  console.log('Redeem Script (hex):', htlcPayment.redeem?.output?.toString('hex'));
  console.log('Recipient Public Key:', recipientKeyPair.publicKey.toString('hex'));
  console.log('Refund Public Key:', refundKeyPair.publicKey.toString('hex'));
  console.log('Hashlock:', hashlock.toString('hex'));
  console.log('Locktime:', locktime);
  
  // Save deployment info
  const deploymentInfo = {
    network: 'bitcoin-testnet',
    rpcUrl: config.rpcUrl,
    htlcAddress: htlcPayment.address,
    redeemScript: htlcPayment.redeem?.output?.toString('hex'),
    recipientPubkey: recipientKeyPair.publicKey.toString('hex'),
    refundPubkey: refundKeyPair.publicKey.toString('hex'),
    hashlock: hashlock.toString('hex'),
    locktime,
    deployedAt: new Date().toISOString()
  };
  
  // Save to file
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  
  console.log('\nDeployment info saved to deployment-info.json');
  console.log('Environment variables to set:');
  console.log(`BITCOIN_HTLC_ADDRESS=${htlcPayment.address}`);
  console.log(`BITCOIN_REDEEM_SCRIPT=${htlcPayment.redeem?.output?.toString('hex')}`);
  console.log(`BITCOIN_TESTNET_RPC_URL=${config.rpcUrl}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 