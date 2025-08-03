#!/usr/bin/env ts-node

import { z } from 'zod';
import { ethers } from 'ethers';
import axios from 'axios';
import { randomBytes, createHash } from 'crypto';

// Fusion+ API configuration
const FUSION_API_BASE_URL = process.env.FUSION_API_BASE_URL || 'https://fusion.1inch.io';
const FUSION_API_KEY = process.env.FUSION_API_KEY;

// Types for Fusion+ integration
const FusionOrderSchema = z.object({
  orderId: z.string(),
  makerAsset: z.string(),
  takerAsset: z.string(),
  makerAmount: z.string(),
  takerAmount: z.string(),
  makerAddress: z.string(),
  takerAddress: z.string(),
  hashlock: z.string(),
  timelock: z.number(),
  secret: z.string(),
  status: z.enum(['open', 'filled', 'cancelled', 'expired']),
  createdAt: z.number(),
  updatedAt: z.number(),
  txHash: z.string().optional(),
  blockNumber: z.number().optional(),
});

const CrossChainSwapSchema = z.object({
  swapId: z.string(),
  direction: z.enum(['eth2btc', 'btc2eth']),
  ethAmount: z.string(),
  btcAmount: z.string(),
  ethAddress: z.string(),
  btcAddress: z.string(),
  fusionOrderId: z.string(),
  htlcHashlock: z.string(),
  htlcSecret: z.string(),
  htlcTimelock: z.number(),
  status: z.enum(['pending', 'locked', 'redeemed', 'refunded']),
  createdAt: z.number(),
  updatedAt: z.number(),
});

type FusionOrder = z.infer<typeof FusionOrderSchema>;
type CrossChainSwap = z.infer<typeof CrossChainSwapSchema>;

export class FusionPlusIntegration {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(privateKey: string, rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * Create a Fusion+ order for cross-chain swap
   */
  async createFusionOrder(params: {
    direction: 'eth2btc' | 'btc2eth';
    ethAmount: string;
    btcAmount: string;
    ethAddress: string;
    btcAddress: string;
    timelock?: number;
  }): Promise<FusionOrder> {
    if (!FUSION_API_KEY) {
      throw new Error('FUSION_API_KEY environment variable is required');
    }

    const secret = randomBytes(32);
    const hashlock = createHash('sha256').update(secret).digest('hex');
    const timelock = params.timelock || Math.floor(Date.now() / 1000) + 3600; // 1 hour default
    const orderId = ethers.keccak256(ethers.toUtf8Bytes(`fusion-${Date.now()}-${Math.random()}`));

    const orderData = {
      orderId: orderId,
      makerAsset: params.direction === 'eth2btc' ? 'ETH' : 'BTC',
      takerAsset: params.direction === 'eth2btc' ? 'BTC' : 'ETH',
      makerAmount: params.direction === 'eth2btc' ? params.ethAmount : params.btcAmount,
      takerAmount: params.direction === 'eth2btc' ? params.btcAmount : params.ethAmount,
      makerAddress: params.direction === 'eth2btc' ? params.ethAddress : params.btcAddress,
      takerAddress: params.direction === 'eth2btc' ? params.btcAddress : params.ethAddress,
      hashlock: `0x${hashlock}`,
      timelock,
      secret: secret.toString('hex'),
      status: 'open' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create Fusion+ order via real blockchain contract
    try {
      const contractAddress = process.env.FUSION_HTLC_ADDRESS;
      if (!contractAddress) {
        throw new Error('FUSION_HTLC_ADDRESS environment variable is required');
      }

      const contract = new ethers.Contract(contractAddress, [
        "function createFusionOrder(bytes32 orderId, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock, bytes32 hashlock) external payable"
      ], this.wallet);

      const ethAmount = ethers.parseEther(params.ethAmount);
      const btcAmount = ethers.parseEther(params.btcAmount);
      
      const makerAmount = params.direction === 'eth2btc' ? ethAmount : btcAmount;
      const takerAmount = params.direction === 'eth2btc' ? btcAmount : ethAmount;

      const tx = await contract.createFusionOrder(
        orderId,
        orderData.makerAsset,
        orderData.takerAsset,
        makerAmount,
        takerAmount,
        timelock,
        `0x${hashlock}`,
        { value: makerAmount }
      );

      const receipt = await tx.wait();

      return {
        ...orderData,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error creating Fusion+ order:', error);
      throw error;
    }
  }

  /**
   * Create a cross-chain swap that integrates Fusion+ with HTLC
   */
  async createCrossChainSwap(params: {
    direction: 'eth2btc' | 'btc2eth';
    ethAmount: string;
    btcAmount: string;
    ethAddress: string;
    btcAddress: string;
    timelock?: number;
  }): Promise<CrossChainSwap> {
    // Create Fusion+ order first
    const fusionOrder = await this.createFusionOrder(params);

    // Create cross-chain swap record
    const swapData: CrossChainSwap = {
      swapId: ethers.keccak256(ethers.toUtf8Bytes(`swap-${Date.now()}-${Math.random()}`)),
      direction: params.direction,
      ethAmount: params.ethAmount,
      btcAmount: params.btcAmount,
      ethAddress: params.ethAddress,
      btcAddress: params.btcAddress,
      fusionOrderId: fusionOrder.orderId,
      htlcHashlock: fusionOrder.hashlock,
      htlcSecret: fusionOrder.secret,
      htlcTimelock: fusionOrder.timelock,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return CrossChainSwapSchema.parse(swapData);
  }

  /**
   * Get Fusion+ order status
   */
  async getFusionOrderStatus(orderId: string): Promise<FusionOrder> {
    if (!FUSION_API_KEY) {
      throw new Error('FUSION_API_KEY environment variable is required');
    }

    try {
      const response = await axios.get(`${FUSION_API_BASE_URL}/api/v1/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${FUSION_API_KEY}`,
        },
      });

      if (response.status !== 200) {
        throw new Error(`Failed to get Fusion+ order: ${response.statusText}`);
      }

      return FusionOrderSchema.parse(response.data);
    } catch (error) {
      console.error('Error getting Fusion+ order:', error);
      throw error;
    }
  }

  /**
   * Execute a Fusion+ order (when matched)
   */
  async executeFusionOrder(orderId: string, secret: string): Promise<boolean> {
    if (!FUSION_API_KEY) {
      throw new Error('FUSION_API_KEY environment variable is required');
    }

    try {
      const response = await axios.post(`${FUSION_API_BASE_URL}/api/v1/orders/${orderId}/execute`, {
        secret,
        apiKey: FUSION_API_KEY,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to execute Fusion+ order: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error executing Fusion+ order:', error);
      throw error;
    }
  }

  /**
   * Cancel a Fusion+ order
   */
  async cancelFusionOrder(orderId: string): Promise<boolean> {
    if (!FUSION_API_KEY) {
      throw new Error('FUSION_API_KEY environment variable is required');
    }

    try {
      const response = await axios.post(`${FUSION_API_BASE_URL}/api/v1/orders/${orderId}/cancel`, {
        apiKey: FUSION_API_KEY,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to cancel Fusion+ order: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error cancelling Fusion+ order:', error);
      throw error;
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  const fusion = new FusionPlusIntegration(
    process.env.PRIVATE_KEY || '',
    process.env.RPC_URL || 'https://eth-goerli.g.alchemy.com/v2/your-api-key'
  );

  switch (command) {
    case 'create-order':
      const orderParams = {
        direction: args[1] as 'eth2btc' | 'btc2eth',
        ethAmount: args[2],
        btcAmount: args[3],
        ethAddress: args[4],
        btcAddress: args[5],
        timelock: args[6] ? parseInt(args[6]) : undefined,
      };
      
      fusion.createFusionOrder(orderParams)
        .then(order => console.log(JSON.stringify(order, null, 2)))
        .catch(console.error);
      break;

    case 'create-swap':
      const swapParams = {
        direction: args[1] as 'eth2btc' | 'btc2eth',
        ethAmount: args[2],
        btcAmount: args[3],
        ethAddress: args[4],
        btcAddress: args[5],
        timelock: args[6] ? parseInt(args[6]) : undefined,
      };
      
      fusion.createCrossChainSwap(swapParams)
        .then(swap => console.log(JSON.stringify(swap, null, 2)))
        .catch(console.error);
      break;

    case 'get-order':
      fusion.getFusionOrderStatus(args[1])
        .then(order => console.log(JSON.stringify(order, null, 2)))
        .catch(console.error);
      break;

    case 'execute-order':
      fusion.executeFusionOrder(args[1], args[2])
        .then(result => console.log(JSON.stringify({ success: result }, null, 2)))
        .catch(console.error);
      break;

    case 'cancel-order':
      fusion.cancelFusionOrder(args[1])
        .then(result => console.log(JSON.stringify({ success: result }, null, 2)))
        .catch(console.error);
      break;

    default:
      console.log(`
Usage:
  create-order <direction> <ethAmount> <btcAmount> <ethAddress> <btcAddress> [timelock]
  create-swap <direction> <ethAmount> <btcAmount> <ethAddress> <btcAddress> [timelock]
  get-order <orderId>
  execute-order <orderId> <secret>
  cancel-order <orderId>
      `);
  }
} 