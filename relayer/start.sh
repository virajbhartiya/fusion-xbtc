#!/bin/bash

# Fusion XBTC Relayer Startup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js version: $(node -v)"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    print_success "npm version: $(npm -v)"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the relayer directory."
        exit 1
    fi
    
    npm install
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Check configuration
check_config() {
    print_status "Checking configuration..."
    
    if [ ! -f "config.ts" ]; then
        print_warning "config.ts not found. Creating from example..."
        if [ -f "config.example.ts" ]; then
            cp config.example.ts config.ts
            print_warning "Please edit config.ts with your settings before starting the relayer."
        else
            print_error "config.example.ts not found. Please create a config.ts file."
            exit 1
        fi
    fi
    
    # Check for required environment variables
    if [ -z "$ETHEREUM_PRIVATE_KEY" ]; then
        print_warning "ETHEREUM_PRIVATE_KEY not set. Some features may not work."
    fi
    
    if [ -z "$BITCOIN_WIF" ]; then
        print_warning "BITCOIN_WIF not set. Some features may not work."
    fi
}

# Create data directory
create_data_dir() {
    print_status "Creating data directory..."
    
    DATA_DIR="./examples/swaps"
    mkdir -p "$DATA_DIR"
    
    if [ $? -eq 0 ]; then
        print_success "Data directory created: $DATA_DIR"
    else
        print_error "Failed to create data directory"
        exit 1
    fi
}

# Start the relayer
start_relayer() {
    print_status "Starting Fusion XBTC Relayer..."
    
    # Set default environment if not set
    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV=development
        print_status "NODE_ENV set to: development"
    fi
    
    # Set default log level if not set
    if [ -z "$LOG_LEVEL" ]; then
        export LOG_LEVEL=info
        print_status "LOG_LEVEL set to: info"
    fi
    
    print_status "Environment: $NODE_ENV"
    print_status "Log Level: $LOG_LEVEL"
    
    # Start the relayer
    if [ "$NODE_ENV" = "production" ]; then
        npm start
    else
        npm run dev
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "    Fusion XBTC Relayer Startup"
    echo "=========================================="
    echo ""
    
    check_node
    check_npm
    install_dependencies
    check_config
    create_data_dir
    
    echo ""
    print_status "All checks passed. Starting relayer..."
    echo ""
    
    start_relayer
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --install      Install dependencies only"
        echo "  --check        Run checks only"
        echo ""
        echo "Environment Variables:"
        echo "  NODE_ENV              Environment (development|production|testnet)"
        echo "  LOG_LEVEL             Log level (debug|info|warn|error)"
        echo "  ETHEREUM_PRIVATE_KEY  Ethereum private key for transactions"
        echo "  BITCOIN_WIF           Bitcoin WIF for transactions"
        echo ""
        exit 0
        ;;
    --install)
        check_node
        check_npm
        install_dependencies
        print_success "Installation completed"
        exit 0
        ;;
    --check)
        check_node
        check_npm
        check_config
        create_data_dir
        print_success "All checks passed"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac 