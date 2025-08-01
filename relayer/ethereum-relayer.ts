import { ethers } from 'ethers';
import { Logger } from './logger';
import { EventProcessor } from './event-processor';

interface EthereumRelayerConfig {
  network: 'mainnet' | 'sepolia' | 'goerli';
  rpcUrl: string;
  contractAddress: string;
  pollInterval: number;
  eventProcessor: EventProcessor;
}

interface HTLCEvent {
  type: 'lock' | 'redeem' | 'refund';
  txHash: string;
  blockNumber: number;
  timestamp: number;
  hashlock: string;
  amount: string;
  sender: string;
  recipient: string;
  secret?: string;
}

// HTLC Contract ABI (simplified for events)
const HTLC_ABI = [
  'event Locked(bytes32 indexed hashlock, address indexed sender, address indexed recipient, uint256 amount, uint256 timelock)',
  'event Redeemed(bytes32 indexed hashlock, address indexed recipient, bytes32 secret)',
  'event Refunded(bytes32 indexed hashlock, address indexed sender)',
  'function getLock(bytes32 hashlock) external view returns (address sender, address recipient, uint256 amount, uint256 timelock, bool withdrawn)',
];

export class EthereumRelayer {
  private config: EthereumRelayerConfig;
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private logger: Logger;
  private isRunning = false;
  private isConnected = false;
  private lastBlockNumber = 0;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(config: EthereumRelayerConfig) {
    this.config = config;
    this.logger = new Logger('EthereumRelayer');
    
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.contract = new ethers.Contract(config.contractAddress, HTLC_ABI, this.provider);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Ethereum relayer is already running');
      return;
    }

    try {
      await this.connect();
      await this.initializeBlockNumber();
      this.startPolling();
      this.isRunning = true;
      this.logger.info('Ethereum relayer started successfully');
    } catch (error) {
      this.logger.error('Failed to start Ethereum relayer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Ethereum relayer...');
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isRunning = false;
    this.logger.info('Ethereum relayer stopped');
  }

  private async connect(): Promise<void> {
    try {
      // Test connection by getting network info
      const network = await this.provider.getNetwork();
      this.isConnected = true;
      this.logger.info(`Connected to Ethereum network: ${network.name} (chainId: ${network.chainId})`);
    } catch (error) {
      this.logger.error('Failed to connect to Ethereum RPC:', error);
      throw error;
    }
  }

  private async initializeBlockNumber(): Promise<void> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      this.lastBlockNumber = blockNumber;
      this.logger.info(`Initialized at block number: ${this.lastBlockNumber}`);
    } catch (error) {
      this.logger.error('Failed to initialize block number:', error);
      throw error;
    }
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollNewBlocks();
      } catch (error) {
        this.logger.error('Error polling new blocks:', error);
        
        // Try to reconnect if connection is lost
        if (!this.isConnected) {
          this.logger.info('Attempting to reconnect...');
          await this.reconnect();
        }
      }
    }, this.config.pollInterval);
  }

  private async reconnect(): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      this.contract = new ethers.Contract(this.config.contractAddress, HTLC_ABI, this.provider);
      await this.connect();
      await this.initializeBlockNumber();
      this.logger.info('Successfully reconnected to Ethereum RPC');
    } catch (error) {
      this.logger.error('Failed to reconnect:', error);
    }
  }

  private async pollNewBlocks(): Promise<void> {
    try {
      const currentBlockNumber = await this.provider.getBlockNumber();
      
      if (currentBlockNumber > this.lastBlockNumber) {
        this.logger.info(`New block detected: ${currentBlockNumber}`);
        
        // Process blocks from lastBlockNumber + 1 to currentBlockNumber
        for (let blockNumber = this.lastBlockNumber + 1; blockNumber <= currentBlockNumber; blockNumber++) {
          await this.processBlock(blockNumber);
        }
        
        this.lastBlockNumber = currentBlockNumber;
      }
    } catch (error) {
      this.logger.error('Error polling new blocks:', error);
      throw error;
    }
  }

  private async processBlock(blockNumber: number): Promise<void> {
    try {
      // Get block with transactions
      const block = await this.provider.getBlock(blockNumber, true);
      if (!block) {
        this.logger.warn(`Block ${blockNumber} not found`);
        return;
      }

      // Process transactions in the block
      for (const tx of block.transactions) {
        const transaction = tx as any;
        if (transaction && transaction.to && transaction.to.toLowerCase() === this.config.contractAddress.toLowerCase()) {
          await this.processTransaction(transaction, blockNumber, block.timestamp || 0);
        }
      }
      
      this.logger.debug(`Processed block ${blockNumber} with ${block.transactions.length} transactions`);
    } catch (error) {
      this.logger.error(`Error processing block ${blockNumber}:`, error);
    }
  }

  private async processTransaction(tx: any, blockNumber: number, timestamp: number): Promise<void> {
    try {
      // Get transaction receipt to check for events
      const receipt = await this.provider.getTransactionReceipt(tx.hash);
      if (!receipt) {
        return;
      }

      // Parse events from the transaction
      const events = this.parseEvents(receipt, blockNumber, timestamp);
      
      for (const event of events) {
        await this.config.eventProcessor.processEthereumEvent(event);
      }
    } catch (error) {
      this.logger.error(`Error processing transaction ${tx.hash}:`, error);
    }
  }

  private parseEvents(receipt: any, blockNumber: number, timestamp: number): HTLCEvent[] {
    const events: HTLCEvent[] = [];
    
    try {
      // Parse logs for HTLC events
      for (const log of receipt.logs) {
        const event = this.parseLog(log, blockNumber, timestamp);
        if (event) {
          events.push(event);
        }
      }
    } catch (error) {
      this.logger.error('Error parsing events:', error);
    }
    
    return events;
  }

  private parseLog(log: any, blockNumber: number, timestamp: number): HTLCEvent | null {
    try {
      // Check if this is an HTLC contract event
      if (log.address.toLowerCase() !== this.config.contractAddress.toLowerCase()) {
        return null;
      }

      // Parse event based on topic
      const topic0 = log.topics[0];
      
      if (topic0 === this.contract.interface.getEvent('Locked')?.topicHash) {
        return this.parseLockedEvent(log, blockNumber, timestamp);
      } else if (topic0 === this.contract.interface.getEvent('Redeemed')?.topicHash) {
        return this.parseRedeemedEvent(log, blockNumber, timestamp);
      } else if (topic0 === this.contract.interface.getEvent('Refunded')?.topicHash) {
        return this.parseRefundedEvent(log, blockNumber, timestamp);
      }
    } catch (error) {
      this.logger.error('Error parsing log:', error);
    }
    
    return null;
  }

  private parseLockedEvent(log: any, blockNumber: number, timestamp: number): HTLCEvent {
    const decodedLog = this.contract.interface.parseLog(log);
    
    if (!decodedLog) {
      throw new Error('Failed to parse log');
    }
    
    return {
      type: 'lock',
      txHash: log.transactionHash,
      blockNumber,
      timestamp: timestamp * 1000, // Convert to milliseconds
      hashlock: decodedLog.args[0], // hashlock
      amount: decodedLog.args[3].toString(), // amount
      sender: decodedLog.args[1], // sender
      recipient: decodedLog.args[2], // recipient
    };
  }

  private parseRedeemedEvent(log: any, blockNumber: number, timestamp: number): HTLCEvent {
    const decodedLog = this.contract.interface.parseLog(log);
    
    if (!decodedLog) {
      throw new Error('Failed to parse log');
    }
    
    return {
      type: 'redeem',
      txHash: log.transactionHash,
      blockNumber,
      timestamp: timestamp * 1000,
      hashlock: decodedLog.args[0], // hashlock
      amount: '0', // Amount is not in redeem event
      sender: '', // Sender is not in redeem event
      recipient: decodedLog.args[1], // recipient
      secret: decodedLog.args[2], // secret
    };
  }

  private parseRefundedEvent(log: any, blockNumber: number, timestamp: number): HTLCEvent {
    const decodedLog = this.contract.interface.parseLog(log);
    
    if (!decodedLog) {
      throw new Error('Failed to parse log');
    }
    
    return {
      type: 'refund',
      txHash: log.transactionHash,
      blockNumber,
      timestamp: timestamp * 1000,
      hashlock: decodedLog.args[0], // hashlock
      amount: '0', // Amount is not in refund event
      sender: decodedLog.args[1], // sender
      recipient: '', // Recipient is not in refund event
    };
  }

  // Helper method to get lock details
  async getLockDetails(hashlock: string): Promise<{
    sender: string;
    recipient: string;
    amount: string;
    timelock: number;
    withdrawn: boolean;
  } | null> {
    try {
      const lock = await this.contract.getLock(hashlock);
      return {
        sender: lock[0],
        recipient: lock[1],
        amount: lock[2].toString(),
        timelock: lock[3].toNumber(),
        withdrawn: lock[4],
      };
    } catch (error) {
      this.logger.error(`Error getting lock details for ${hashlock}:`, error);
      return null;
    }
  }

  // Helper method to check if a hashlock exists
  async hasLock(hashlock: string): Promise<boolean> {
    try {
      const lock = await this.contract.getLock(hashlock);
      return lock[0] !== ethers.ZeroAddress; // Check if sender is not zero address
    } catch (error) {
      return false;
    }
  }

  getStatus(): { isConnected: boolean; lastBlock: number } {
    return {
      isConnected: this.isConnected,
      lastBlock: this.lastBlockNumber,
    };
  }
} 