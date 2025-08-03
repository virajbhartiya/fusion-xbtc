import { Logger } from './logger';
import { ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
const ElectrumClient = require('electrum-client');
import { buildHTLCScript } from '../btc-scripts/htlc';

interface CrossChainAction {
  type: 'redeem' | 'refund';
  chain: 'bitcoin' | 'ethereum';
  hashlock: string;
  secret?: string;
  orderId: string;
  priority: 'high' | 'medium' | 'low';
}

interface HTLCOutput {
  txid: string;
  vout: number;
  amount: number;
  script: string;
  redeemScript: string;
  address: string;
}

export class BitcoinResolver {
  private logger: Logger;
  private ECPair: any;
  private network: bitcoin.Network;
  private electrumClient: any = null;
  private electrumConfig: {
    host: string;
    port: number;
    protocol: 'ssl' | 'tcp';
  } | null = null;

  constructor() {
    this.logger = new Logger('BitcoinResolver');
    this.ECPair = ECPairFactory(tinysecp);
    this.network = bitcoin.networks.testnet;
  }

  // Initialize with Electrum connection
  async initialize(electrumHost: string, electrumPort: number, electrumProto: 'ssl' | 'tcp' = 'ssl'): Promise<void> {
    this.electrumConfig = { host: electrumHost, port: electrumPort, protocol: electrumProto };
    this.electrumClient = new ElectrumClient(electrumPort, electrumHost, electrumProto);
    
    try {
      await (this.electrumClient as any).connect();
      this.logger.info(`Connected to Electrum server: ${electrumHost}:${electrumPort}`);
    } catch (error) {
      this.logger.error('Failed to connect to Electrum server:', error);
      throw error;
    }
  }

  async executeAction(action: CrossChainAction): Promise<void> {
    this.logger.info('Executing Bitcoin action', action);

    if (!this.electrumClient) {
      throw new Error('Bitcoin resolver not initialized. Call initialize() first.');
    }

    try {
      switch (action.type) {
        case 'redeem':
          await this.executeRedeem(action);
          break;
        case 'refund':
          await this.executeRefund(action);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to execute Bitcoin ${action.type} action:`, error);
      throw error;
    }
  }

  private async executeRedeem(action: CrossChainAction): Promise<void> {
    if (!action.secret) {
      throw new Error('Secret required for Bitcoin redeem action');
    }

    this.logger.info(`Executing Bitcoin redeem for order ${action.orderId}`, {
      hashlock: action.hashlock,
      secret: action.secret,
    });

    try {
      // Find HTLC output
      const htlcOutput = await this.findHTLCOutput(action.hashlock);
      if (!htlcOutput) {
        throw new Error(`No HTLC output found for hashlock: ${action.hashlock}`);
      }

      // Build redeem transaction
      const txHex = await this.buildRedeemTransaction(
        htlcOutput,
        action.secret,
        action.orderId
      );

      // Broadcast transaction
      const txid = await this.broadcastTransaction(txHex);
      
      this.logger.info(`Bitcoin redeem transaction broadcasted successfully`, {
        orderId: action.orderId,
        txid: txid,
        hashlock: action.hashlock,
      });

    } catch (error) {
      this.logger.error(`Bitcoin redeem failed for order ${action.orderId}:`, error);
      throw error;
    }
  }

  private async executeRefund(action: CrossChainAction): Promise<void> {
    this.logger.info(`Executing Bitcoin refund for order ${action.orderId}`, {
      hashlock: action.hashlock,
    });

    try {
      // Find HTLC output
      const htlcOutput = await this.findHTLCOutput(action.hashlock);
      if (!htlcOutput) {
        throw new Error(`No HTLC output found for hashlock: ${action.hashlock}`);
      }

      // Check if timelock has expired
      const isExpired = await this.checkTimelockExpired(htlcOutput);
      if (!isExpired) {
        throw new Error(`Timelock not expired for hashlock: ${action.hashlock}`);
      }

      // Build refund transaction
      const txHex = await this.buildRefundTransaction(htlcOutput, action.orderId);

      // Broadcast transaction
      const txid = await this.broadcastTransaction(txHex);
      
      this.logger.info(`Bitcoin refund transaction broadcasted successfully`, {
        orderId: action.orderId,
        txid: txid,
        hashlock: action.hashlock,
      });

    } catch (error) {
      this.logger.error(`Bitcoin refund failed for order ${action.orderId}:`, error);
      throw error;
    }
  }

  private async findHTLCOutput(hashlock: string): Promise<HTLCOutput | null> {
    if (!this.electrumClient) {
      throw new Error('Electrum client not initialized');
    }

    try {
      // Search for transactions containing the hashlock
      const hashlockBuffer = Buffer.from(hashlock.replace(/^0x/, ''), 'hex');
      
      // Get recent blocks and search for HTLC outputs
      const currentHeight = await this.electrumClient.blockchainHeaders_subscribe();
      const searchBlocks = 100; // Search last 100 blocks
      
      for (let height = currentHeight.height - searchBlocks; height <= currentHeight.height; height++) {
        try {
          const blockHash = await this.electrumClient.blockchainBlock_header(height);
          const block = await this.electrumClient.blockchainBlock_getChunk(blockHash);
          
          // Parse block transactions
          const blockObj = bitcoin.Block.fromHex(block);
          if (blockObj.transactions) {
            for (const tx of blockObj.transactions) {
              for (let i = 0; i < tx.outs.length; i++) {
                const output = tx.outs[i];
                
                // Check if this is a P2SH output (potential HTLC)
                if (this.isHTLCAddress(output.script)) {
                  // Try to decode the redeem script
                  const redeemScript = this.extractRedeemScript(output.script);
                  if (redeemScript && this.containsHashlock(redeemScript, hashlockBuffer)) {
                    return {
                      txid: tx.getId(),
                      vout: i,
                      amount: output.value,
                      script: output.script.toString('hex'),
                      redeemScript: redeemScript.toString('hex'),
                      address: bitcoin.address.fromOutputScript(output.script, this.network),
                    };
                  }
                }
              }
            }
          }
        } catch (error) {
          this.logger.debug(`Error processing block ${height}:`, error);
          continue;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error finding HTLC output:', error);
      return null;
    }
  }

  private isHTLCAddress(script: Buffer): boolean {
    // P2SH addresses start with specific bytes
    return script.length === 23 && script[0] === 0xa9 && script[1] === 0x14;
  }

  private extractRedeemScript(script: Buffer): Buffer | null {
    try {
      // For P2SH, the redeem script is the last 20 bytes
      return script.slice(2, 22);
    } catch {
      return null;
    }
  }

  private containsHashlock(redeemScript: Buffer, hashlock: Buffer): boolean {
    try {
      // Simple check for hashlock in redeem script
      return redeemScript.includes(hashlock);
    } catch {
      return false;
    }
  }

  private async checkTimelockExpired(htlcOutput: HTLCOutput): Promise<boolean> {
    try {
      // Parse the redeem script to extract locktime
      const redeemScript = Buffer.from(htlcOutput.redeemScript, 'hex');
      const locktime = this.extractLocktime(redeemScript);
      
      if (!locktime) {
        return false;
      }

      // Get current block height
      const currentHeight = await this.electrumClient!.blockchainHeaders_subscribe();
      
      return currentHeight.height >= locktime;
    } catch (error) {
      this.logger.error('Error checking timelock:', error);
      return false;
    }
  }

  private extractLocktime(redeemScript: Buffer): number | null {
    try {
      // Look for OP_CLTV followed by a number
      for (let i = 0; i < redeemScript.length - 1; i++) {
        if (redeemScript[i] === bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY) {
          // Extract the number before OP_CLTV
          const numberBytes = redeemScript.slice(i - 1, i);
          return bitcoin.script.number.decode(numberBytes);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async buildRedeemTransaction(
    htlcOutput: HTLCOutput,
    secret: string,
    orderId: string
  ): Promise<string> {
    try {
      // Create a simple redeem transaction
      const psbt = new bitcoin.Psbt({ network: this.network });
      
      // Add input (HTLC output)
      psbt.addInput({
        hash: Buffer.from(htlcOutput.txid, 'hex').reverse(),
        index: htlcOutput.vout,
        witnessUtxo: {
          script: Buffer.from(htlcOutput.script, 'hex'),
          value: htlcOutput.amount,
        },
        redeemScript: Buffer.from(htlcOutput.redeemScript, 'hex'),
      } as any);

      // Add output (to a change address - this should be configurable)
      const changeAddress = this.generateChangeAddress();
      const feeSats = 1000; // Fixed fee for now
      const outputAmount = htlcOutput.amount - feeSats;
      
      psbt.addOutput({
        address: changeAddress,
        value: outputAmount,
      });

      // Sign the transaction (this requires the recipient's private key)
      // For now, we'll create an unsigned transaction
      this.logger.warn('Redeem transaction created but not signed. Manual signing required.');
      
      return psbt.toHex();
    } catch (error) {
      this.logger.error('Error building redeem transaction:', error);
      throw error;
    }
  }

  private async buildRefundTransaction(
    htlcOutput: HTLCOutput,
    orderId: string
  ): Promise<string> {
    try {
      // Create a simple refund transaction
      const psbt = new bitcoin.Psbt({ network: this.network });
      
      // Add input (HTLC output)
      psbt.addInput({
        hash: Buffer.from(htlcOutput.txid, 'hex').reverse(),
        index: htlcOutput.vout,
        witnessUtxo: {
          script: Buffer.from(htlcOutput.script, 'hex'),
          value: htlcOutput.amount,
        },
        redeemScript: Buffer.from(htlcOutput.redeemScript, 'hex'),
      } as any);

      // Add output (to refund address - this should be configurable)
      const refundAddress = this.generateRefundAddress();
      const feeSats = 1000; // Fixed fee for now
      const outputAmount = htlcOutput.amount - feeSats;
      
      psbt.addOutput({
        address: refundAddress,
        value: outputAmount,
      });

      // Sign the transaction (this requires the refund private key)
      // For now, we'll create an unsigned transaction
      this.logger.warn('Refund transaction created but not signed. Manual signing required.');
      
      return psbt.toHex();
    } catch (error) {
      this.logger.error('Error building refund transaction:', error);
      throw error;
    }
  }

  private generateChangeAddress(): string {
    // Use configured change address or throw error
    const changeAddress = process.env.BITCOIN_CHANGE_ADDRESS;
    if (!changeAddress) {
      throw new Error('BITCOIN_CHANGE_ADDRESS environment variable is required for change address generation');
    }
    return changeAddress;
  }

  private generateRefundAddress(): string {
    // Use configured refund address or throw error
    const refundAddress = process.env.BITCOIN_REFUND_ADDRESS;
    if (!refundAddress) {
      throw new Error('BITCOIN_REFUND_ADDRESS environment variable is required for refund address generation');
    }
    return refundAddress;
  }

  private async broadcastTransaction(txHex: string): Promise<string> {
    if (!this.electrumClient) {
      throw new Error('Electrum client not initialized');
    }

    try {
      const txid = await this.electrumClient.blockchainTransaction_broadcast(txHex);
      this.logger.info(`Transaction broadcasted successfully: ${txid}`);
      return txid;
    } catch (error) {
      this.logger.error('Failed to broadcast transaction:', error);
      throw error;
    }
  }

  // Set network (mainnet/testnet)
  setNetwork(network: 'mainnet' | 'testnet'): void {
    this.network = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    this.logger.info(`Bitcoin resolver network set to: ${network}`);
  }

  // Get current status
  getStatus(): { network: string; ready: boolean; connected: boolean } {
    return {
      network: this.network === bitcoin.networks.bitcoin ? 'mainnet' : 'testnet',
      ready: this.electrumClient !== null,
      connected: this.electrumClient !== null,
    };
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.electrumClient) {
      try {
        await (this.electrumClient as any).close();
        this.logger.info('Electrum client disconnected');
      } catch (error) {
        this.logger.error('Error disconnecting Electrum client:', error);
      }
      this.electrumClient = null;
    }
  }
} 