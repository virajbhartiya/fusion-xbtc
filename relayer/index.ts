#!/usr/bin/env ts-node

import { config as dotenvConfig } from 'dotenv';
import { BitcoinRelayer } from './bitcoin-relayer';
import { EthereumRelayer } from './ethereum-relayer';
import { OrderManager } from './order-manager';
import { Logger } from './logger';
import { EventProcessor } from './event-processor';
import { getConfig } from './config';
import path from 'path';

// Load environment variables from absolute path
dotenvConfig({ path: path.resolve(__dirname, '../.env') });
console.log('DEBUG ENV KEY:', process.env.ETHEREUM_PRIVATE_KEY);

const logger = new Logger('Relayer');

interface RelayerConfig {
  bitcoin: {
    network: 'mainnet' | 'testnet';
    electrumHost: string;
    electrumPort: number;
    electrumProto: 'ssl' | 'tcp';
    pollInterval: number;
  };
  ethereum: {
    network: 'mainnet' | 'sepolia' | 'goerli';
    rpcUrl: string;
    contractAddress: string;
    pollInterval: number;
    privateKey: string;
  };
  orders: {
    dataDir: string;
    backupInterval: number;
  };
  relayer: {
    secretKey: string;
    maxRetries: number;
    retryDelay: number;
  };
}

class Relayer {
  private bitcoinRelayer: BitcoinRelayer;
  private ethereumRelayer: EthereumRelayer;
  private orderManager: OrderManager;
  private eventProcessor: EventProcessor;
  private config: RelayerConfig;
  private isRunning = false;

  constructor(config: RelayerConfig) {
    this.config = config;
    this.orderManager = new OrderManager(config.orders.dataDir);
    
    // Create resolver configuration for event processor
    const resolverConfig = {
      bitcoin: {
        network: config.bitcoin.network,
        electrumHost: config.bitcoin.electrumHost,
        electrumPort: config.bitcoin.electrumPort,
        electrumProto: config.bitcoin.electrumProto,
      },
      ethereum: {
        network: config.ethereum.network,
        rpcUrl: config.ethereum.rpcUrl,
        contractAddress: config.ethereum.contractAddress,
        privateKey: config.ethereum.privateKey,
      },
    };
    
    this.eventProcessor = new EventProcessor(this.orderManager, resolverConfig);
    
    this.bitcoinRelayer = new BitcoinRelayer({
      network: config.bitcoin.network,
      electrumHost: config.bitcoin.electrumHost,
      electrumPort: config.bitcoin.electrumPort,
      electrumProto: config.bitcoin.electrumProto,
      pollInterval: config.bitcoin.pollInterval,
      eventProcessor: this.eventProcessor,
    });

    this.ethereumRelayer = new EthereumRelayer({
      network: config.ethereum.network,
      rpcUrl: config.ethereum.rpcUrl,
      contractAddress: config.ethereum.contractAddress,
      pollInterval: config.ethereum.pollInterval,
      eventProcessor: this.eventProcessor,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Relayer is already running');
      return;
    }

    logger.info('Starting Fusion XBTC Relayer...');
    
    try {
      // Initialize order manager
      await this.orderManager.initialize();
      logger.info('Order manager initialized');

      // Initialize event processor
      await this.eventProcessor.initialize();
      logger.info('Event processor initialized');

      // Start Bitcoin relayer
      await this.bitcoinRelayer.start();
      logger.info('Bitcoin relayer started');

      // Start Ethereum relayer
      await this.ethereumRelayer.start();
      logger.info('Ethereum relayer started');

      this.isRunning = true;
      logger.info('Relayer started successfully');

      // Set up graceful shutdown
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());

    } catch (error) {
      logger.error('Failed to start relayer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping relayer...');

    try {
      await this.bitcoinRelayer.stop();
      await this.ethereumRelayer.stop();
      await this.eventProcessor.cleanup();
      await this.orderManager.cleanup();
      
      this.isRunning = false;
      logger.info('Relayer stopped successfully');
    } catch (error) {
      logger.error('Error stopping relayer:', error);
    }
  }

  getStatus(): {
    isRunning: boolean;
    bitcoin: { isConnected: boolean; lastBlock: number };
    ethereum: { isConnected: boolean; lastBlock: number };
    orders: { total: number; open: number; processing: number };
    events: { processingEvents: number };
  } {
    return {
      isRunning: this.isRunning,
      bitcoin: this.bitcoinRelayer.getStatus(),
      ethereum: this.ethereumRelayer.getStatus(),
      orders: this.orderManager.getStatus(),
      events: this.eventProcessor.getProcessingStatus(),
    };
  }
}

// Main execution
async function main() {
  const config = getConfig('development');
  console.log('DEBUG CONFIG KEY:', config.ethereum.privateKey);

  // Validate required configuration
  if (!config.ethereum.privateKey) {
    logger.error('ETHEREUM_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  const relayer = new Relayer(config);

  try {
    await relayer.start();
    
    // Log status every 5 minutes
    setInterval(() => {
      const status = relayer.getStatus();
      logger.info('Relayer status:', status);
    }, 5 * 60 * 1000);

  } catch (error) {
    logger.error('Failed to start relayer:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { Relayer, RelayerConfig }; 