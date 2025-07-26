import { Logger } from './logger';
import { OrderManager } from './order-manager';
import { BitcoinResolver } from './bitcoin-resolver';
import { EthereumResolver } from './ethereum-resolver';

interface HTLCEvent {
  type: 'lock' | 'redeem' | 'refund';
  txHash: string;
  blockNumber?: number;
  blockHeight?: number;
  timestamp: number;
  hashlock: string;
  amount: string | number;
  sender?: string;
  recipient?: string;
  address?: string;
  secret?: string;
  redeemScript?: string;
}

interface CrossChainAction {
  type: 'redeem' | 'refund';
  chain: 'bitcoin' | 'ethereum';
  hashlock: string;
  secret?: string;
  orderId: string;
  priority: 'high' | 'medium' | 'low';
}

interface ResolverConfig {
  bitcoin: {
    network: 'mainnet' | 'testnet';
    electrumHost: string;
    electrumPort: number;
    electrumProto: 'ssl' | 'tcp';
  };
  ethereum: {
    network: 'mainnet' | 'sepolia' | 'goerli';
    rpcUrl: string;
    contractAddress: string;
    privateKey: string;
  };
}

export class EventProcessor {
  private logger: Logger;
  private orderManager: OrderManager;
  private bitcoinResolver: BitcoinResolver;
  private ethereumResolver: EthereumResolver;
  private processingEvents = new Set<string>(); // Track events being processed
  private config: ResolverConfig;

  constructor(orderManager: OrderManager, config: ResolverConfig) {
    this.logger = new Logger('EventProcessor');
    this.orderManager = orderManager;
    this.config = config;
    this.bitcoinResolver = new BitcoinResolver();
    this.ethereumResolver = new EthereumResolver();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Bitcoin resolver
      await this.bitcoinResolver.initialize(
        this.config.bitcoin.electrumHost,
        this.config.bitcoin.electrumPort,
        this.config.bitcoin.electrumProto
      );
      this.bitcoinResolver.setNetwork(this.config.bitcoin.network);

      // Initialize Ethereum resolver
      this.ethereumResolver.initialize(
        this.config.ethereum.rpcUrl,
        this.config.ethereum.contractAddress,
        this.config.ethereum.privateKey
      );

      this.logger.info('Event processor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize event processor:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.bitcoinResolver.cleanup();
      this.logger.info('Event processor cleanup completed');
    } catch (error) {
      this.logger.error('Error during event processor cleanup:', error);
    }
  }

  async processBitcoinEvent(event: HTLCEvent): Promise<void> {
    const eventKey = `btc-${event.txHash}-${event.type}`;
    
    if (this.processingEvents.has(eventKey)) {
      this.logger.debug(`Event ${eventKey} already being processed`);
      return;
    }

    this.processingEvents.add(eventKey);
    
    try {
      this.logger.info(`Processing Bitcoin ${event.type} event:`, {
        txHash: event.txHash,
        hashlock: event.hashlock,
        amount: event.amount,
        address: event.address,
      });

      switch (event.type) {
        case 'lock':
          await this.handleBitcoinLock(event);
          break;
        case 'redeem':
          await this.handleBitcoinRedeem(event);
          break;
        case 'refund':
          await this.handleBitcoinRefund(event);
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing Bitcoin ${event.type} event:`, error);
    } finally {
      this.processingEvents.delete(eventKey);
    }
  }

  async processEthereumEvent(event: HTLCEvent): Promise<void> {
    const eventKey = `eth-${event.txHash}-${event.type}`;
    
    if (this.processingEvents.has(eventKey)) {
      this.logger.debug(`Event ${eventKey} already being processed`);
      return;
    }

    this.processingEvents.add(eventKey);
    
    try {
      this.logger.info(`Processing Ethereum ${event.type} event:`, {
        txHash: event.txHash,
        hashlock: event.hashlock,
        amount: event.amount,
        sender: event.sender,
        recipient: event.recipient,
      });

      switch (event.type) {
        case 'lock':
          await this.handleEthereumLock(event);
          break;
        case 'redeem':
          await this.handleEthereumRedeem(event);
          break;
        case 'refund':
          await this.handleEthereumRefund(event);
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing Ethereum ${event.type} event:`, error);
    } finally {
      this.processingEvents.delete(eventKey);
    }
  }

  private async handleBitcoinLock(event: HTLCEvent): Promise<void> {
    try {
      // Find orders that match this hashlock
      const orders = await this.orderManager.findOrdersByHashlock(event.hashlock);
      
      if (orders.length === 0) {
        this.logger.debug(`No orders found for Bitcoin lock with hashlock: ${event.hashlock}`);
        return;
      }

      for (const order of orders) {
        // Update order with Bitcoin lock information
        await this.orderManager.updateOrderStatus(order.orderId, {
          btcLockTx: event.txHash,
          btcLockBlock: event.blockHeight,
          btcLockTimestamp: event.timestamp,
          btcLockAmount: typeof event.amount === 'string' ? parseInt(event.amount, 10) : event.amount,
          btcLockAddress: event.address,
          status: 'btc_locked',
        });

        this.logger.info(`Updated order ${order.orderId} with Bitcoin lock: ${event.txHash}`);

        // Check if we need to trigger Ethereum lock
        if (order.status === 'open' || order.status === 'partial') {
          await this.triggerEthereumLock(order, event);
        }
      }
    } catch (error) {
      this.logger.error('Error handling Bitcoin lock:', error);
    }
  }

  private async handleBitcoinRedeem(event: HTLCEvent): Promise<void> {
    try {
      if (!event.secret) {
        this.logger.warn('Bitcoin redeem event missing secret');
        return;
      }

      const orders = await this.orderManager.findOrdersByHashlock(event.hashlock);
      
      for (const order of orders) {
        // Update order with Bitcoin redeem information
        await this.orderManager.updateOrderStatus(order.orderId, {
          btcRedeemTx: event.txHash,
          btcRedeemBlock: event.blockHeight,
          btcRedeemTimestamp: event.timestamp,
          btcRedeemSecret: event.secret,
          status: 'btc_redeemed',
        });

        this.logger.info(`Updated order ${order.orderId} with Bitcoin redeem: ${event.txHash}`);

        // Trigger Ethereum redeem with the secret
        await this.triggerEthereumRedeem(order, event.secret);
      }
    } catch (error) {
      this.logger.error('Error handling Bitcoin redeem:', error);
    }
  }

  private async handleBitcoinRefund(event: HTLCEvent): Promise<void> {
    try {
      const orders = await this.orderManager.findOrdersByHashlock(event.hashlock);
      
      for (const order of orders) {
        // Update order with Bitcoin refund information
        await this.orderManager.updateOrderStatus(order.orderId, {
          btcRefundTx: event.txHash,
          btcRefundBlock: event.blockHeight,
          btcRefundTimestamp: event.timestamp,
          status: 'btc_refunded',
        });

        this.logger.info(`Updated order ${order.orderId} with Bitcoin refund: ${event.txHash}`);
      }
    } catch (error) {
      this.logger.error('Error handling Bitcoin refund:', error);
    }
  }

  private async handleEthereumLock(event: HTLCEvent): Promise<void> {
    try {
      const orders = await this.orderManager.findOrdersByHashlock(event.hashlock);
      
      for (const order of orders) {
        // Update order with Ethereum lock information
        await this.orderManager.updateOrderStatus(order.orderId, {
          ethLockTx: event.txHash,
          ethLockBlock: event.blockNumber,
          ethLockTimestamp: event.timestamp,
          ethLockAmount: typeof event.amount === 'string' ? event.amount : event.amount.toString(),
          ethLockSender: event.sender,
          ethLockRecipient: event.recipient,
          status: 'eth_locked',
        });

        this.logger.info(`Updated order ${order.orderId} with Ethereum lock: ${event.txHash}`);

        // Check if we need to trigger Bitcoin lock
        if (order.status === 'open' || order.status === 'partial') {
          await this.triggerBitcoinLock(order, event);
        }
      }
    } catch (error) {
      this.logger.error('Error handling Ethereum lock:', error);
    }
  }

  private async handleEthereumRedeem(event: HTLCEvent): Promise<void> {
    try {
      if (!event.secret) {
        this.logger.warn('Ethereum redeem event missing secret');
        return;
      }

      const orders = await this.orderManager.findOrdersByHashlock(event.hashlock);
      
      for (const order of orders) {
        // Update order with Ethereum redeem information
        await this.orderManager.updateOrderStatus(order.orderId, {
          ethRedeemTx: event.txHash,
          ethRedeemBlock: event.blockNumber,
          ethRedeemTimestamp: event.timestamp,
          ethRedeemSecret: event.secret,
          status: 'eth_redeemed',
        });

        this.logger.info(`Updated order ${order.orderId} with Ethereum redeem: ${event.txHash}`);

        // Trigger Bitcoin redeem with the secret
        await this.triggerBitcoinRedeem(order, event.secret);
      }
    } catch (error) {
      this.logger.error('Error handling Ethereum redeem:', error);
    }
  }

  private async handleEthereumRefund(event: HTLCEvent): Promise<void> {
    try {
      const orders = await this.orderManager.findOrdersByHashlock(event.hashlock);
      
      for (const order of orders) {
        // Update order with Ethereum refund information
        await this.orderManager.updateOrderStatus(order.orderId, {
          ethRefundTx: event.txHash,
          ethRefundBlock: event.blockNumber,
          ethRefundTimestamp: event.timestamp,
          status: 'eth_refunded',
        });

        this.logger.info(`Updated order ${order.orderId} with Ethereum refund: ${event.txHash}`);
      }
    } catch (error) {
      this.logger.error('Error handling Ethereum refund:', error);
    }
  }

  private async triggerEthereumLock(order: any, btcEvent: HTLCEvent): Promise<void> {
    try {
      const action: CrossChainAction = {
        type: 'redeem',
        chain: 'ethereum',
        hashlock: btcEvent.hashlock,
        orderId: order.orderId,
        priority: 'high',
      };

      await this.ethereumResolver.executeAction(action);
      this.logger.info(`Triggered Ethereum lock for order ${order.orderId}`);
    } catch (error) {
      this.logger.error(`Error triggering Ethereum lock for order ${order.orderId}:`, error);
    }
  }

  private async triggerEthereumRedeem(order: any, secret: string): Promise<void> {
    try {
      const action: CrossChainAction = {
        type: 'redeem',
        chain: 'ethereum',
        hashlock: order.hashlock,
        secret: secret,
        orderId: order.orderId,
        priority: 'high',
      };

      await this.ethereumResolver.executeAction(action);
      this.logger.info(`Triggered Ethereum redeem for order ${order.orderId}`);
    } catch (error) {
      this.logger.error(`Error triggering Ethereum redeem for order ${order.orderId}:`, error);
    }
  }

  private async triggerBitcoinLock(order: any, ethEvent: HTLCEvent): Promise<void> {
    try {
      const action: CrossChainAction = {
        type: 'redeem',
        chain: 'bitcoin',
        hashlock: ethEvent.hashlock,
        orderId: order.orderId,
        priority: 'high',
      };

      await this.bitcoinResolver.executeAction(action);
      this.logger.info(`Triggered Bitcoin lock for order ${order.orderId}`);
    } catch (error) {
      this.logger.error(`Error triggering Bitcoin lock for order ${order.orderId}:`, error);
    }
  }

  private async triggerBitcoinRedeem(order: any, secret: string): Promise<void> {
    try {
      const action: CrossChainAction = {
        type: 'redeem',
        chain: 'bitcoin',
        hashlock: order.hashlock,
        secret: secret,
        orderId: order.orderId,
        priority: 'high',
      };

      await this.bitcoinResolver.executeAction(action);
      this.logger.info(`Triggered Bitcoin redeem for order ${order.orderId}`);
    } catch (error) {
      this.logger.error(`Error triggering Bitcoin redeem for order ${order.orderId}:`, error);
    }
  }

  // Get processing status
  getProcessingStatus(): { processingEvents: number } {
    return {
      processingEvents: this.processingEvents.size,
    };
  }
} 