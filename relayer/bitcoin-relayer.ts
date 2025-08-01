import * as bitcoin from 'bitcoinjs-lib';
import { Logger } from './logger';
import { EventProcessor } from './event-processor';

const ElectrumClient = require('electrum-client');
import { OrderManager } from './order-manager';

interface BitcoinRelayerConfig {
  network: 'mainnet' | 'testnet';
  electrumHost: string;
  electrumPort: number;
  electrumProto: 'ssl' | 'tcp';
  pollInterval: number;
  eventProcessor: EventProcessor;
}

interface HTLCEvent {
  type: 'lock' | 'redeem' | 'refund';
  txHash: string;
  blockHeight: number;
  timestamp: number;
  hashlock: string;
  amount: number;
  address: string;
  redeemScript?: string;
  secret?: string;
}

export class BitcoinRelayer {
  private config: BitcoinRelayerConfig;
  private client: any;
  private logger: Logger;
  private isRunning = false;
  private isConnected = false;
  private lastBlockHeight = 0;
  private pollInterval: NodeJS.Timeout | null = null;
  private network: bitcoin.Network;

  constructor(config: BitcoinRelayerConfig) {
    this.config = config;
    this.logger = new Logger('BitcoinRelayer');
    this.network = config.network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    
    this.client = new (ElectrumClient as any)(
      config.electrumPort,
      config.electrumHost,
      config.electrumProto
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Bitcoin relayer is already running');
      return;
    }

    try {
      await this.connect();
      await this.initializeBlockHeight();
      this.startPolling();
      this.isRunning = true;
      this.logger.info('Bitcoin relayer started successfully');
    } catch (error) {
      this.logger.error('Failed to start Bitcoin relayer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Bitcoin relayer...');
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.isConnected) {
      await this.disconnect();
    }

    this.isRunning = false;
    this.logger.info('Bitcoin relayer stopped');
  }

  private async connect(): Promise<void> {
    try {
      await (this.client as any).connect();
      this.isConnected = true;
      this.logger.info(`Connected to Electrum server: ${this.config.electrumHost}:${this.config.electrumPort}`);
    } catch (error) {
      this.logger.error('Failed to connect to Electrum server:', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    try {
      await (this.client as any).close();
      this.isConnected = false;
      this.logger.info('Disconnected from Electrum server');
    } catch (error) {
      this.logger.error('Error disconnecting from Electrum server:', error);
    }
  }

  private async initializeBlockHeight(): Promise<void> {
    try {
      const blockHeight = await this.client.blockchainHeaders_subscribe();
      this.lastBlockHeight = blockHeight.height;
      this.logger.info(`Initialized at block height: ${this.lastBlockHeight}`);
    } catch (error) {
      this.logger.error('Failed to initialize block height:', error);
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
      await this.disconnect();
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      await this.connect();
      await this.initializeBlockHeight();
      this.logger.info('Successfully reconnected to Electrum server');
    } catch (error) {
      this.logger.error('Failed to reconnect:', error);
    }
  }

  private async pollNewBlocks(): Promise<void> {
    try {
      const currentBlockHeight = await this.client.blockchainHeaders_subscribe();
      
      if (currentBlockHeight.height > this.lastBlockHeight) {
        this.logger.info(`New block detected: ${currentBlockHeight.height}`);
        
        // Process blocks from lastBlockHeight + 1 to currentBlockHeight
        for (let height = this.lastBlockHeight + 1; height <= currentBlockHeight.height; height++) {
          await this.processBlock(height);
        }
        
        this.lastBlockHeight = currentBlockHeight.height;
      }
    } catch (error) {
      this.logger.error('Error polling new blocks:', error);
      throw error;
    }
  }

  private async processBlock(blockHeight: number): Promise<void> {
    try {
      // Debug: log available methods
      this.logger.debug('Available client methods:', Object.getOwnPropertyNames(this.client));
      
      // Try different approaches to get block data
      let blockData;
      try {
        // Method 1: Try to get block header first
        const blockHeader = await this.client.blockchainBlock_header(blockHeight);
        this.logger.debug('Block header:', blockHeader);
        
        // Method 2: Try to get full block
        blockData = await this.client.blockchainBlock_get(blockHeader.hex || blockHeader);
      } catch (headerError) {
        this.logger.debug('Header method failed, trying alternative:', headerError);
        
        // Method 3: Try alternative method names
        try {
          blockData = await this.client.blockchainBlock_getChunk(blockHeight);
        } catch (chunkError) {
          this.logger.debug('Chunk method failed:', chunkError);
          
          // Method 4: Skip block processing for now
          this.logger.warn(`Skipping block ${blockHeight} - no suitable method found`);
          return;
        }
      }
      
      // Parse block transactions
      const transactions = this.parseBlockTransactions(blockData);
      
      for (const tx of transactions) {
        await this.processTransaction(tx, blockHeight);
      }
      
      this.logger.debug(`Processed block ${blockHeight} with ${transactions.length} transactions`);
    } catch (error) {
      this.logger.error(`Error processing block ${blockHeight}:`, error);
    }
  }

  private parseBlockTransactions(blockHex: string): any[] {
    try {
      const block = bitcoin.Block.fromHex(blockHex);
      return block.transactions?.map(tx => ({
        txid: tx.getId(),
        hex: tx.toHex(),
        inputs: tx.ins.map(input => ({
          hash: input.hash.toString('hex'),
          index: input.index,
          script: input.script.toString('hex'),
          witness: input.witness.map(w => w.toString('hex')),
        })),
        outputs: tx.outs.map(output => ({
          value: output.value,
          script: output.script.toString('hex'),
        })),
      })) || [];
    } catch (error) {
      this.logger.error('Error parsing block transactions:', error);
      return [];
    }
  }

  private async processTransaction(tx: any, blockHeight: number): Promise<void> {
    try {
      // Check if transaction contains HTLC-related outputs
      const htlcEvents = this.detectHTLCEvents(tx, blockHeight);
      
      for (const event of htlcEvents) {
        await this.config.eventProcessor.processBitcoinEvent(event);
      }
    } catch (error) {
      this.logger.error(`Error processing transaction ${tx.txid}:`, error);
    }
  }

  private detectHTLCEvents(tx: any, blockHeight: number): HTLCEvent[] {
    const events: HTLCEvent[] = [];
    
    try {
      // Check outputs for P2SH addresses (HTLC outputs)
      for (let i = 0; i < tx.outputs.length; i++) {
        const output = tx.outputs[i];
        
        // Check if this is a P2SH output (HTLC address)
        if (this.isHTLCAddress(output.script)) {
          events.push({
            type: 'lock',
            txHash: tx.txid,
            blockHeight,
            timestamp: Date.now(), // We'll get actual timestamp later
            hashlock: this.extractHashlock(output.script),
            amount: output.value,
            address: this.scriptToAddress(output.script),
            redeemScript: output.script,
          });
        }
      }
      
      // Check inputs for HTLC redemptions
      for (const input of tx.inputs) {
        if (this.isHTLCRedeem(input)) {
          events.push({
            type: 'redeem',
            txHash: tx.txid,
            blockHeight,
            timestamp: Date.now(),
            hashlock: this.extractHashlockFromRedeem(input),
            amount: 0, // We'll get this from the output being spent
            address: '',
            secret: this.extractSecret(input),
          });
        }
      }
    } catch (error) {
      this.logger.error('Error detecting HTLC events:', error);
    }
    
    return events;
  }

  private isHTLCAddress(scriptHex: string): boolean {
    try {
      const script = Buffer.from(scriptHex, 'hex');
      // P2SH addresses start with specific bytes
      return script.length === 23 && script[0] === 0xa9 && script[1] === 0x14;
    } catch {
      return false;
    }
  }

  private isHTLCRedeem(input: any): boolean {
    try {
      // Check if input contains witness data (for HTLC redemptions)
      return input.witness && input.witness.length > 0;
    } catch {
      return false;
    }
  }

  private extractHashlock(scriptHex: string): string {
    // This is a simplified extraction - in practice, you'd need to decode the redeem script
    try {
      const script = Buffer.from(scriptHex, 'hex');
      // Extract hashlock from P2SH script (simplified)
      return script.slice(2, 34).toString('hex');
    } catch {
      return '';
    }
  }

  private extractHashlockFromRedeem(input: any): string {
    // Extract hashlock from redemption witness data
    try {
      if (input.witness && input.witness.length > 2) {
        return input.witness[2]; // Secret is usually the third witness element
      }
    } catch {
      // Ignore errors
    }
    return '';
  }

  private extractSecret(input: any): string {
    // Extract secret from redemption witness data
    try {
      if (input.witness && input.witness.length > 2) {
        return input.witness[2];
      }
    } catch {
      // Ignore errors
    }
    return '';
  }

  private scriptToAddress(scriptHex: string): string {
    try {
      const script = Buffer.from(scriptHex, 'hex');
      return bitcoin.address.fromOutputScript(script, this.network);
    } catch {
      return '';
    }
  }

  getStatus(): { isConnected: boolean; lastBlock: number } {
    return {
      isConnected: this.isConnected,
      lastBlock: this.lastBlockHeight,
    };
  }
} 