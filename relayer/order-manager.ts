import fs from 'fs';
import path from 'path';
import { Logger } from './logger';

interface Order {
  orderId: string;
  amount: number;
  remainingAmount: number;
  minFillAmount: number;
  maxFillAmount: number;
  recipientAddress: string;
  refundAddress: string;
  secret: string;
  hashlock: string;
  locktime: number;
  network: string;
  chain: string;
  status: string;
  fills: any[];
  createdAt: number;
  updatedAt: number;
  
  // Bitcoin transaction details
  btcLockTx?: string;
  btcLockBlock?: number;
  btcLockTimestamp?: number;
  btcLockAmount?: number;
  btcLockAddress?: string;
  btcRedeemTx?: string;
  btcRedeemBlock?: number;
  btcRedeemTimestamp?: number;
  btcRedeemSecret?: string;
  btcRefundTx?: string;
  btcRefundBlock?: number;
  btcRefundTimestamp?: number;
  
  // Ethereum transaction details
  ethLockTx?: string;
  ethLockBlock?: number;
  ethLockTimestamp?: number;
  ethLockAmount?: string;
  ethLockSender?: string;
  ethLockRecipient?: string;
  ethRedeemTx?: string;
  ethRedeemBlock?: number;
  ethRedeemTimestamp?: number;
  ethRedeemSecret?: string;
  ethRefundTx?: string;
  ethRefundBlock?: number;
  ethRefundTimestamp?: number;
}

interface OrderUpdate {
  status?: string;
  btcLockTx?: string;
  btcLockBlock?: number;
  btcLockTimestamp?: number;
  btcLockAmount?: number;
  btcLockAddress?: string;
  btcRedeemTx?: string;
  btcRedeemBlock?: number;
  btcRedeemTimestamp?: number;
  btcRedeemSecret?: string;
  btcRefundTx?: string;
  btcRefundBlock?: number;
  btcRefundTimestamp?: number;
  ethLockTx?: string;
  ethLockBlock?: number;
  ethLockTimestamp?: number;
  ethLockAmount?: string;
  ethLockSender?: string;
  ethLockRecipient?: string;
  ethRedeemTx?: string;
  ethRedeemBlock?: number;
  ethRedeemTimestamp?: number;
  ethRedeemSecret?: string;
  ethRefundTx?: string;
  ethRefundBlock?: number;
  ethRefundTimestamp?: number;
}

export class OrderManager {
  private logger: Logger;
  private dataDir: string;
  private orders: Map<string, Order> = new Map();
  private backupInterval: NodeJS.Timeout | null = null;

  constructor(dataDir: string) {
    this.logger = new Logger('OrderManager');
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        this.logger.info(`Created data directory: ${this.dataDir}`);
      }

      // Load existing orders
      await this.loadOrders();
      this.logger.info(`Loaded ${this.orders.size} orders from disk`);

      // Start backup interval
      this.startBackupInterval();

    } catch (error) {
      this.logger.error('Failed to initialize order manager:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }

    // Save all orders before cleanup
    await this.saveAllOrders();
    this.logger.info('Order manager cleanup completed');
  }

  private async loadOrders(): Promise<void> {
    try {
      const files = fs.readdirSync(this.dataDir);
      const orderFiles = files.filter(file => file.endsWith('.json') && !file.startsWith('fill-'));

      for (const file of orderFiles) {
        try {
          const filePath = path.join(this.dataDir, file);
          const orderData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Validate order data
          if (this.validateOrder(orderData)) {
            this.orders.set(orderData.orderId, orderData);
          } else {
            this.logger.warn(`Invalid order data in file: ${file}`);
          }
        } catch (error) {
          this.logger.error(`Error loading order from file ${file}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error loading orders:', error);
      throw error;
    }
  }

  private validateOrder(orderData: any): boolean {
    const requiredFields = [
      'orderId', 'amount', 'remainingAmount', 'minFillAmount', 'maxFillAmount',
      'recipientAddress', 'refundAddress', 'secret', 'hashlock', 'locktime',
      'network', 'chain', 'status', 'fills', 'createdAt', 'updatedAt'
    ];

    return requiredFields.every(field => orderData.hasOwnProperty(field));
  }

  private startBackupInterval(): void {
    // Backup orders every 5 minutes
    this.backupInterval = setInterval(async () => {
      try {
        await this.saveAllOrders();
        this.logger.debug('Orders backed up successfully');
      } catch (error) {
        this.logger.error('Error backing up orders:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async saveAllOrders(): Promise<void> {
    for (const [orderId, order] of this.orders) {
      await this.saveOrder(order);
    }
  }

  private async saveOrder(order: Order): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, `${order.orderId}.json`);
      const orderData = JSON.stringify(order, null, 2);
      fs.writeFileSync(filePath, orderData);
    } catch (error) {
      this.logger.error(`Error saving order ${order.orderId}:`, error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async findOrdersByHashlock(hashlock: string): Promise<Order[]> {
    const normalizedHashlock = hashlock.toLowerCase();
    return Array.from(this.orders.values()).filter(order => 
      order.hashlock.toLowerCase() === normalizedHashlock
    );
  }

  async findOrdersByStatus(status: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  async updateOrderStatus(orderId: string, update: OrderUpdate): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Apply updates
    Object.assign(order, update);
    order.updatedAt = Date.now();

    // Save to disk
    await this.saveOrder(order);
    
    this.logger.info(`Updated order ${orderId} status to: ${update.status || order.status}`);
  }

  async addOrder(order: Order): Promise<void> {
    if (this.orders.has(order.orderId)) {
      throw new Error(`Order ${order.orderId} already exists`);
    }

    this.orders.set(order.orderId, order);
    await this.saveOrder(order);
    
    this.logger.info(`Added new order: ${order.orderId}`);
  }

  async removeOrder(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    this.orders.delete(orderId);
    
    // Remove file from disk
    const filePath = path.join(this.dataDir, `${orderId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    this.logger.info(`Removed order: ${orderId}`);
  }

  async getOrderStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byNetwork: Record<string, number>;
  }> {
    const orders = Array.from(this.orders.values());
    const byStatus: Record<string, number> = {};
    const byNetwork: Record<string, number> = {};

    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      byNetwork[order.network] = (byNetwork[order.network] || 0) + 1;
    }

    return {
      total: orders.length,
      byStatus,
      byNetwork,
    };
  }

  async getOrdersNeedingAction(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => {
      // Orders that need relayer action
      const needsAction = [
        'open',
        'partial',
        'btc_locked',
        'eth_locked',
        'btc_redeemed',
        'eth_redeemed',
      ];
      return needsAction.includes(order.status);
    });
  }

  async getExpiredOrders(): Promise<Order[]> {
    const now = Date.now();
    return Array.from(this.orders.values()).filter(order => {
      // Check if order has exceeded locktime
      const locktimeMs = order.locktime * 1000;
      const orderAge = now - order.createdAt;
      return orderAge > locktimeMs;
    });
  }

  getStatus(): { total: number; open: number; processing: number } {
    const orders = Array.from(this.orders.values());
    const open = orders.filter(o => o.status === 'open').length;
    const processing = orders.filter(o => 
      ['btc_locked', 'eth_locked', 'btc_redeemed', 'eth_redeemed'].includes(o.status)
    ).length;

    return {
      total: orders.length,
      open,
      processing,
    };
  }

  // Export orders for backup
  async exportOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  // Import orders from backup
  async importOrders(orders: Order[]): Promise<void> {
    for (const order of orders) {
      if (this.validateOrder(order)) {
        this.orders.set(order.orderId, order);
        await this.saveOrder(order);
      } else {
        this.logger.warn(`Skipping invalid order: ${order.orderId}`);
      }
    }
    
    this.logger.info(`Imported ${orders.length} orders`);
  }
} 