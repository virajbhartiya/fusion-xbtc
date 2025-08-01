import { Logger } from './logger';
import { ethers } from 'ethers';

interface CrossChainAction {
  type: 'redeem' | 'refund';
  chain: 'bitcoin' | 'ethereum';
  hashlock: string;
  secret?: string;
  orderId: string;
  priority: 'high' | 'medium' | 'low';
}

// HTLC Contract ABI for interactions
const HTLC_ABI = [
  'function redeem(bytes32 hashlock, bytes32 secret) external',
  'function refund(bytes32 hashlock) external',
  'function getLock(bytes32 hashlock) external view returns (address sender, address recipient, uint256 amount, uint256 timelock, bool withdrawn)',
  'event Redeemed(bytes32 indexed hashlock, address indexed recipient, bytes32 secret)',
  'event Refunded(bytes32 indexed hashlock, address indexed sender)',
];

export class EthereumResolver {
  private logger: Logger;
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.logger = new Logger('EthereumResolver');
  }

  // Initialize with provider and contract
  initialize(
    rpcUrl: string,
    contractAddress: string,
    privateKey: string
  ): void {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(contractAddress, HTLC_ABI, this.provider);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Connect contract to wallet for transactions
    this.contract = this.contract!.connect(this.wallet) as any;
    
    this.logger.info('Ethereum resolver initialized', {
      rpcUrl,
      contractAddress,
      walletAddress: this.wallet.address,
    });
  }

  async executeAction(action: CrossChainAction): Promise<void> {
    this.logger.info('Executing Ethereum action', action);

    if (!this.contract || !this.wallet) {
      throw new Error('Ethereum resolver not initialized');
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
      this.logger.error(`Failed to execute Ethereum ${action.type} action:`, error);
      throw error;
    }
  }

  private async executeRedeem(action: CrossChainAction): Promise<void> {
    if (!action.secret) {
      throw new Error('Secret required for Ethereum redeem action');
    }

    this.logger.info(`Executing Ethereum redeem for order ${action.orderId}`, {
      hashlock: action.hashlock,
      secret: action.secret,
    });

    try {
      // Check if lock exists and is not already withdrawn
      const lock = await this.contract!.getLock(action.hashlock);
      
      if (lock[0] === ethers.ZeroAddress) {
        throw new Error(`No lock found for hashlock: ${action.hashlock}`);
      }
      
      if (lock[4]) { // withdrawn flag
        throw new Error(`Lock already withdrawn for hashlock: ${action.hashlock}`);
      }

      // Execute redeem transaction
      const tx = await this.contract!.redeem(action.hashlock, action.secret);
      
      this.logger.info(`Ethereum redeem transaction sent`, {
        orderId: action.orderId,
        txHash: tx.hash,
        hashlock: action.hashlock,
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      this.logger.info(`Ethereum redeem transaction confirmed`, {
        orderId: action.orderId,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

    } catch (error) {
      this.logger.error(`Ethereum redeem failed for order ${action.orderId}:`, error);
      throw error;
    }
  }

  private async executeRefund(action: CrossChainAction): Promise<void> {
    this.logger.info(`Executing Ethereum refund for order ${action.orderId}`, {
      hashlock: action.hashlock,
    });

    try {
      // Check if lock exists and is not already withdrawn
      const lock = await this.contract!.getLock(action.hashlock);
      
      if (lock[0] === ethers.ZeroAddress) {
        throw new Error(`No lock found for hashlock: ${action.hashlock}`);
      }
      
      if (lock[4]) { // withdrawn flag
        throw new Error(`Lock already withdrawn for hashlock: ${action.hashlock}`);
      }

      // Check if timelock has expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime < lock[3].toNumber()) { // timelock
        throw new Error(`Timelock not expired for hashlock: ${action.hashlock}`);
      }

      // Execute refund transaction
      const tx = await this.contract!.refund(action.hashlock);
      
      this.logger.info(`Ethereum refund transaction sent`, {
        orderId: action.orderId,
        txHash: tx.hash,
        hashlock: action.hashlock,
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      this.logger.info(`Ethereum refund transaction confirmed`, {
        orderId: action.orderId,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

    } catch (error) {
      this.logger.error(`Ethereum refund failed for order ${action.orderId}:`, error);
      throw error;
    }
  }

  // Helper method to check if a hashlock exists
  async hasLock(hashlock: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Ethereum resolver not initialized');
    }

    try {
      const lock = await this.contract.getLock(hashlock);
      return lock[0] !== ethers.ZeroAddress;
    } catch (error) {
      return false;
    }
  }

  // Helper method to get lock details
  async getLockDetails(hashlock: string): Promise<{
    sender: string;
    recipient: string;
    amount: string;
    timelock: number;
    withdrawn: boolean;
  } | null> {
    if (!this.contract) {
      throw new Error('Ethereum resolver not initialized');
    }

    try {
      const lock = await this.contract.getLock(hashlock);
      
      if (lock[0] === ethers.ZeroAddress) {
        return null;
      }

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

  // Helper method to estimate gas for redeem
  async estimateRedeemGas(hashlock: string, secret: string): Promise<string> {
    if (!this.contract) {
      throw new Error('Ethereum resolver not initialized');
    }

    try {
      const gasEstimate = await this.contract.redeem.estimateGas(hashlock, secret);
      return gasEstimate.toString();
    } catch (error) {
      this.logger.error(`Error estimating redeem gas for ${hashlock}:`, error);
      throw error;
    }
  }

  // Helper method to estimate gas for refund
  async estimateRefundGas(hashlock: string): Promise<string> {
    if (!this.contract) {
      throw new Error('Ethereum resolver not initialized');
    }

    try {
      const gasEstimate = await this.contract.refund.estimateGas(hashlock);
      return gasEstimate.toString();
    } catch (error) {
      this.logger.error(`Error estimating refund gas for ${hashlock}:`, error);
      throw error;
    }
  }

  // Get current status
  getStatus(): { 
    initialized: boolean; 
    network?: string; 
    walletAddress?: string; 
    contractAddress?: string;
  } {
    return {
      initialized: this.contract !== null && this.wallet !== null,
      network: this.provider?._network?.name,
      walletAddress: this.wallet?.address,
      contractAddress: this.contract?.target?.toString(),
    };
  }

  // Get wallet balance
  async getBalance(): Promise<string> {
    if (!this.wallet) {
      throw new Error('Ethereum resolver not initialized');
    }

    const balance = await this.provider!.getBalance(this.wallet!.address);
    return ethers.formatEther(balance);
  }
} 