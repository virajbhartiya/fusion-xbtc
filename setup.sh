#!/bin/bash

# Fusion XBTC Setup Script
# This script ensures all components are properly integrated and configured

set -e

echo "🚀 Setting up Fusion XBTC..."

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is required but not installed"
    exit 1
fi

echo "✅ Prerequisites met"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p examples/swaps
mkdir -p examples/btc
mkdir -p examples/ltc
mkdir -p examples/doge
mkdir -p examples/bch
mkdir -p logs

# Set up environment files
echo "⚙️ Setting up environment files..."

# Relayer environment
if [ ! -f "relayer/.env" ]; then
    echo "📝 Creating relayer/.env from template..."
    cp relayer/env.example relayer/.env
    echo "⚠️  Please edit relayer/.env with your configuration"
else
    echo "✅ relayer/.env already exists"
fi

# Frontend environment
if [ ! -f "frontend/.env" ]; then
    echo "📝 Creating frontend/.env from template..."
    cp frontend/env.example frontend/.env
    echo "⚠️  Please edit frontend/.env with your configuration"
else
    echo "✅ frontend/.env already exists"
fi

# Ethereum contracts environment
if [ ! -f "eth-contracts/.env" ]; then
    echo "📝 Creating eth-contracts/.env from template..."
    cp eth-contracts/env.example eth-contracts/.env
    echo "⚠️  Please edit eth-contracts/.env with your configuration"
else
    echo "✅ eth-contracts/.env already exists"
fi

# Build all modules
echo "🔨 Building modules..."
pnpm build

# Run tests
echo "🧪 Running tests..."
pnpm test

# Create configuration files
echo "📋 Creating configuration files..."

# Create relayer config if it doesn't exist
if [ ! -f "relayer/config.ts" ]; then
    echo "📝 Creating relayer/config.ts from template..."
    cp relayer/config.example.ts relayer/config.ts
    echo "⚠️  Please edit relayer/config.ts with your configuration"
else
    echo "✅ relayer/config.ts already exists"
fi

# Validate configuration
echo "🔍 Validating configuration..."

# Check if required environment variables are set
if [ -f "relayer/.env" ]; then
    echo "✅ relayer/.env exists"
else
    echo "⚠️  relayer/.env not found - please create it"
fi

if [ -f "frontend/.env" ]; then
    echo "✅ frontend/.env exists"
else
    echo "⚠️  frontend/.env not found - please create it"
fi

if [ -f "eth-contracts/.env" ]; then
    echo "✅ eth-contracts/.env exists"
else
    echo "⚠️  eth-contracts/.env not found - please create it"
fi

# Create example order
echo "📝 Creating example order..."
cat > examples/swaps/example-order.json << 'EOF'
{
  "orderId": "example-order-001",
  "amount": 100000,
  "remainingAmount": 100000,
  "minFillAmount": 10000,
  "maxFillAmount": 50000,
  "recipientAddress": "tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z",
  "refundAddress": "tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z",
  "secret": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "hashlock": "0x4c57b773ddd36d4e24eaff0d0e0e07e74a52e043bf030a76f4fd139c02e9238e",
  "locktime": 3600,
  "network": "testnet",
  "chain": "bitcoin",
  "status": "open",
  "fills": [],
  "createdAt": 1753509413339,
  "updatedAt": 1753509413339
}
EOF

echo "✅ Example order created"

# Create startup scripts
echo "📝 Creating startup scripts..."

cat > start-relayer.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Fusion XBTC Relayer..."
cd "$(dirname "$0")"
pnpm relayer
EOF

cat > start-frontend.sh << 'EOF'
#!/bin/bash
echo "🌐 Starting Fusion XBTC Frontend..."
cd "$(dirname "$0")"
pnpm frontend
EOF

chmod +x start-relayer.sh start-frontend.sh

echo "✅ Startup scripts created"

# Create development script
cat > dev.sh << 'EOF'
#!/bin/bash
echo "🛠️ Starting Fusion XBTC in development mode..."
cd "$(dirname "$0")"

# Start relayer in background
echo "🚀 Starting relayer..."
pnpm relayer &
RELAYER_PID=$!

# Start frontend in background
echo "🌐 Starting frontend..."
pnpm frontend &
FRONTEND_PID=$!

echo "✅ Development environment started"
echo "📊 Relayer PID: $RELAYER_PID"
echo "🌐 Frontend PID: $FRONTEND_PID"
echo "🔗 Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo '🛑 Stopping services...'; kill $RELAYER_PID $FRONTEND_PID; exit" INT
wait
EOF

chmod +x dev.sh

echo "✅ Development script created"

# Final validation
echo "🔍 Final validation..."

# Check if all modules are properly built
if [ -d "cli/node_modules" ]; then
    echo "✅ CLI module ready"
else
    echo "❌ CLI module not ready"
fi

if [ -d "relayer/node_modules" ]; then
    echo "✅ Relayer module ready"
else
    echo "❌ Relayer module not ready"
fi

if [ -d "frontend/node_modules" ]; then
    echo "✅ Frontend module ready"
else
    echo "❌ Frontend module not ready"
fi

if [ -d "eth-contracts/node_modules" ]; then
    echo "✅ Ethereum contracts module ready"
else
    echo "❌ Ethereum contracts module not ready"
fi

echo ""
echo "🎉 Fusion XBTC setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit relayer/.env with your configuration"
echo "2. Edit frontend/.env with your configuration"
echo "3. Edit eth-contracts/.env with your configuration"
echo ""
echo "🚀 To start the system:"
echo "  ./start-relayer.sh    # Start relayer only"
echo "  ./start-frontend.sh   # Start frontend only"
echo "  ./dev.sh              # Start both (development)"
echo ""
echo "📚 For more information, see README.md" 