// Fusion+ API integration with real blockchain
import { ethers } from 'ethers';

// Fusion+ order types
interface FusionOrder {
  orderId: string;
  makerAsset: string;
  takerAsset: string;
  makerAmount: string;
  takerAmount: string;
  makerAddress: string;
  takerAddress: string;
  hashlock: string;
  timelock: number;
  secret: string;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  createdAt: number;
  updatedAt: number;
}

interface CrossChainSwap {
  swapId: string;
  direction: 'eth2btc' | 'btc2eth';
  ethAmount: string;
  btcAmount: string;
  ethAddress: string;
  btcAddress: string;
  fusionOrderId: string;
  htlcHashlock: string;
  htlcSecret: string;
  htlcTimelock: number;
  status: 'pending' | 'locked' | 'redeemed' | 'refunded';
  createdAt: number;
  updatedAt: number;
}

// Contract ABI for Fusion+ HTLC
const FUSION_HTLC_ABI = [
  "function createFusionOrder(bytes32 orderId, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock, bytes32 hashlock) external payable",
  "function matchFusionOrder(bytes32 orderId, bytes32 secret) external payable",
  "function cancelFusionOrder(bytes32 orderId) external",
  "function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)",
  "function isOrderActive(bytes32 orderId) external view returns (bool)",
  "function getActiveOrderIds() external view returns (bytes32[])",
  "function getOrderIdByHashlock(bytes32 hashlock) external view returns (bytes32)"
];

// Get contract instance
function getContract() {
  const contractAddress = process.env.VITE_FUSION_HTLC_ADDRESS || '0x0000000000000000000000000000000000000000';
  
  if (typeof window !== 'undefined' && window.ethereum) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(contractAddress, FUSION_HTLC_ABI, provider);
  }
  
  throw new Error('No ethereum provider available');
}

// Get contract with signer for write operations
async function getContractWithSigner() {
  const contractAddress = process.env.VITE_FUSION_HTLC_ADDRESS || '0x0000000000000000000000000000000000000000';
  
  if (typeof window !== 'undefined' && window.ethereum) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(contractAddress, FUSION_HTLC_ABI, signer);
  }
  
  throw new Error('No ethereum provider available');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case 'create-order':
        const order = await createFusionOrder(params);
        return new Response(JSON.stringify(order), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });

      case 'create-swap':
        const swap = await createCrossChainSwap(params);
        return new Response(JSON.stringify(swap), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });

      case 'get-order':
        const orderStatus = await getFusionOrderStatus(params.orderId);
        return new Response(JSON.stringify(orderStatus), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });

      case 'execute-order':
        const result = await executeFusionOrder(params.orderId, params.secret);
        return new Response(JSON.stringify({ success: result }), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });

      case 'cancel-order':
        const cancelled = await cancelFusionOrder(params.orderId);
        return new Response(JSON.stringify({ success: cancelled }), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// Real blockchain functions
async function createFusionOrder(params: any): Promise<FusionOrder> {
  const { randomBytes, createHash } = await import('crypto');
  
  const secret = randomBytes(32);
  const hashlock = createHash('sha256').update(secret).digest('hex');
  const timelock = params.timelock || Math.floor(Date.now() / 1000) + 3600;
  const orderId = ethers.keccak256(ethers.toUtf8Bytes(`fusion-${Date.now()}-${Math.random()}`));

  const ethAmount = ethers.parseEther(params.ethAmount);
  const btcAmount = ethers.parseEther(params.btcAmount);
  
  const makerAsset = params.direction === 'eth2btc' ? 'ETH' : 'BTC';
  const takerAsset = params.direction === 'eth2btc' ? 'BTC' : 'ETH';
  const makerAmount = params.direction === 'eth2btc' ? ethAmount : btcAmount;
  const takerAmount = params.direction === 'eth2btc' ? btcAmount : ethAmount;

  // Get contract with signer for write operations
  const contract = await getContractWithSigner();

  // Create the order on blockchain
  const tx = await contract.createFusionOrder(
    orderId,
    makerAsset,
    takerAsset,
    makerAmount,
    takerAmount,
    timelock,
    `0x${hashlock}`,
    { value: makerAmount }
  );

  // Wait for transaction confirmation
  const receipt = await tx.wait();

  const orderData = {
    orderId: orderId,
    makerAsset,
    takerAsset,
    makerAmount: ethers.formatEther(makerAmount),
    takerAmount: ethers.formatEther(takerAmount),
    makerAddress: params.direction === 'eth2btc' ? params.ethAddress : params.btcAddress,
    takerAddress: params.direction === 'eth2btc' ? params.btcAddress : params.ethAddress,
    hashlock: `0x${hashlock}`,
    timelock,
    secret: secret.toString('hex'),
    status: 'open' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    txHash: tx.hash,
    blockNumber: receipt.blockNumber
  };

  return orderData;
}

async function createCrossChainSwap(params: any): Promise<CrossChainSwap> {
  const fusionOrder = await createFusionOrder(params);
  
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

  return swapData;
}

async function getFusionOrderStatus(orderId: string): Promise<FusionOrder> {
  const contract = getContract();
  
  try {
    const order = await contract.getFusionOrder(orderId);
    const isActive = await contract.isOrderActive(orderId);
    
    return {
      orderId: order[0],
      makerAsset: order[2],
      takerAsset: order[3],
      makerAmount: ethers.formatEther(order[4]),
      takerAmount: ethers.formatEther(order[5]),
      makerAddress: order[1],
      takerAddress: '', // Not stored in contract
      hashlock: order[7],
      timelock: order[6].toNumber(),
      secret: '', // Secret not stored on blockchain
      status: isActive ? 'open' : 'filled',
      createdAt: order[10].toNumber() * 1000,
      updatedAt: Date.now(),
    };
  } catch (error) {
    throw new Error(`Failed to get order status: ${(error as Error).message}`);
  }
}

async function executeFusionOrder(orderId: string, secret: string): Promise<boolean> {
  const readContract = getContract();
  const writeContract = await getContractWithSigner();
  
  try {
    // Get order details to determine amount
    const order = await readContract.getFusionOrder(orderId);
    const takerAmount = order[5]; // takerAmount
    
    const tx = await writeContract.matchFusionOrder(orderId, secret, { value: takerAmount });
    await tx.wait();
    
    return true;
  } catch (error) {
    throw new Error(`Failed to execute order: ${(error as Error).message}`);
  }
}

async function cancelFusionOrder(orderId: string): Promise<boolean> {
  const writeContract = await getContractWithSigner();
  
  try {
    const tx = await writeContract.cancelFusionOrder(orderId);
    await tx.wait();
    
    return true;
  } catch (error) {
    throw new Error(`Failed to cancel order: ${(error as Error).message}`);
  }
} 