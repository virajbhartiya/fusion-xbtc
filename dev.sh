#!/bin/bash
echo "🛠️ Starting Fusion XBTC in development mode..."
cd "$(dirname "$0")"

# Start relayer in background
echo "🚀 Starting relayer..."
cd relayer && pnpm start &
RELAYER_PID=$!

# Wait a moment to see if relayer starts successfully
sleep 2
if ! kill -0 $RELAYER_PID 2>/dev/null; then
    echo "⚠️  Relayer failed to start (needs real ETHEREUM_PRIVATE_KEY)"
    RELAYER_PID=""
fi

# Wait a moment for relayer to start
sleep 3

# Start frontend in background
echo "🌐 Starting frontend..."
cd frontend && pnpm dev &
FRONTEND_PID=$!

echo "✅ Development environment started"
if [ ! -z "$RELAYER_PID" ]; then
    echo "📊 Relayer PID: $RELAYER_PID"
else
    echo "📊 Relayer: Not running (needs real ETHEREUM_PRIVATE_KEY)"
fi
echo "🌐 Frontend PID: $FRONTEND_PID"
echo "🔗 Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo '🛑 Stopping services...'; [ ! -z '$RELAYER_PID' ] && kill $RELAYER_PID 2>/dev/null; kill $FRONTEND_PID 2>/dev/null; exit" INT
wait 