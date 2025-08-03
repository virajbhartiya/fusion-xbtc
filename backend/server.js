const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { randomBytes, createHash } = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Blockchain configuration
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://eth-goerli.g.alchemy.com/v2/your-api-key';
const CONTRACT_ADDRESS = process.env.FUSION_HTLC_ADDRESS;
const PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY;
const FUSION_API_KEY = process.env.FUSION_API_KEY;

// Fusion+ HTLC contract ABI (minimal for API operations)
const FUSION_HTLC_ABI = [
  "function createFusionOrder(bytes32 orderId, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock, bytes32 hashlock) external payable",
  "function matchFusionOrder(bytes32 orderId, bytes32 secret) external payable",
  "function cancelFusionOrder(bytes32 orderId) external",
  "function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)",
  "function isOrderActive(bytes32 orderId) external view returns (bool)",
  "function getActiveOrderIds() external view returns (bytes32[])",
  "event FusionOrderCreated(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed maker, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock)",
  "event FusionOrderMatched(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed taker, uint256 executedAmount)",
  "event FusionOrderCancelled(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed maker)"
];

// Initialize blockchain provider and contract
let provider, wallet, contract;

try {
  provider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL);
  if (PRIVATE_KEY) {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, FUSION_HTLC_ABI, wallet);
  }
} catch (error) {
  console.error('Failed to initialize blockchain connection:', error);
}

// In-memory order storage (in production, use a database)
let orders = [];

// Helper function to validate required environment variables
function validateConfig() {
  const required = ['FUSION_HTLC_ADDRESS', 'ETHEREUM_PRIVATE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Helper function to handle blockchain errors
function handleBlockchainError(error) {
  console.error('Blockchain error:', error);
  
  if (error.code === 'INSUFFICIENT_FUNDS') {
    return { error: 'Insufficient funds for transaction' };
  }
  if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
    return { error: 'Transaction would fail - check parameters' };
  }
  if (error.message.includes('nonce')) {
    return { error: 'Transaction nonce error - try again' };
  }
  
  return { error: error.message || 'Blockchain transaction failed' };
}

// API Routes
app.get('/api/orders', async (req, res) => {
  const { action } = req.query;
  
  if (action === 'list') {
    try {
      if (!contract) {
        return res.status(500).json({ error: 'Blockchain not configured' });
      }
      
      const activeOrderIds = await contract.getActiveOrderIds();
      const activeOrders = [];
      
      for (const orderId of activeOrderIds) {
        try {
          const order = await contract.getFusionOrder(orderId);
          const isActive = await contract.isOrderActive(orderId);
          
          activeOrders.push({
            orderId: order[0],
            maker: order[1],
            makerAsset: order[2],
            takerAsset: order[3],
            makerAmount: ethers.formatEther(order[4]),
            takerAmount: ethers.formatEther(order[5]),
            timelock: new Date(order[6] * 1000).toISOString(),
            hashlock: order[7],
            isActive: order[8],
            isMatched: order[9],
            createdAt: new Date(order[10] * 1000).toISOString(),
            status: isActive ? 'active' : 'inactive'
          });
        } catch (error) {
          console.error(`Error fetching order ${orderId}:`, error);
        }
      }
      
      res.json(activeOrders);
    } catch (error) {
      console.error('Error listing orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  
  try {
    if (!contract) {
      return res.status(500).json({ error: 'Blockchain not configured' });
    }
    
    const order = await contract.getFusionOrder(orderId);
    const isActive = await contract.isOrderActive(orderId);
    
    const orderData = {
      orderId: order[0],
      maker: order[1],
      makerAsset: order[2],
      takerAsset: order[3],
      makerAmount: ethers.formatEther(order[4]),
      takerAmount: ethers.formatEther(order[5]),
      timelock: new Date(order[6] * 1000).toISOString(),
      hashlock: order[7],
      isActive: order[8],
      isMatched: order[9],
      createdAt: new Date(order[10] * 1000).toISOString(),
      status: isActive ? 'active' : 'inactive'
    };
    
    res.json(orderData);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(404).json({ error: 'Order not found' });
  }
});

app.post('/api/fusion', async (req, res) => {
  const { action, ...data } = req.body;
  
  try {
    validateConfig();
    
    if (!contract) {
      return res.status(500).json({ error: 'Blockchain not configured' });
    }
    
    switch (action) {
      case 'create-order':
        const orderId = ethers.keccak256(ethers.toUtf8Bytes(`fusion-${Date.now()}-${Math.random()}`));
        const secret = randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const timelock = Math.floor(Date.now() / 1000) + parseInt(data.timelock || '3600');
        
        const ethAmount = ethers.parseEther(data.ethAmount);
        const btcAmount = ethers.parseEther(data.btcAmount);
        
        const makerAsset = data.direction === 'eth2btc' ? 'ETH' : 'BTC';
        const takerAsset = data.direction === 'eth2btc' ? 'BTC' : 'ETH';
        const makerAmount = data.direction === 'eth2btc' ? ethAmount : btcAmount;
        const takerAmount = data.direction === 'eth2btc' ? btcAmount : ethAmount;
        
        console.log('Creating Fusion+ order on blockchain...');
        const tx = await contract.createFusionOrder(
          orderId,
          makerAsset,
          takerAsset,
          makerAmount,
          takerAmount,
          timelock,
          hashlock,
          { value: makerAmount }
        );
        
        console.log('Waiting for transaction confirmation...');
        const receipt = await tx.wait();
        
        const newOrder = {
          orderId: orderId,
          direction: data.direction,
          makerAsset,
          takerAsset,
          makerAmount: ethers.formatEther(makerAmount),
          takerAmount: ethers.formatEther(takerAmount),
          ethAddress: data.ethAddress,
          btcAddress: data.btcAddress,
          hashlock,
          secret: secret.toString('hex'),
          timelock,
          status: 'active',
          createdAt: Date.now(),
          txHash: tx.hash,
          blockNumber: receipt.blockNumber
        };
        
        orders.push(newOrder);
        res.json(newOrder);
        break;
        
      case 'get-order':
        const order = await contract.getFusionOrder(data.orderId);
        const isActive = await contract.isOrderActive(data.orderId);
        
        const orderData = {
          orderId: order[0],
          maker: order[1],
          makerAsset: order[2],
          takerAsset: order[3],
          makerAmount: ethers.formatEther(order[4]),
          takerAmount: ethers.formatEther(order[5]),
          timelock: new Date(order[6] * 1000).toISOString(),
          hashlock: order[7],
          isActive: order[8],
          isMatched: order[9],
          createdAt: new Date(order[10] * 1000).toISOString(),
          status: isActive ? 'active' : 'inactive'
        };
        
        res.json(orderData);
        break;
        
      case 'execute-order':
        const targetOrder = await contract.getFusionOrder(data.orderId);
        const targetIsActive = await contract.isOrderActive(data.orderId);
        
        if (!targetIsActive) {
          return res.status(400).json({ error: 'Order is not active' });
        }
        
        // For matching, we need the secret
        if (!data.secret) {
          return res.status(400).json({ error: 'Secret is required for order execution' });
        }
        
        const matchEthAmount = ethers.parseEther(data.ethAmount);
        const tx2 = await contract.matchFusionOrder(data.orderId, data.secret, { value: matchEthAmount });
        const receipt2 = await tx2.wait();
        
        res.json({ 
          success: true, 
          orderId: data.orderId, 
          txHash: tx2.hash,
          blockNumber: receipt2.blockNumber
        });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('API error:', error);
    const errorResponse = handleBlockchainError(error);
    res.status(500).json(errorResponse);
  }
});

app.get('/api/track', async (req, res) => {
  const { hashlock } = req.query;
  
  try {
    if (!contract) {
      return res.status(500).json({ error: 'Blockchain not configured' });
    }
    
    // Find order by hashlock
    const orderId = await contract.getOrderIdByHashlock(hashlock);
    if (orderId === ethers.ZeroHash) {
      return res.status(404).json({ error: 'Hashlock not found' });
    }
    
    const order = await contract.getFusionOrder(orderId);
    const isActive = await contract.isOrderActive(orderId);
    
    res.json({
      hashlock,
      orderId: order[0],
      status: isActive ? 'active' : 'inactive',
      isMatched: order[9],
      timelock: new Date(order[6] * 1000).toISOString(),
      createdAt: new Date(order[10] * 1000).toISOString()
    });
  } catch (error) {
    console.error('Error tracking hashlock:', error);
    res.status(500).json({ error: 'Failed to track hashlock' });
  }
});

// Health check
app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    blockchain: {
      connected: !!provider,
      contract: !!contract,
      address: CONTRACT_ADDRESS || 'not configured'
    },
    environment: {
      rpcUrl: ETHEREUM_RPC_URL ? 'configured' : 'not configured',
      privateKey: PRIVATE_KEY ? 'configured' : 'not configured',
      fusionApiKey: FUSION_API_KEY ? 'configured' : 'not configured'
    }
  };
  
  res.json(status);
});

app.listen(PORT, () => {
  console.log(`🚀 Fusion XBTC Backend API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Blockchain: ${provider ? 'Connected' : 'Not connected'}`);
  console.log(`📝 Contract: ${contract ? 'Initialized' : 'Not initialized'}`);
}); 