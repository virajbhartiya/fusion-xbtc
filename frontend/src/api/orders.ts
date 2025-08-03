// Orders API with real blockchain integration
import { ethers } from 'ethers';

// Contract ABI for Fusion+ HTLC
const FUSION_HTLC_ABI = [
  "function getActiveOrderIds() external view returns (bytes32[])",
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
    const action = searchParams.get('action');

    if (action === 'list') {
      const orders = await getActiveOrders();
      return new Response(JSON.stringify(orders), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, orderId } = body;

    if (action === 'get') {
      const order = await getOrderById(orderId);
      return new Response(JSON.stringify(order), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// Real blockchain functions
async function getActiveOrders() {
  try {
    const contract = getContract();
    const activeOrderIds = await contract.getActiveOrderIds();
    const orders = [];

    for (const orderId of activeOrderIds) {
      try {
        const order = await contract.getFusionOrder(orderId);
        const isActive = await contract.isOrderActive(orderId);

        orders.push({
          orderId: order[0],
          maker: order[1],
          makerAsset: order[2],
          takerAsset: order[3],
          makerAmount: ethers.formatEther(order[4]),
          takerAmount: ethers.formatEther(order[5]),
          timelock: new Date(order[6].toNumber() * 1000).toISOString(),
          hashlock: order[7],
          isActive: order[8],
          isMatched: order[9],
          createdAt: new Date(order[10].toNumber() * 1000).toISOString(),
          status: isActive ? 'active' : 'inactive'
        });
      } catch (error) {
        console.error(`Error fetching order ${orderId}:`, error);
      }
    }

    return orders;
  } catch (error) {
    throw new Error(`Failed to get active orders: ${(error as Error).message}`);
  }
}

async function getOrderById(orderId: string) {
  try {
    const contract = getContract();
    const order = await contract.getFusionOrder(orderId);
    const isActive = await contract.isOrderActive(orderId);

    return {
      orderId: order[0],
      maker: order[1],
      makerAsset: order[2],
      takerAsset: order[3],
      makerAmount: ethers.formatEther(order[4]),
      takerAmount: ethers.formatEther(order[5]),
      timelock: new Date(order[6].toNumber() * 1000).toISOString(),
      hashlock: order[7],
      isActive: order[8],
      isMatched: order[9],
      createdAt: new Date(order[10].toNumber() * 1000).toISOString(),
      status: isActive ? 'active' : 'inactive'
    };
  } catch (error) {
    throw new Error(`Failed to get order: ${(error as Error).message}`);
  }
} 