const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
let orders = [
  {
    id: '1',
    orderId: '0x1234567890abcdef',
    status: 'open',
    direction: 'eth2btc',
    ethAmount: '0.1',
    btcAmount: '0.001',
    ethAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    btcAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    timelock: Math.floor(Date.now() / 1000) + 3600
  }
];

// API Routes
app.get('/api/orders', (req, res) => {
  const { action } = req.query;
  
  if (action === 'list') {
    res.json(orders);
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = orders.find(o => o.orderId === orderId);
  
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

app.post('/api/fusion', (req, res) => {
  const { action, ...data } = req.body;
  
  switch (action) {
    case 'create-order':
      const newOrder = {
        id: (orders.length + 1).toString(),
        orderId: '0x' + Math.random().toString(16).substr(2, 16),
        status: 'open',
        ...data
      };
      orders.push(newOrder);
      res.json(newOrder);
      break;
      
    case 'get-order':
      const order = orders.find(o => o.orderId === data.orderId);
      if (order) {
        res.json(order);
      } else {
        res.status(404).json({ error: 'Order not found' });
      }
      break;
      
    case 'execute-order':
      const targetOrder = orders.find(o => o.orderId === data.orderId);
      if (targetOrder) {
        targetOrder.status = 'filled';
        res.json({ success: true, order: targetOrder });
      } else {
        res.status(404).json({ error: 'Order not found' });
      }
      break;
      
    default:
      res.status(400).json({ error: 'Invalid action' });
  }
});

app.get('/api/track', (req, res) => {
  const { hashlock } = req.query;
  
  // Mock tracking data
  res.json({
    hashlock,
    status: 'pending',
    ethTx: null,
    btcTx: null,
    timestamp: Date.now()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
}); 