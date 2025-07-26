#!/usr/bin/env ts-node

import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argsSchema = z.object({
  orderId: z.string(),
  amount: z.string(), // Total order amount in sats
  minFillAmount: z.string(), // Minimum fill amount in sats
  maxFillAmount: z.string(), // Maximum fill amount in sats (can be same as total amount)
  recipientAddress: z.string(),
  refundAddress: z.string(),
  locktime: z.string().default('3600'),
  network: z.string().default('testnet'),
  chain: z.string().default('bitcoin'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function main() {
  // Validate amounts
  const amount = parseInt(args.amount, 10);
  const minFillAmount = parseInt(args.minFillAmount, 10);
  const maxFillAmount = parseInt(args.maxFillAmount, 10);
  
  if (amount <= 0) {
    throw new Error('Order amount must be greater than 0');
  }
  
  if (minFillAmount <= 0) {
    throw new Error('Minimum fill amount must be greater than 0');
  }
  
  if (maxFillAmount <= 0) {
    throw new Error('Maximum fill amount must be greater than 0');
  }
  
  if (minFillAmount > maxFillAmount) {
    throw new Error('Minimum fill amount cannot be greater than maximum fill amount');
  }
  
  if (maxFillAmount > amount) {
    throw new Error('Maximum fill amount cannot be greater than total order amount');
  }
  
  // Generate secret and hashlock
  const secret = randomBytes(32);
  const hashlock = createHash('sha256').update(secret).digest();
  
  // Create order data
  const orderData = {
    orderId: args.orderId,
    amount: amount,
    remainingAmount: amount,
    minFillAmount: minFillAmount,
    maxFillAmount: maxFillAmount,
    recipientAddress: args.recipientAddress,
    refundAddress: args.refundAddress,
    secret: secret.toString('hex'),
    hashlock: '0x' + hashlock.toString('hex'),
    locktime: parseInt(args.locktime, 10),
    network: args.network,
    chain: args.chain,
    status: 'open',
    fills: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  // Ensure swaps directory exists
  const swapsDir = path.join(__dirname, '../examples/swaps');
  if (!fs.existsSync(swapsDir)) {
    fs.mkdirSync(swapsDir, { recursive: true });
  }
  
  // Save order to file
  const orderPath = path.join(swapsDir, `${args.orderId}.json`);
  fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2));
  
  // Output JSON result
  console.log(JSON.stringify({
    event: 'order-created',
    orderId: args.orderId,
    amount: amount,
    minFillAmount: minFillAmount,
    maxFillAmount: maxFillAmount,
    remainingAmount: amount,
    hashlock: orderData.hashlock,
    secret: orderData.secret,
    status: 'open',
    orderPath: orderPath,
  }, null, 2));
}

main().catch(console.error); 