# Fusion XBTC Relayer

The Fusion XBTC Relayer is a cross-chain monitoring and execution system that automatically coordinates HTLC (Hashed Timelock Contract) operations between Bitcoin and Ethereum blockchains.

## Features

- **Cross-Chain Monitoring**: Monitors both Bitcoin and Ethereum blockchains for HTLC events
- **Automatic Execution**: Triggers cross-chain actions when events are detected
- **Order Management**: Tracks and manages HTLC swap orders with full audit trail
- **Partial Fill Support**: Handles partial fills for large orders
- **Error Recovery**: Robust error handling and retry mechanisms
- **Real-time Logging**: Comprehensive logging with different levels
- **Configuration Management**: Environment-specific configurations

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Bitcoin       │    │   Ethereum      │    │   Order         │
│   Relayer       │    │   Relayer       │    │   Manager       │
│                 │    │                 │    │                 │
│ • Block Polling │    │ • Event Polling │    │ • Order Storage │
│ • HTLC Detection│    │ • Contract Calls│    │ • Status Updates│
│ • Transaction   │    │ • Gas Estimation│    │ • Backup        │
│   Building      │    │ • Broadcasting  │    │ • Validation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Event         │
                    │   Processor     │
                    │                 │
                    │ • Cross-chain   │
                    │   Coordination  │
                    │ • Action        │
                    │   Triggering    │
                    │ • Error Handling│
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Resolvers     │
                    │                 │
                    │ • Bitcoin       │
                    │   Resolver      │
                    │ • Ethereum      │
                    │   Resolver      │
                    └─────────────────┘
```

## Components

### 1. Bitcoin Relayer (`bitcoin-relayer.ts`)
- Connects to Electrum servers for Bitcoin blockchain access
- Polls for new blocks and transactions
- Detects HTLC-related transactions (locks, redeems, refunds)
- Parses Bitcoin scripts and extracts relevant data

### 2. Ethereum Relayer (`ethereum-relayer.ts`)
- Connects to Ethereum RPC endpoints
- Monitors HTLC smart contract events
- Parses contract logs for lock, redeem, and refund events
- Handles gas estimation and transaction broadcasting

### 3. Event Processor (`event-processor.ts`)
- Coordinates cross-chain actions
- Manages event deduplication and processing
- Triggers appropriate resolvers based on events
- Maintains processing state and error handling

### 4. Order Manager (`order-manager.ts`)
- Stores and manages HTLC swap orders
- Tracks order status and transaction details
- Provides order querying and filtering
- Handles backup and recovery

### 5. Resolvers
- **Bitcoin Resolver**: Executes Bitcoin transactions (redeems, refunds)
- **Ethereum Resolver**: Executes Ethereum contract calls (redeems, refunds)

### 6. Logger (`logger.ts`)
- Structured logging with different levels
- Specialized logging for relayer events
- Performance monitoring and metrics

## Installation

1. **Install Dependencies**
   ```bash
   cd relayer
   npm install
   ```

2. **Configuration**
   ```bash
   cp config.example.ts config.ts
   # Edit config.ts with your settings
   ```

3. **Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

## Configuration

### Bitcoin Configuration
```typescript
bitcoin: {
  network: 'testnet', // 'mainnet' | 'testnet'
  electrumHost: 'testnet.hsmiths.com',
  electrumPort: 53011,
  electrumProto: 'ssl', // 'ssl' | 'tcp'
  pollInterval: 30000, // 30 seconds
}
```

### Ethereum Configuration
```typescript
ethereum: {
  network: 'sepolia', // 'mainnet' | 'sepolia' | 'goerli'
  rpcUrl: 'https://1rpc.io/sepolia',
  contractAddress: '0x03350065C0eAa7AD4410F72806E29AFDbC64A410',
  pollInterval: 15000, // 15 seconds
  privateKey: 'your-private-key', // For executing transactions
}
```

### Order Management
```typescript
orders: {
  dataDir: './examples/swaps',
  backupInterval: 300000, // 5 minutes
}
```

## Usage

### Starting the Relayer
```bash
# Development mode
npm run dev

# Production mode
npm start

# With specific environment
NODE_ENV=production npm start
```

### API Usage
```typescript
import { Relayer } from './index';

const relayer = new Relayer(config);
await relayer.start();

// Get status
const status = relayer.getStatus();
console.log(status);

// Stop relayer
await relayer.stop();
```

### Order Management
```typescript
import { OrderManager } from './order-manager';

const orderManager = new OrderManager('./data/orders');
await orderManager.initialize();

// Get all orders
const orders = await orderManager.getAllOrders();

// Find orders by hashlock
const orders = await orderManager.findOrdersByHashlock(hashlock);

// Update order status
await orderManager.updateOrderStatus(orderId, {
  status: 'btc_locked',
  btcLockTx: txHash,
  btcLockBlock: blockHeight,
});
```

## Event Flow

### 1. Bitcoin Lock Detected
```
Bitcoin Relayer → Event Processor → Order Manager
     ↓
Update Order Status → Trigger Ethereum Lock
```

### 2. Ethereum Lock Detected
```
Ethereum Relayer → Event Processor → Order Manager
     ↓
Update Order Status → Trigger Bitcoin Lock
```

### 3. Bitcoin Redeem Detected
```
Bitcoin Relayer → Event Processor → Order Manager
     ↓
Extract Secret → Trigger Ethereum Redeem
```

### 4. Ethereum Redeem Detected
```
Ethereum Relayer → Event Processor → Order Manager
     ↓
Extract Secret → Trigger Bitcoin Redeem
```

## Monitoring

### Status Endpoints
```typescript
// Get overall relayer status
const status = relayer.getStatus();

// Get Bitcoin relayer status
const btcStatus = bitcoinRelayer.getStatus();

// Get Ethereum relayer status
const ethStatus = ethereumRelayer.getStatus();

// Get order statistics
const orderStats = orderManager.getOrderStats();
```

### Logging
```typescript
// Set log level
logger.setLogLevel('debug');

// Specialized logging
logger.logBitcoinEvent(event);
logger.logEthereumEvent(event);
logger.logOrderUpdate(orderId, oldStatus, newStatus);
logger.logCrossChainAction(action);
```

## Error Handling

### Automatic Retry
- Failed transactions are retried with exponential backoff
- Network disconnections trigger automatic reconnection
- Invalid events are logged and skipped

### Manual Recovery
```typescript
// Check for expired orders
const expiredOrders = await orderManager.getExpiredOrders();

// Get orders needing action
const pendingOrders = await orderManager.getOrdersNeedingAction();

// Export orders for backup
const orders = await orderManager.exportOrders();
```

## Security Considerations

### Private Key Management
- Store private keys securely (use environment variables)
- Use separate wallets for different operations
- Regularly rotate keys

### Network Security
- Use secure RPC endpoints (HTTPS/WSS)
- Validate all incoming data
- Implement rate limiting

### Order Validation
- Validate all order data before processing
- Check transaction signatures
- Verify hashlock consistency

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Formatting
```bash
npm run format
```

### Building
```bash
npm run build
```

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

### Environment Variables
```bash
# Required
BITCOIN_NETWORK=testnet
ETHEREUM_NETWORK=sepolia
ETHEREUM_PRIVATE_KEY=your-private-key
BITCOIN_WIF=your-bitcoin-wif

# Optional
LOG_LEVEL=info
ORDERS_DATA_DIR=/data/orders
```

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Check network connectivity
   - Verify RPC endpoint URLs
   - Increase timeout values

2. **Transaction Failures**
   - Check wallet balances
   - Verify gas prices
   - Check transaction parameters

3. **Order Sync Issues**
   - Restart order manager
   - Check file permissions
   - Verify data directory

### Debug Mode
```bash
LOG_LEVEL=debug npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details. 