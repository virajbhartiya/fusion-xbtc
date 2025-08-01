#!/usr/bin/env ts-node

import { z } from 'zod';
import { ethers } from 'ethers';
import { randomBytes, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fusion+ HTLC contract ABI (minimal for CLI operations)
const FUSION_HTLC_ABI = [
  "function createFusionOrder(bytes32 orderId, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock, bytes32 hashlock) external payable",
  "function matchFusionOrder(bytes32 orderId, bytes32 secret) external payable",
  "function cancelFusionOrder(bytes32 orderId) external",
  "function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)",
  "function isOrderActive(bytes32 orderId) external view returns (bool)",
  "function getActiveOrderIds() external view returns (bytes32[])",
  "event FusionOrderCreated(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed maker, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock)",
  "event FusionOrderMatched(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed taker, uint256 executedAmount)",
  "event FusionOrderCancelled(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed maker)"
];

const argsSchema = z.object({
  command: z.enum(['create', 'match', 'cancel', 'status', 'list']),
  direction: z.enum(['eth2btc', 'btc2eth']).optional(),
  ethAmount: z.string().optional(),
  btcAmount: z.string().optional(),
  ethAddress: z.string().optional(),
  btcAddress: z.string().optional(),
  orderId: z.string().optional(),
  secret: z.string().optional(),
  timelock: z.string().default('3600'),
  contractAddress: z.string().optional(),
  rpcUrl: z.string().default('https://eth-goerli.g.alchemy.com/v2/your-api-key'),
  privateKey: z.string().optional(),
});

async function main() {
  const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v];
  })));

  const provider = new ethers.JsonRpcProvider(args.rpcUrl);
  const wallet = args.privateKey ? new ethers.Wallet(args.privateKey, provider) : null;
  
  if (!wallet) {
    throw new Error('Private key is required for Fusion+ operations');
  }

  const contractAddress = args.contractAddress || process.env.FUSION_HTLC_ADDRESS;
  if (!contractAddress) {
    throw new Error('Contract address is required (set FUSION_HTLC_ADDRESS env var or --contractAddress)');
  }

  const contract = new ethers.Contract(contractAddress, FUSION_HTLC_ABI, wallet);

  switch (args.command) {
    case 'create':
      await createFusionOrder(contract, args);
      break;
    case 'match':
      await matchFusionOrder(contract, args);
      break;
    case 'cancel':
      await cancelFusionOrder(contract, args);
      break;
    case 'status':
      await getOrderStatus(contract, args);
      break;
    case 'list':
      await listActiveOrders(contract);
      break;
    default:
      console.log(`
Usage:
  fusion-swap create --direction=eth2btc --ethAmount=0.01 --btcAmount=0.001 --ethAddress=0x... --btcAddress=bc1... --timelock=3600
  fusion-swap match --orderId=0x... --secret=0x... --ethAmount=0.01
  fusion-swap cancel --orderId=0x...
  fusion-swap status --orderId=0x...
  fusion-swap list
      `);
  }
}

async function createFusionOrder(contract: ethers.Contract, args: any) {
  if (!args.direction || !args.ethAmount || !args.btcAmount || !args.ethAddress || !args.btcAddress) {
    throw new Error('Missing required parameters for order creation');
  }

  const orderId = ethers.keccak256(ethers.toUtf8Bytes(`fusion-${Date.now()}-${Math.random()}`));
  const secret = randomBytes(32);
  const hashlock = ethers.keccak256(secret);
  const timelock = Math.floor(Date.now() / 1000) + parseInt(args.timelock);
  
  const ethAmount = ethers.parseEther(args.ethAmount);
  const btcAmount = ethers.parseEther(args.btcAmount);

  const makerAsset = args.direction === 'eth2btc' ? 'ETH' : 'BTC';
  const takerAsset = args.direction === 'eth2btc' ? 'BTC' : 'ETH';
  const makerAmount = args.direction === 'eth2btc' ? ethAmount : btcAmount;
  const takerAmount = args.direction === 'eth2btc' ? btcAmount : ethAmount;

  console.log('Creating Fusion+ order...');
  console.log(`Order ID: ${orderId}`);
  console.log(`Direction: ${args.direction}`);
  console.log(`Maker Asset: ${makerAsset}`);
  console.log(`Taker Asset: ${takerAsset}`);
  console.log(`Maker Amount: ${ethers.formatEther(makerAmount)} ${makerAsset}`);
  console.log(`Taker Amount: ${ethers.formatEther(takerAmount)} ${takerAsset}`);
  console.log(`Hashlock: ${hashlock}`);
  console.log(`Secret: ${secret.toString('hex')}`);
  console.log(`Timelock: ${new Date(timelock * 1000).toISOString()}`);

  try {
    const tx = await contract.createFusionOrder(
      orderId,
      makerAsset,
      takerAsset,
      makerAmount,
      takerAmount,
      timelock,
      hashlock,
      { value: makerAmount }
    );

    console.log(`Transaction hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`Order created successfully! Block: ${receipt.blockNumber}`);

    // Save order details
    const orderData = {
      orderId: orderId,
      direction: args.direction,
      makerAsset,
      takerAsset,
      makerAmount: ethers.formatEther(makerAmount),
      takerAmount: ethers.formatEther(takerAmount),
      ethAddress: args.ethAddress,
      btcAddress: args.btcAddress,
      hashlock,
      secret: secret.toString('hex'),
      timelock,
      status: 'active',
      createdAt: Date.now(),
      txHash: tx.hash,
    };

    const swapsDir = path.join(__dirname, '../examples/fusion-swaps');
    if (!fs.existsSync(swapsDir)) {
      fs.mkdirSync(swapsDir, { recursive: true });
    }

    const orderPath = path.join(swapsDir, `${orderId}.json`);
    fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2));

    console.log(`Order details saved to: ${orderPath}`);
    console.log(JSON.stringify({ success: true, orderId, txHash: tx.hash }, null, 2));

  } catch (error) {
    console.error('Error creating Fusion+ order:', error);
    throw error;
  }
}

async function matchFusionOrder(contract: ethers.Contract, args: any) {
  if (!args.orderId || !args.secret || !args.ethAmount) {
    throw new Error('Missing required parameters for order matching');
  }

  const orderId = args.orderId;
  const secret = args.secret;
  const ethAmount = ethers.parseEther(args.ethAmount);

  console.log('Matching Fusion+ order...');
  console.log(`Order ID: ${orderId}`);
  console.log(`Secret: ${secret}`);
  console.log(`ETH Amount: ${ethers.formatEther(ethAmount)} ETH`);

  try {
    const tx = await contract.matchFusionOrder(orderId, secret, { value: ethAmount });
    
    console.log(`Transaction hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`Order matched successfully! Block: ${receipt.blockNumber}`);

    console.log(JSON.stringify({ success: true, orderId, txHash: tx.hash }, null, 2));

  } catch (error) {
    console.error('Error matching Fusion+ order:', error);
    throw error;
  }
}

async function cancelFusionOrder(contract: ethers.Contract, args: any) {
  if (!args.orderId) {
    throw new Error('Order ID is required for cancellation');
  }

  const orderId = args.orderId;

  console.log('Cancelling Fusion+ order...');
  console.log(`Order ID: ${orderId}`);

  try {
    const tx = await contract.cancelFusionOrder(orderId);
    
    console.log(`Transaction hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`Order cancelled successfully! Block: ${receipt.blockNumber}`);

    console.log(JSON.stringify({ success: true, orderId, txHash: tx.hash }, null, 2));

  } catch (error) {
    console.error('Error cancelling Fusion+ order:', error);
    throw error;
  }
}

async function getOrderStatus(contract: ethers.Contract, args: any) {
  if (!args.orderId) {
    throw new Error('Order ID is required for status check');
  }

  const orderId = args.orderId;

  try {
    const order = await contract.getFusionOrder(orderId);
    const isActive = await contract.isOrderActive(orderId);

    const orderData = {
      orderId: order[0],
      maker: order[1],
      makerAsset: order[2],
      takerAsset: order[3],
      makerAmount: ethers.formatEther(order[4]),
      takerAmount: ethers.formatEther(order[5]),
      timelock: new Date(order[6] * 1000).toISOString(),
      hashlock: order[7],
      isActive: order[8],
      isMatched: order[9],
      createdAt: new Date(order[10] * 1000).toISOString(),
      currentStatus: isActive ? 'active' : 'inactive'
    };

    console.log(JSON.stringify(orderData, null, 2));

  } catch (error) {
    console.error('Error getting order status:', error);
    throw error;
  }
}

async function listActiveOrders(contract: ethers.Contract) {
  try {
    const activeOrderIds = await contract.getActiveOrderIds();
    
    console.log(`Found ${activeOrderIds.length} active orders:`);
    
    for (const orderId of activeOrderIds) {
      const order = await contract.getFusionOrder(orderId);
      const isActive = await contract.isOrderActive(orderId);
      
      console.log(`\nOrder ID: ${orderId}`);
      console.log(`Maker: ${order[1]}`);
      console.log(`Maker Asset: ${order[2]}`);
      console.log(`Taker Asset: ${order[3]}`);
      console.log(`Maker Amount: ${ethers.formatEther(order[4])}`);
      console.log(`Taker Amount: ${ethers.formatEther(order[5])}`);
      console.log(`Status: ${isActive ? 'Active' : 'Inactive'}`);
      console.log(`Created: ${new Date(order[10] * 1000).toISOString()}`);
    }

  } catch (error) {
    console.error('Error listing active orders:', error);
    throw error;
  }
}

main().catch(console.error); 