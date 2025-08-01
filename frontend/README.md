# Fusion+ Bridge Frontend

A modern, responsive web interface for cross-chain atomic swaps between Ethereum and UTXO-based cryptocurrencies.

## Features

### 🎨 Modern Design
- **Dark Theme**: Sleek dark interface with cyan accents
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Tabbed Interface**: Clean separation between swap creation and status monitoring
- **Smooth Animations**: Subtle transitions and hover effects

### 🔗 Wallet Integration
- **MetaMask**: Seamless Ethereum wallet connection
- **UTXO Wallets**: Support for Unisat, Hiro, and Xverse
- **Multi-Chain**: Bitcoin, Litecoin, Dogecoin, and Bitcoin Cash

### ⚡ Real-Time Features
- **Live Status Updates**: Automatic polling of swap status
- **Transaction Tracking**: Direct links to blockchain explorers
- **Error Handling**: Clear error messages and validation

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **CSS3** with modern features (Grid, Flexbox, Custom Properties)
- **Ethers.js** for Ethereum interactions
- **BitcoinJS** for UTXO chain operations

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start full stack (frontend + backend)
npm run dev:full

# Build for production
npm run build
```

### Environment Variables

Create a `.env` file in the frontend directory:

```env
# Frontend Configuration
VITE_ETH_HTLC_ADDRESS=your_deployed_htlc_contract_address
VITE_UNISAT_PUBKEY=your_unisat_public_key

# Fusion+ Integration
VITE_FUSION_API_BASE_URL=https://fusion.1inch.io
VITE_FUSION_API_KEY=your_1inch_fusion_api_key
VITE_FUSION_HTLC_ADDRESS=your_deployed_fusion_htlc_contract_address

# Backend Configuration (for full stack)
FUSION_API_KEY=your_1inch_fusion_api_key
ETH_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_alchemy_key
ETH_PRIVATE_KEY=your_ethereum_private_key
ETH_CONTRACT_ADDRESS=your_deployed_htlc_contract_address
BTC_PRIVATE_KEY=your_bitcoin_private_key
```

## Usage

### Creating a Swap

1. **Connect Wallet**: Click "Connect MetaMask" or "Connect Wallet" based on swap direction
2. **Select Direction**: Choose ETH → UTXO or UTXO → ETH
3. **Choose Chain**: Select Bitcoin, Litecoin, Dogecoin, or Bitcoin Cash
4. **Enter Details**: Fill in amount, recipient address, and timelock
5. **Fusion+ Integration**: Toggle "Use Fusion+ Protocol" for 1inch integration
6. **Create Swap**: Click "Create Swap" or "Create Fusion+ Order" to generate the atomic swap

### Monitoring Status

1. **Switch to Status Tab**: View real-time swap information
2. **Track Progress**: Monitor lock, redeem, and refund operations
3. **View Transactions**: Click explorer links to see on-chain transactions
4. **Execute Actions**: Use action buttons to lock, redeem, or refund funds

### Fusion+ Order Management

1. **Browse Orders**: Click "Browse Available Orders" to see existing Fusion+ orders
2. **Select Order**: Choose an order to match with your swap
3. **Match Orders**: Execute cross-chain order matching
4. **Monitor Status**: Track order status and execution progress
5. **On-Chain Operations**: Create, match, and cancel orders directly on the blockchain

## Design System

### Colors
- **Primary**: `#00d4ff` (Cyan)
- **Background**: `#0a0a0a` (Dark)
- **Surface**: `#1a1a1a` (Card background)
- **Border**: `#2a2a2a` (Subtle borders)
- **Text**: `#ffffff` (White text)

### Typography
- **Font**: Inter (System fallbacks)
- **Monospace**: Monaco/Menlo for addresses and code
- **Weights**: 400 (Regular), 600 (Semi-bold), 700 (Bold)

### Components
- **Cards**: Rounded corners with subtle shadows
- **Buttons**: Gradient backgrounds with hover effects
- **Forms**: Clean inputs with focus states
- **Tabs**: Active state with gradient background

## API Integration

The frontend communicates with the backend API for:
- Swap creation and management
- Fund locking and redemption
- Status tracking and monitoring
- Error handling and validation

### API Endpoints
- `POST /api/swap` - Create new swap
- `POST /api/lock` - Lock funds in HTLC
- `POST /api/redeem` - Redeem funds with secret
- `POST /api/refund` - Refund funds after timeout
- `GET /api/track` - Get swap status
- `POST /api/fusion` - Fusion+ integration (create orders, get status, execute matches)
- `GET /api/orders` - Fusion+ order management (list orders, get order details)

## Browser Support

- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## Development

### Project Structure
```
src/
├── App.tsx          # Main application component
├── App.css          # Global styles and component styles
├── main.tsx         # Application entry point
├── index.css        # Base styles and resets
└── api/             # API route handlers
    ├── swap.ts
    ├── lock.ts
    ├── redeem.ts
    ├── refund.ts
    └── track.ts
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run dev:full` - Start frontend + backend
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
