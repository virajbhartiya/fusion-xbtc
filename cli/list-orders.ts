#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argsSchema = {
  status: process.argv.includes('--status') ? process.argv[process.argv.indexOf('--status') + 1] : undefined,
  orderId: process.argv.includes('--orderId') ? process.argv[process.argv.indexOf('--orderId') + 1] : undefined,
  format: process.argv.includes('--format') ? process.argv[process.argv.indexOf('--format') + 1] : 'table',
};

async function main() {
  const swapsDir = path.join(__dirname, '../examples/swaps');
  
  if (!fs.existsSync(swapsDir)) {
    console.log('No orders found. Swaps directory does not exist.');
    return;
  }
  
  const files = fs.readdirSync(swapsDir);
  const orderFiles = files.filter(file => file.endsWith('.json') && !file.startsWith('fill-'));
  
  if (orderFiles.length === 0) {
    console.log('No orders found.');
    return;
  }
  
  const orders = [];
  
  for (const file of orderFiles) {
    try {
      const orderPath = path.join(swapsDir, file);
      const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
      
      // Filter by status if specified
      if (argsSchema.status && orderData.status !== argsSchema.status) {
        continue;
      }
      
      // Filter by order ID if specified
      if (argsSchema.orderId && orderData.orderId !== argsSchema.orderId) {
        continue;
      }
      
      orders.push(orderData);
    } catch (error) {
      console.warn(`Error reading order file ${file}:`, error.message);
    }
  }
  
  if (orders.length === 0) {
    console.log('No orders match the specified criteria.');
    return;
  }
  
  // Sort orders by creation time (newest first)
  orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  if (argsSchema.format === 'json') {
    console.log(JSON.stringify(orders, null, 2));
    return;
  }
  
  // Display as table
  console.log('\n=== HTLC Orders ===\n');
  
  for (const order of orders) {
    console.log(`Order ID: ${order.orderId}`);
    console.log(`Status: ${order.status}`);
    console.log(`Total Amount: ${order.amount} sats`);
    console.log(`Remaining Amount: ${order.remainingAmount || order.amount} sats`);
    console.log(`Min Fill: ${order.minFillAmount} sats`);
    console.log(`Max Fill: ${order.maxFillAmount} sats`);
    console.log(`Recipient: ${order.recipientAddress}`);
    console.log(`Refund: ${order.refundAddress}`);
    console.log(`Hashlock: ${order.hashlock}`);
    console.log(`Created: ${new Date(order.createdAt).toISOString()}`);
    console.log(`Updated: ${new Date(order.updatedAt).toISOString()}`);
    
    if (order.fills && order.fills.length > 0) {
      console.log(`\nFills (${order.fills.length}):`);
      for (const fill of order.fills) {
        console.log(`  - ${fill.fillId}: ${fill.amount} sats (${fill.txid})`);
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
  
  // Summary
  const openOrders = orders.filter(o => o.status === 'open');
  const partialOrders = orders.filter(o => o.status === 'partial');
  const filledOrders = orders.filter(o => o.status === 'filled');
  
  console.log('Summary:');
  console.log(`- Open orders: ${openOrders.length}`);
  console.log(`- Partial orders: ${partialOrders.length}`);
  console.log(`- Filled orders: ${filledOrders.length}`);
  console.log(`- Total orders: ${orders.length}`);
}

main().catch(console.error); 