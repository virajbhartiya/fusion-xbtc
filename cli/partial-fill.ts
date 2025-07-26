#!/usr/bin/env ts-node

import { z } from 'zod';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import { buildHTLCScript, getNetwork } from '../btc-scripts/htlc.ts';
import { buildLockTx } from '../btc-scripts/tx-builder.ts';
import ElectrumClient from 'electrum-client';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ECPair = ECPairFactory(tinysecp);

const argsSchema = z.object({
  orderId: z.string(),
  fillAmount: z.string(), // Amount to fill (in sats)
  maxFillAmount: z.string(), // Maximum amount that can be filled
  recipientPubkey: z.string(),
  refundPubkey: z.string(),
  locktime: z.string(),
  network: z.string().default('testnet'),
  chain: z.string().default('bitcoin'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

const network = args.network === 'testnet' 
  ? bitcoin.networks.testnet 
  : getNetwork(args.chain as 'bitcoin' | 'litecoin' | 'dogecoin' | 'bch');

const extendedArgsSchema = argsSchema.extend({
  utxos: z.string(), // JSON stringified array of UTXOs
  changeAddress: z.string(),
  feeSats: z.string(),
  electrumHost: z.string(),
  electrumPort: z.string(),
  electrumProto: z.string().default('ssl'),
});

const fullArgs = extendedArgsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function main() {
  console.log('Starting partial fill for order:', args.orderId);
  console.log('Fill amount:', args.fillAmount, 'sats');
  console.log('Max fill amount:', args.maxFillAmount, 'sats');
  
  // Validate fill amount
  const fillAmount = parseInt(args.fillAmount, 10);
  const maxFillAmount = parseInt(args.maxFillAmount, 10);
  
  if (fillAmount > maxFillAmount) {
    throw new Error(`Fill amount ${fillAmount} exceeds maximum fill amount ${maxFillAmount}`);
  }
  
  if (fillAmount <= 0) {
    throw new Error('Fill amount must be greater than 0');
  }
  
  // Load order details from file
  const orderPath = path.join(__dirname, '../examples/swaps', `${args.orderId}.json`);
  if (!fs.existsSync(orderPath)) {
    throw new Error(`Order ${args.orderId} not found`);
  }
  
  const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
  console.log('Order details loaded:', {
    orderId: orderData.orderId,
    originalAmount: orderData.amount,
    remainingAmount: orderData.remainingAmount || orderData.amount,
    status: orderData.status
  });
  
  // Check if order can be filled
  if (orderData.status !== 'open') {
    throw new Error(`Order ${args.orderId} is not open for fills (status: ${orderData.status})`);
  }
  
  const remainingAmount = orderData.remainingAmount || orderData.amount;
  if (fillAmount > remainingAmount) {
    throw new Error(`Fill amount ${fillAmount} exceeds remaining amount ${remainingAmount}`);
  }
  
  // Generate hashlock for this partial fill
  const hashlock = Buffer.from(orderData.hashlock.replace(/^0x/, ''), 'hex');
  
  // Build HTLC script
  const recipientPubkey = Buffer.from(args.recipientPubkey, 'hex');
  const refundPubkey = Buffer.from(args.refundPubkey, 'hex');
  const locktime = parseInt(args.locktime, 10);
  const htlc = buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime, network });
  
  console.log('HTLC address:', htlc.address);
  
  // Process UTXOs
  const utxos = JSON.parse(fullArgs.utxos).map((u: any) => ({
    txid: u.txid,
    vout: u.vout,
    value: u.amount,
    keyPair: ECPair.fromWIF(u.wif, network)
  }));
  console.log('UTXOs processed:', utxos.length);
  
  // Build transaction
  const psbt = buildLockTx({
    utxos,
    htlcAddress: htlc.address!,
    amountSats: fillAmount,
    changeAddress: fullArgs.changeAddress,
    feeSats: parseInt(fullArgs.feeSats, 10),
    network
  });
  console.log('PSBT built successfully');
  
  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  console.log('Transaction hex generated:', txHex.substring(0, 100) + '...');
  console.log('Full transaction hex:', txHex);
  
  let txid: string;
  try {
    const client = new ElectrumClient(
      parseInt(fullArgs.electrumPort, 10),
      fullArgs.electrumHost,
      fullArgs.electrumProto
    );
    console.log('Connecting to Electrum server...');
    await (client as any).connect();
    console.log('Broadcasting transaction...');
    txid = await client.blockchainTransaction_broadcast(txHex);
    await (client as any).close();
    console.log('Transaction broadcasted successfully:', txid);
  } catch (error) {
    console.log('Failed to broadcast transaction via Electrum server:', error.message);
    console.log('You can manually broadcast the transaction hex above using a Bitcoin testnet explorer or wallet.');
    console.log('Transaction hex for manual broadcast:', txHex);
    process.exit(1);
  }
  
  // Update order with partial fill
  const newRemainingAmount = remainingAmount - fillAmount;
  const newStatus = newRemainingAmount === 0 ? 'filled' : 'partial';
  
  const updatedOrderData = {
    ...orderData,
    remainingAmount: newRemainingAmount,
    status: newStatus,
    fills: [
      ...(orderData.fills || []),
      {
        fillId: `${args.orderId}-${Date.now()}`,
        amount: fillAmount,
        txid: txid,
        timestamp: Date.now(),
        htlcAddress: htlc.address,
        redeemScript: htlc.redeem?.output?.toString('hex') || htlc.output?.toString('hex'),
      }
    ]
  };
  
  // Save updated order
  fs.writeFileSync(orderPath, JSON.stringify(updatedOrderData, null, 2));
  
  // Create fill log
  const fillLogPath = path.join(__dirname, '../examples/swaps', `fill-${args.orderId}-${Date.now()}.json`);
  const fillLogData = {
    fillId: `${args.orderId}-${Date.now()}`,
    orderId: args.orderId,
    amount: fillAmount,
    txid: txid,
    htlcAddress: htlc.address,
    redeemScript: htlc.redeem?.output?.toString('hex') || htlc.output?.toString('hex'),
    status: 'broadcasted',
    timestamp: Date.now(),
    remainingAmount: newRemainingAmount,
    orderStatus: newStatus,
  };
  
  fs.writeFileSync(fillLogPath, JSON.stringify(fillLogData, null, 2));
  
  console.log(JSON.stringify({
    event: 'partial-fill',
    orderId: args.orderId,
    fillId: fillLogData.fillId,
    amount: fillAmount,
    txid: txid,
    htlcAddress: htlc.address,
    redeemScript: htlc.redeem?.output?.toString('hex') || htlc.output?.toString('hex'),
    status: 'broadcasted',
    remainingAmount: newRemainingAmount,
    orderStatus: newStatus,
  }, null, 2));
}

main().catch(console.error); 