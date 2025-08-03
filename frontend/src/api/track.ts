// Track API with real blockchain integration
import { ethers } from 'ethers';

// Contract ABI for Fusion+ HTLC
const FUSION_HTLC_ABI = [
  "function getOrderIdByHashlock(bytes32 hashlock) external view returns (bytes32)",
  "function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)",
  "function isOrderActive(bytes32 orderId) external view returns (bool)"
];

// Get contract instance for read operations
function getContract() {
  const contractAddress = process.env.VITE_FUSION_HTLC_ADDRESS || '0x0000000000000000000000000000000000000000';
  
  if (typeof window !== 'undefined' && window.ethereum) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(contractAddress, FUSION_HTLC_ABI, provider);
  }
  
  throw new Error('No ethereum provider available');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hashlock = searchParams.get('hashlock');

    if (!hashlock) {
      return new Response(JSON.stringify({ error: 'Missing hashlock parameter' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const trackingData = await trackHashlock(hashlock);
    return new Response(JSON.stringify(trackingData), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// Real blockchain tracking function
async function trackHashlock(hashlock: string) {
  try {
    const contract = getContract();
    
    // Find order by hashlock
    const orderId = await contract.getOrderIdByHashlock(hashlock);
    
    if (orderId === ethers.ZeroHash) {
      return {
        hashlock,
        status: 'not_found',
        message: 'Hashlock not found on blockchain'
      };
    }

    // Get order details
    const order = await contract.getFusionOrder(orderId);
    const isActive = await contract.isOrderActive(orderId);

    return {
      hashlock,
      orderId: order[0],
      status: isActive ? 'active' : 'inactive',
      isMatched: order[9],
      maker: order[1],
      makerAsset: order[2],
      takerAsset: order[3],
      makerAmount: ethers.formatEther(order[4]),
      takerAmount: ethers.formatEther(order[5]),
      timelock: new Date(order[6].toNumber() * 1000).toISOString(),
      createdAt: new Date(order[10].toNumber() * 1000).toISOString(),
      message: isActive ? 'Order is active and available for matching' : 'Order is no longer active'
    };
  } catch (error) {
    throw new Error(`Failed to track hashlock: ${(error as Error).message}`);
  }
} 