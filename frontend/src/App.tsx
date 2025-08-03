import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import type { Eip1193Provider } from 'ethers';

const CONTRACT_ADDRESS = import.meta.env.VITE_FUSION_HTLC_ADDRESS || '0x0000000000000000000000000000000000000000';

async function ensureBuffer() {
  if (typeof window !== 'undefined' && !(window as Window & { Buffer?: typeof import('buffer').Buffer }).Buffer) {
    const bufferModule = await import('buffer');
    (window as Window & { Buffer?: typeof import('buffer').Buffer }).Buffer = bufferModule.Buffer;
  }
}

const CHAINS = [
  { label: 'Bitcoin', value: 'bitcoin' },
  { label: 'Litecoin', value: 'litecoin' },
  { label: 'Dogecoin', value: 'dogecoin' },
  { label: 'Bitcoin Cash', value: 'bch' },
];

const DIRECTIONS = [
  { label: 'ETH → BTC/LTC/DOGE/BCH', value: 'eth2btc' },
  { label: 'BTC/LTC/DOGE/BCH → ETH', value: 'btc2eth' },
];

const ETHHTLC_ABI = [
  'function lock(bytes32 hashlock, address recipient, uint256 timelock) external payable',
  'function redeem(bytes32 secret) external',
  'function refund(bytes32 hashlock) external',
  'event Locked(bytes32 indexed hashlock, address indexed sender, address indexed recipient, uint256 amount, uint256 timelock)',
  'event Redeemed(bytes32 indexed hashlock, bytes32 secret, address indexed recipient)',
  'event Refunded(bytes32 indexed hashlock, address indexed sender)'
];

declare global {
  interface Window {
    unisat?: unknown;
    btc?: unknown;
    xverseBitcoin?: unknown;
    Buffer?: typeof import('buffer').Buffer;
  }
}

type Provider = { name: string; check: () => unknown };

const WALLET_PROVIDERS: Record<string, Provider[]> = {
  bitcoin: [
    { name: 'Unisat', check: () => (window as unknown as { unisat?: unknown }).unisat },
    { name: 'Hiro', check: () => (window as unknown as { btc?: unknown }).btc },
    { name: 'Xverse', check: () => (window as unknown as { xverseBitcoin?: unknown }).xverseBitcoin },
  ],
  litecoin: [
    { name: 'Unisat', check: () => (window as unknown as { unisat?: unknown }).unisat },
  ],
  dogecoin: [
    { name: 'Unisat', check: () => (window as unknown as { unisat?: unknown }).unisat },
  ],
  bch: [
    { name: 'Unisat', check: () => (window as unknown as { unisat?: unknown }).unisat },
  ],
};

export default function App() {
  const [direction, setDirection] = useState<string>('eth2btc');
  const [chain, setChain] = useState<string>('bitcoin');
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [hashlock, setHashlock] = useState<string>('');
  const [timelock, setTimelock] = useState<string>('3600');
  const [status, setStatus] = useState<string>('');
  const [step, setStep] = useState<number>(0);
  const [log, setLog] = useState<Record<string, unknown> | null>(null);
  const [changeAddress, setChangeAddress] = useState<string>('');
  const [ethAddress, setEthAddress] = useState<string>('');
  const [walletError, setWalletError] = useState<string>('');
  const [ethContract, setEthContract] = useState<string>(import.meta.env.VITE_ETH_HTLC_ADDRESS || '');
  const [txStatus, setTxStatus] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [utxoWallet, setUtxoWallet] = useState<string>('');
  const [utxoAddress, setUtxoAddress] = useState<string>('');
  const [utxoWalletError, setUtxoWalletError] = useState<string>('');
  const [utxoTxStatus, setUtxoTxStatus] = useState<string>('');
  const [utxoTxId, setUtxoTxId] = useState<string>('');
  const [useFusion, setUseFusion] = useState<boolean>(false);
  const [fusionOrderId, setFusionOrderId] = useState<string>('');
  const [fusionStatus, setFusionStatus] = useState<string>('');
  const [fusionContract, setFusionContract] = useState<string>(import.meta.env.VITE_FUSION_HTLC_ADDRESS || '');
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderList, setShowOrderList] = useState<boolean>(false);
  const [selectionMessage, setSelectionMessage] = useState<string>('');
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  // Exchange rate state
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [lastRateUpdate, setLastRateUpdate] = useState<Date | null>(null);

  useEffect(() => { ensureBuffer(); }, []);

  // Exchange rate functions
  async function fetchExchangeRate() {
    setRateLoading(true);
    setRateError(null);
    
    try {
      // Try multiple exchange rate sources for reliability
      const sources = [
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd',
        'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
        'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'
      ];
      
      let ethPrice = 0;
      let btcPrice = 0;
      
      // Try CoinGecko first (most reliable for crypto pairs)
      try {
        const response = await fetch(sources[0]);
        if (response.ok) {
          const data = await response.json();
          ethPrice = data.ethereum.usd;
          btcPrice = data.bitcoin.usd;
        }
      } catch (error) {
        console.log('CoinGecko failed, trying Binance...');
      }
      
      // Fallback to Binance if CoinGecko fails
      if (!ethPrice || !btcPrice) {
        try {
          const [ethResponse, btcResponse] = await Promise.all([
            fetch(sources[1]),
            fetch(sources[2])
          ]);
          
          if (ethResponse.ok && btcResponse.ok) {
            const ethData = await ethResponse.json();
            const btcData = await btcResponse.json();
            ethPrice = parseFloat(ethData.price);
            btcPrice = parseFloat(btcData.price);
          }
        } catch (error) {
          console.log('Binance failed, using fallback rate...');
        }
      }
      
      // Final fallback: use a reasonable estimate if all APIs fail
      if (!ethPrice || !btcPrice) {
        ethPrice = 3000; // Fallback ETH price
        btcPrice = 60000; // Fallback BTC price
        setRateError('Using estimated rates - live rates unavailable');
      }
      
      const rate = ethPrice / btcPrice;
      setExchangeRate(rate);
      setLastRateUpdate(new Date());
      
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      setRateError('Failed to fetch live rates');
      // Use a reasonable fallback rate
      setExchangeRate(0.05); // 1 ETH = 0.05 BTC (rough estimate)
    } finally {
      setRateLoading(false);
    }
  }

  // Auto-refresh rate every 30 seconds
  useEffect(() => {
    fetchExchangeRate();
    const interval = setInterval(fetchExchangeRate, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate amounts based on real exchange rate
  function calculateAmounts(inputAmount: string, inputDirection: string) {
    if (!exchangeRate || !inputAmount) return { input: inputAmount, output: '0' };
    
    const amount = parseFloat(inputAmount);
    if (isNaN(amount)) return { input: inputAmount, output: '0' };
    
    if (inputDirection === 'eth2btc') {
      const btcAmount = amount * exchangeRate;
      return {
        input: inputAmount,
        output: btcAmount.toFixed(8)
      };
    } else {
      const ethAmount = amount / exchangeRate;
      return {
        input: inputAmount,
        output: ethAmount.toFixed(6)
      };
    }
  }

  function generateSecret() {
    const arr = new Uint8Array(32);
    window.crypto.getRandomValues(arr);
    const sec = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    setSecret(sec);
    window.crypto.subtle.digest('SHA-256', arr).then(buf => {
      const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      setHashlock(hash);
    });
  }

  async function connectWallet() {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum as Eip1193Provider | undefined;
    if (!eth) {
      setWalletError('MetaMask not detected. Please install MetaMask.');
      return;
    }
    try {
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      setEthAddress(accounts[0]);
      setWalletError('');
      
      const browserProvider = new ethers.BrowserProvider(eth);
      const jsonRpcSigner = await browserProvider.getSigner();
      setProvider(browserProvider);
      setSigner(jsonRpcSigner);
    } catch {
      setWalletError('Wallet connection failed.');
    }
  }

  async function connectUtxoWallet() {
    setUtxoWalletError('');
    await new Promise(res => setTimeout(res, 150));
    const providers = WALLET_PROVIDERS[chain] || [];
    for (const provider of providers) {
      if (provider.check()) {
        setUtxoWallet(provider.name);
        try {
          let address = '';
          if (provider.name === 'Unisat') {
            const unisat = (window as unknown as { unisat?: { requestAccounts: () => Promise<string[]> } }).unisat;
            if (unisat) address = (await unisat.requestAccounts())[0];
          } else if (provider.name === 'Hiro') {
            const btc = (window as unknown as { btc?: { request: (m: string) => Promise<string[]> } }).btc;
            if (btc) address = (await btc.request('getAccounts'))[0];
          } else if (provider.name === 'Xverse') {
            const xverse = (window as unknown as { xverseBitcoin?: { getAccounts: () => Promise<string[]> } }).xverseBitcoin;
            if (xverse) address = (await xverse.getAccounts())[0];
          }
          setUtxoAddress(address);
        } catch {
          setUtxoWalletError('Wallet connection failed. Make sure your wallet is unlocked and the site is allowed.');
        }
        return;
      }
    }
    setUtxoWalletError('No compatible wallet found for this chain. Make sure your wallet is installed, unlocked, and the site is allowed.');
  }

  function handleStart() {
    generateSecret();
    setStep(1);
    setStatus('Secret generated. Proceed to lock funds on source chain.');
  }

  async function lockEth() {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum as Eip1193Provider | undefined;
    if (!eth || !ethAddress || !ethContract) return;
    setTxStatus('Sending lock transaction...');
    try {
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ethContract, ETHHTLC_ABI, signer);
      const value = ethers.parseEther(amount);
      const tx = await contract.lock('0x'+hashlock, recipient, BigInt(Math.floor(Date.now()/1000) + parseInt(timelock)), { value });
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('ETH locked!');
    } catch (e: unknown) {
      setTxStatus('Error: ' + ((e as Error).message || ''));
    }
  }

  async function redeemEth() {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum as Eip1193Provider | undefined;
    if (!eth || !ethAddress || !ethContract) return;
    setTxStatus('Sending redeem transaction...');
    try {
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ethContract, ETHHTLC_ABI, signer);
      const tx = await contract.redeem('0x'+secret);
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('ETH redeemed!');
    } catch (e: unknown) {
      setTxStatus('Error: ' + ((e as Error).message || ''));
    }
  }

  async function refundEth() {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum as Eip1193Provider | undefined;
    if (!eth || !ethAddress || !ethContract) return;
    setTxStatus('Sending refund transaction...');
    try {
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ethContract, ETHHTLC_ABI, signer);
      const tx = await contract.refund('0x'+hashlock);
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('ETH refunded!');
    } catch (e: unknown) {
      setTxStatus('Error: ' + ((e as Error).message || ''));
    }
  }

  async function lockUtxo() {
    setUtxoTxStatus('Preparing transaction...');
    try {
      if (!utxoWallet || !utxoAddress) throw new Error('No wallet connected');
      
      setUtxoTxStatus('Mock transaction created (browser mode)');
      setUtxoTxId('mock-tx-' + Date.now());
      
    } catch (e: unknown) {
      setUtxoTxStatus('Error: ' + ((e as Error).message || 'Failed to sign or broadcast.'));
    }
  }

  function getRecipientPlaceholder() {
    if (direction === 'eth2btc') {
      return `${chain.toUpperCase()} address`;
    } else {
      return 'ETH address';
    }
  }

  async function createFusionOrder() {
    if (!provider || !signer) {
      setFusionStatus('❌ Please connect your MetaMask wallet first');
      return;
    }

    // Additional check to ensure we have a valid signer
    try {
      const address = await signer.getAddress();
      if (!address) {
        setFusionStatus('❌ Please connect your MetaMask wallet first');
        return;
      }
    } catch (error) {
      setFusionStatus('❌ Please connect your MetaMask wallet first');
      return;
    }

    setFusionStatus('Creating Fusion+ order on blockchain...');
    try {
      const orderId = ethers.keccak256(ethers.toUtf8Bytes(`fusion-${Date.now()}-${Math.random()}`));
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const hashlock = ethers.keccak256(secret);
      const timelockSeconds = timelock ? parseInt(timelock) : 3600; // Default to 1 hour if not set
      const orderTimelock = Math.floor(Date.now() / 1000) + timelockSeconds;
      
      // Use real exchange rate with small spread for liquidity provider
      if (!exchangeRate) {
        setFusionStatus('❌ Exchange rate not available. Please wait...');
        return;
      }
      
      const spread = 0.001; // 0.1% spread for liquidity provider
      const adjustedRate = direction === 'eth2btc' 
        ? exchangeRate * (1 - spread) // Slightly worse rate for user
        : exchangeRate * (1 + spread); // Slightly better rate for user
      
      const ethAmount = ethers.parseEther(amount);
      const btcAmount = direction === 'eth2btc' 
        ? ethers.parseEther((parseFloat(amount) * adjustedRate).toFixed(8))
        : ethers.parseEther((parseFloat(amount) / adjustedRate).toFixed(8));
      
      const makerAsset = direction === 'eth2btc' ? 'ETH' : 'BTC';
      const takerAsset = direction === 'eth2btc' ? 'BTC' : 'ETH';
      const makerAmount = direction === 'eth2btc' ? ethAmount : btcAmount;
      const takerAmount = direction === 'eth2btc' ? btcAmount : ethAmount;

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        [
          "function createFusionOrder(bytes32 orderId, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock, bytes32 hashlock) external payable",
          "function matchFusionOrder(bytes32 orderId, bytes32 secret) external payable",
          "function cancelFusionOrder(bytes32 orderId) external",
          "function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)",
          "function isOrderActive(bytes32 orderId) external view returns (bool)",
          "function getActiveOrderIds() external view returns (bytes32[])",
        ],
        signer
      );

      const tx = await contract.createFusionOrder(
        orderId,
        makerAsset,
        takerAsset,
        makerAmount,
        takerAmount,
        orderTimelock,
        hashlock,
        { value: makerAmount }
      );

      setFusionStatus('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      
      setFusionOrderId(orderId);
      setFusionStatus(`✅ Fusion+ order created successfully!`);
      
      // Store transaction hash in log state for display
      setLog({
        ...log,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        status: 'created'
      });
      
      const orderData = {
        orderId,
        direction,
        makerAsset,
        takerAsset,
        makerAmount: ethers.formatEther(makerAmount),
        takerAmount: ethers.formatEther(takerAmount),
        ethAddress: ethAddress || recipient,
        btcAddress: recipient,
        hashlock,
        secret: Array.from(secret).map(b => b.toString(16).padStart(2, '0')).join(''),
        timelock: orderTimelock,
        status: 'active',
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
      
      localStorage.setItem(`order_${orderId}`, JSON.stringify(orderData));
      
    } catch (error) {
      console.error('Error creating Fusion+ order:', error);
      setFusionStatus(`❌ Error: ${(error as Error).message}`);
    }
  }

  async function loadAvailableOrders() {
    try {
      console.log('Loading available orders from blockchain...');
      
      // Check if provider and signer are connected
      if (!provider || !signer) {
        setFusionStatus('❌ Please connect your MetaMask wallet first');
        return;
      }

      // Additional check to ensure we have a valid signer
      try {
        const address = await signer.getAddress();
        if (!address) {
          setFusionStatus('❌ Please connect your MetaMask wallet first');
          return;
        }
      } catch (error) {
        setFusionStatus('❌ Please connect your MetaMask wallet first');
        return;
      }
      
      // Check if contract address is set
      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
        setFusionStatus('❌ Contract address not configured');
        return;
      }
      
      setFusionStatus('Loading orders from blockchain...');
      
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        [
          "function getActiveOrderIds() external view returns (bytes32[])",
          "function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)",
          "function isOrderActive(bytes32 orderId) external view returns (bool)",
        ],
        provider
      );

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
            timelock: new Date(Number(order[6]) * 1000).toISOString(),
            hashlock: order[7],
            isActive: order[8],
            isMatched: order[9],
            createdAt: new Date(Number(order[10]) * 1000).toISOString(),
            status: isActive ? 'active' : 'inactive'
          });
        } catch (error) {
          console.error(`Error fetching order ${orderId}:`, error);
        }
      }
      
      console.log('Orders loaded from blockchain:', activeOrders);
      setAvailableOrders(activeOrders);
      setShowOrderList(true);
      setFusionStatus(`✅ Loaded ${activeOrders.length} orders from blockchain`);
      console.log('Order list should now be visible');
    } catch (error) {
      console.error('Error loading orders:', error);
      setFusionStatus(`❌ Error loading orders: ${(error as Error).message}`);
    }
  }

  async function selectOrder(orderId: string) {
    try {
      console.log('Selecting order from blockchain:', orderId);
      
      if (!provider) {
        setFusionStatus('❌ Please connect your wallet first');
        return;
      }
      
      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
        setFusionStatus('❌ Contract address not configured');
        return;
      }
      
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        [
          "function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)",
          "function isOrderActive(bytes32 orderId) external view returns (bool)",
        ],
        provider
      );

      const order = await contract.getFusionOrder(orderId);
      const isActive = await contract.isOrderActive(orderId);
      
      const orderData = {
        orderId: order[0],
        maker: order[1],
        makerAsset: order[2],
        takerAsset: order[3],
        makerAmount: ethers.formatEther(order[4]),
        takerAmount: ethers.formatEther(order[5]),
        timelock: new Date(Number(order[6]) * 1000).toISOString(),
        hashlock: order[7],
        isActive: order[8],
        isMatched: order[9],
        createdAt: new Date(Number(order[10]) * 1000).toISOString(),
        status: isActive ? 'active' : 'inactive'
      };
      
      console.log('Order selected from blockchain:', orderData);
      setSelectedOrder(orderData);
      setFusionOrderId(orderData.orderId);
      setFusionStatus(`Selected order: ${orderData.status}`);
      setSelectionMessage(`✅ Order ${orderData.orderId} selected successfully!`);
      console.log('Order selection complete - fusionOrderId:', orderData.orderId, 'fusionStatus:', `Selected order: ${orderData.status}`);
      
      setTimeout(() => setSelectionMessage(''), 3000);
    } catch (error) {
      console.error('Error selecting order:', error);
      setFusionStatus(`❌ Error selecting order: ${(error as Error).message}`);
    }
  }

  async function matchSelectedOrder() {
    if (!selectedOrder || !secret) {
      console.log('Cannot match order - missing selectedOrder or secret:', { selectedOrder: !!selectedOrder, secret: !!secret });
      return;
    }
    
    try {
      console.log('Matching order:', selectedOrder.orderId, 'with secret:', secret);
      const response = await fetch('/api/fusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute-order',
          orderId: selectedOrder.orderId,
          secret: secret
        })
      });

      if (!response.ok) throw new Error('Failed to match order');
      
      const result = await response.json();
      console.log('Order match result:', result);
      setFusionStatus(`Order matched: ${result.success ? 'Success' : 'Failed'}`);
    } catch (error) {
      console.error('Error matching order:', error);
      setFusionStatus(`Error: ${(error as Error).message}`);
    }
  }

  useEffect(() => {
    if (!hashlock) return;
    const interval = setInterval(() => {
      fetch(`/api/track?hashlock=${hashlock}`)
        .then(async r => {
          const ct = r.headers.get('content-type') || '';
          if (r.ok && ct.includes('application/json')) return r.json();
          return null;
        })
        .then(data => {
          if (data) {
            setLog(data);
            setStatus(`Status: ${data.status}`);
          }
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [hashlock]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="backdrop-blur-md bg-white/80 border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="#" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent animate-fade-in">Fusion+</a>
          <nav>
              <ul className="flex space-x-8">
                <li><a href="#swap" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium animate-slide-in-left">Demo</a></li>
                <li><a href="#explainer" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium animate-slide-in-right">About</a></li>
            </ul>
          </nav>
          </div>
        </div>
      </header>

      <section className="relative py-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.1),transparent_50%)]"></div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full opacity-20 animate-float"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-20 animate-float-delayed"></div>
        <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-gradient-to-r from-indigo-400 to-blue-400 rounded-full opacity-20 animate-float"></div>
        <div className="absolute top-1/2 right-1/3 w-8 h-8 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full opacity-30 animate-float-delayed"></div>
        <div className="absolute bottom-1/3 right-10 w-10 h-10 bg-gradient-to-r from-indigo-400 to-blue-400 rounded-full opacity-25 animate-float"></div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200 text-blue-800 text-sm font-semibold mb-8 animate-fade-in shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse"></div>
                <span>Cross-chain atomic swaps powered by HTLC</span>
                <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse delay-300"></div>
              </div>
            </div>
            
            {/* Main Heading */}
            <h1 className="text-7xl md:text-8xl font-black mb-8 animate-fade-in-up leading-none">
              <span className="bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                Swap crypto.
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                No friction.
              </span>
              <br />
              <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
                No noise.
              </span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-2xl text-gray-600 mb-16 animate-fade-in-up max-w-3xl mx-auto leading-relaxed font-light">
              A seamless interface to move assets across chains, designed for clarity and trust.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 animate-fade-in-up">
              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">100%</div>
                <div className="text-gray-600 font-medium">Non-custodial</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">0%</div>
                <div className="text-gray-600 font-medium">Platform fees</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">∞</div>
                <div className="text-gray-600 font-medium">Chain support</div>
              </div>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center animate-fade-in-up">
              <a 
                href="https://github.com/virajbhartiya/fusion-xbtc" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group inline-flex items-center px-10 py-5 rounded-2xl bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 font-bold text-lg hover:bg-white hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <svg className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                </svg>
              View on GitHub
            </a>
              <a 
                href="#swap" 
                className="group inline-flex items-center px-10 py-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 animate-glow"
              >
                <span className="mr-3">Launch Demo</span>
                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
            
            {/* Scroll Indicator */}
            <div className="mt-20 animate-bounce">
              <div className="inline-flex flex-col items-center text-gray-400">
                <span className="text-sm font-medium mb-2">Scroll to explore</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="swap" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 animate-fade-in-up">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">Start a Swap</h2>
              <p className="text-lg text-gray-600">Configure your cross-chain atomic swap</p>
            </div>
            
            {direction === 'eth2btc' && (
              <div className="mb-6">
                <label className="form-label">Ethereum wallet</label>
                {ethAddress ? (
                  <div className="message success">
                    Connected: <code className="bg-white px-2 py-1 rounded text-sm">{ethAddress}</code>
                  </div>
                ) : (
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-full" 
                    onClick={connectWallet}
                  >
                    Connect MetaMask
                  </button>
                )}
                {walletError && <div className="message error">{walletError}</div>}
              </div>
            )}
            
            {direction === 'btc2eth' && (
              <div className="mb-6">
                <label className="form-label">{chain.toUpperCase()} wallet</label>
                {utxoAddress ? (
                  <div className="message success">
                    Connected: <code className="bg-white px-2 py-1 rounded text-sm">{utxoAddress}</code> <span className="opacity-70">[{utxoWallet}]</span>
                  </div>
                ) : (
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-full" 
                    onClick={connectUtxoWallet}
                  >
                    Connect {utxoWallet || 'wallet'}
                  </button>
                )}
                {utxoWalletError && <div className="message error">{utxoWalletError}</div>}
              </div>
            )}
            
            <form onSubmit={e => { 
              e.preventDefault(); 
              if (useFusion) {
                createFusionOrder();
              } else {
                handleStart();
              }
            }} className="space-y-6 max-w-4xl mx-auto">
              {/* Live Exchange Rate Section */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mr-4">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Live Exchange Rate</h3>
                  </div>
                  <button 
                    onClick={fetchExchangeRate}
                    disabled={rateLoading}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                  >
                    {rateLoading ? '🔄' : '🔄'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white/50 rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">ETH → BTC</span>
                      <span className="text-xs text-gray-500 truncate ml-2">
                        {lastRateUpdate ? `Updated ${Math.floor((Date.now() - lastRateUpdate.getTime()) / 1000)}s ago` : 'Never'}
                      </span>
                    </div>
                    <div className="text-lg lg:text-2xl font-bold text-gray-900 break-words">
                      {exchangeRate ? `1 ETH = ${exchangeRate.toFixed(6)} BTC` : 'Loading...'}
                    </div>
                    {rateError && (
                      <div className="text-orange-600 text-xs mt-1">⚠️ {rateError}</div>
                    )}
                  </div>
                  
                  <div className="bg-white/50 rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">BTC → ETH</span>
                      <span className="text-xs text-gray-500 truncate ml-2">
                        {lastRateUpdate ? `Updated ${Math.floor((Date.now() - lastRateUpdate.getTime()) / 1000)}s ago` : 'Never'}
                      </span>
                    </div>
                    <div className="text-lg lg:text-2xl font-bold text-gray-900 break-words">
                      {exchangeRate ? `1 BTC = ${(1/exchangeRate).toFixed(2)} ETH` : 'Loading...'}
                    </div>
                    {rateError && (
                      <div className="text-orange-600 text-xs mt-1">⚠️ {rateError}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Swap Configuration Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Swap Configuration</h3>
                </div>
                
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label flex items-center">
                      <svg className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="truncate">Swap Direction</span>
                    </label>
                <select className="form-select" value={direction} onChange={e => setDirection(e.target.value)}>
                  {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              
                  <div>
                    <label className="form-label flex items-center">
                      <svg className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="truncate">UTXO Chain</span>
                    </label>
                <select className="form-select" value={chain} onChange={e => setChain(e.target.value)}>
                  {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                  </div>
                </div>
              </div>
              
              {/* Amount & Recipient Section */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
              </div>
              
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                      <span className="truncate">Amount</span>
                    </label>
                    <div className="relative">
                      <input 
                        className="form-input pr-12" 
                        type="text" 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        placeholder="e.g. 0.01" 
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="text-gray-500 text-sm font-medium">
                          {direction === 'eth2btc' ? 'ETH' : chain.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {amount && (
                      <div className="mt-2 text-sm text-gray-600 bg-white/50 rounded-lg p-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="truncate">You'll receive:</span>
                          <span className="font-semibold ml-2">
                            {direction === 'eth2btc' 
                              ? `${calculateAmounts(amount, direction).output} BTC`
                              : `${calculateAmounts(amount, direction).output} ETH`
                            }
                          </span>
                        </div>
                        {exchangeRate && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="truncate">Rate:</span>
                            <span className="font-medium ml-2">
                              {direction === 'eth2btc' 
                                ? `1 ETH = ${exchangeRate.toFixed(6)} BTC`
                                : `1 BTC = ${(1/exchangeRate).toFixed(2)} ETH`
                              }
                            </span>
                          </div>
                        )}
                        {rateError && (
                          <div className="text-orange-600 text-xs mt-1">
                            ⚠️ {rateError}
                          </div>
                        )}
                        {rateLoading && (
                          <div className="text-blue-600 text-xs mt-1">
                            🔄 Updating rates...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="form-label flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">Recipient Address</span>
                    </label>
                    <input 
                      className="form-input" 
                      type="text" 
                      value={recipient} 
                      onChange={e => setRecipient(e.target.value)} 
                      placeholder={getRecipientPlaceholder()} 
                    />
                    {recipient && (
                      <div className="mt-2 text-sm text-gray-600 bg-white/50 rounded-lg p-2">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${recipient.startsWith('0x') ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                          <span className="truncate">{recipient.startsWith('0x') ? 'Ethereum address' : `${chain.toUpperCase()} address`}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Advanced Settings Section */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Advanced Settings</h3>
                </div>
                
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label flex items-center">
                      <svg className="w-4 h-4 mr-2 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="truncate">Timelock (seconds)</span>
                    </label>
                    <input 
                      className="form-input" 
                      type="number" 
                      value={timelock} 
                      onChange={e => setTimelock(e.target.value)} 
                      placeholder="3600" 
                    />
                    <div className="mt-2 text-sm text-gray-600 bg-white/50 rounded-lg p-2">
                      <div className="flex justify-between">
                        <span className="truncate">Expires in:</span>
                        <span className="font-semibold ml-2">
                          {timelock ? `${Math.floor(parseInt(timelock) / 3600)}h ${Math.floor((parseInt(timelock) % 3600) / 60)}m` : '1h 0m'}
                        </span>
                      </div>
                    </div>
              </div>
              
              {direction === 'btc2eth' && (
                    <div>
                      <label className="form-label flex items-center">
                        <svg className="w-4 h-4 mr-2 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">Change Address</span>
                      </label>
                      <input 
                        className="form-input" 
                        type="text" 
                        value={changeAddress} 
                        onChange={e => setChangeAddress(e.target.value)} 
                        placeholder={`Your ${chain.toUpperCase()} change address`} 
                      />
                </div>
              )}
              
              {direction === 'eth2btc' && (
                    <div>
                  <button 
                    type="button" 
                    onClick={() => setShowAdvanced(v => !v)}
                        className="w-full text-left p-4 bg-white/50 rounded-xl border border-purple-200 hover:bg-white hover:border-purple-300 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            <span className="font-semibold text-gray-700 truncate">Advanced Options</span>
                          </div>
                          <svg className={`w-5 h-5 text-purple-600 transition-transform duration-200 flex-shrink-0 ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                  </button>
                  
                  {showAdvanced && (
                        <div className="mt-4 p-4 bg-white/50 rounded-xl border border-purple-200">
                          <label className="form-label flex items-center">
                            <svg className="w-4 h-4 mr-2 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="truncate">ETH HTLC Contract Address</span>
                          </label>
                          <input 
                            className="form-input" 
                            type="text" 
                            value={ethContract} 
                            onChange={e => setEthContract(e.target.value)} 
                            placeholder="0x..." 
                          />
                          <div className="mt-2 text-sm text-gray-600 truncate">
                        Default: {import.meta.env.VITE_ETH_HTLC_ADDRESS || 'Not set'}
                          </div>
                    </div>
                  )}
                </div>
              )}
                </div>
              </div>
              
              {/* Fusion+ Protocol Section */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-6 border border-orange-100">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Fusion+ Protocol</h3>
              </div>
              
                                <div className="flex items-center p-4 bg-white/50 rounded-xl border border-orange-200">
                  <input 
                    type="checkbox" 
                    checked={useFusion} 
                    onChange={e => setUseFusion(e.target.checked)}
                    className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 mr-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Enable Fusion+ Protocol</div>
                    <div className="text-sm text-gray-600">Advanced order matching and partial fills for cross-chain swaps</div>
                  </div>
                  <div className="flex items-center ml-4">
                    {provider && signer ? (
                      <div className="flex items-center text-green-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium">Wallet Connected</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-orange-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-xs font-medium">Wallet Required</span>
                      </div>
                    )}
                  </div>
              </div>
              
              {useFusion && (
                  <div className="mt-6 p-6 bg-white/50 rounded-xl border border-orange-200">
                    <h4 className="font-semibold mb-4 text-gray-900">Fusion+ Configuration</h4>
                    <div className="mb-4">
                      <label className="form-label flex items-center">
                        <svg className="w-4 h-4 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Fusion+ HTLC Contract Address
                      </label>
                    <input 
                      className="form-input" 
                      type="text" 
                      value={fusionContract} 
                      onChange={e => setFusionContract(e.target.value)} 
                      placeholder="0x..." 
                    />
                  </div>
                                        <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={loadAvailableOrders}
                        disabled={!provider || !signer}
                        className={`btn ${provider && signer ? 'btn-secondary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        {provider && signer ? 'Browse Orders' : 'Connect Wallet First'}
                    </button>
                      <div className="text-sm text-gray-600 flex items-center">
                        {provider && signer ? (
                          <>
                            <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Order matching enabled
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            Wallet required
                          </>
                        )}
                  </div>
                  </div>
                </div>
              )}
              </div>
              
              {/* Submit Button */}
              <div className="flex justify-center">
              <button 
                type="submit" 
                  className="group relative inline-flex items-center px-12 py-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={!amount || !recipient || !timelock || (direction==='eth2btc' && !ethAddress) || (direction==='btc2eth' && !utxoAddress)}
              >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center">
                    <svg className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {useFusion ? 'Create Fusion+ Order' : 'Start Swap'}
                    <svg className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
              </button>
              </div>
            </form>
            
            {showOrderList && availableOrders.length > 0 && (
              <div className="message info mt-6">
                <h4 className="font-semibold mb-4">Available Fusion+ orders</h4>
                <div className="max-h-80 overflow-y-auto">
                  {availableOrders.map((order, index) => (
                    <div key={index} className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                      <div><strong>Order ID:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-sm">{order.orderId}</code></div>
                      <div><strong>Direction:</strong> {order.makerAsset} → {order.takerAsset}</div>
                      <div><strong>Amount:</strong> {order.makerAmount} {order.makerAsset} → {order.takerAmount} {order.takerAsset}</div>
                      <div><strong>Rate:</strong> 1 {order.makerAsset} = {(parseFloat(order.takerAmount) / parseFloat(order.makerAmount)).toFixed(6)} {order.takerAsset}</div>
                      {exchangeRate && (
                        <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1">
                          Market: 1 {order.makerAsset} = {order.makerAsset === 'ETH' ? exchangeRate.toFixed(6) : (1/exchangeRate).toFixed(2)} {order.takerAsset}
                        </div>
                      )}
                      <div><strong>Status:</strong> {order.status}</div>
                      <div><strong>Maker:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-sm text-xs">{order.maker?.slice(0, 10)}...{order.maker?.slice(-8)}</code></div>
                      <button 
                        onClick={() => selectOrder(order.orderId)}
                        className="btn btn-primary mt-2 px-4 py-2 text-sm"
                      >
                        Select order
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setShowOrderList(false)}
                  className="btn btn-secondary mt-4"
                >
                  Close
                </button>
              </div>
            )}

            {selectionMessage && (
              <div className="message success mt-6">
                {selectionMessage}
              </div>
            )}

            {selectedOrder && (
              <div className="message info mt-6">
                <h4 className="font-semibold mb-4">Selected order</h4>
                <div><strong>Order ID:</strong> <code className="bg-white px-2 py-1 rounded text-sm">{selectedOrder.orderId}</code></div>
                <div><strong>Direction:</strong> {selectedOrder.makerAsset} → {selectedOrder.takerAsset}</div>
                <div><strong>Amount:</strong> {selectedOrder.makerAmount} {selectedOrder.makerAsset} → {selectedOrder.takerAmount} {selectedOrder.takerAsset}</div>
                <div><strong>Rate:</strong> 1 {selectedOrder.makerAsset} = {(parseFloat(selectedOrder.takerAmount) / parseFloat(selectedOrder.makerAmount)).toFixed(6)} {selectedOrder.takerAsset}</div>
                {exchangeRate && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1">
                    Market: 1 {selectedOrder.makerAsset} = {selectedOrder.makerAsset === 'ETH' ? exchangeRate.toFixed(6) : (1/exchangeRate).toFixed(2)} {selectedOrder.takerAsset}
                  </div>
                )}
                <div><strong>Status:</strong> {selectedOrder.status}</div>
                <div><strong>Maker Address:</strong> <code className="bg-white px-2 py-1 rounded text-sm">{selectedOrder.maker}</code></div>
                <div><strong>Timelock:</strong> {new Date(selectedOrder.timelock).toLocaleString()}</div>
                <div><strong>Created:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</div>
                <div className="mt-4">
                  <button 
                    onClick={() => matchSelectedOrder()}
                    className="btn btn-primary mr-2"
                  >
                    Match this order
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedOrder(null);
                      setFusionOrderId('');
                      setFusionStatus('');
                    }}
                    className="btn btn-secondary"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            )}

            {step > 0 && (
              <div className="message info mt-6">
                <h3 className="font-semibold mb-4">Swap secret & hashlock</h3>
                <div><strong>Secret (preimage):</strong> <code className="bg-white px-2 py-1 rounded text-sm">{secret}</code></div>
                <div><strong>Hashlock (SHA-256):</strong> <code className="bg-white px-2 py-1 rounded text-sm">{hashlock}</code></div>
                <div><strong>Status:</strong> {status}</div>
                {log && (
                  <div className="mt-4">
                    <strong>Swap log:</strong>
                    <div className="mt-2 text-sm bg-gray-50 p-4 rounded-lg border border-gray-200">
                      {Object.entries(log).map(([k, v]) => (
                        (k !== 'ethTx' && k !== 'btcTx') ? (
                          <div key={k} className="mb-2">
                            <strong>{k}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </div>
                        ) : null
                      ))}
                    </div>
                    {'ethTx' in log && typeof log.ethTx === 'string' && (
                      <div className="mt-2">
                        <a href={`https://sepolia.etherscan.io/tx/${log.ethTx}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary inline-block px-4 py-2">View ETH transaction</a>
                      </div>
                    )}
                    {'btcTx' in log && typeof log.btcTx === 'string' && (
                      <div className="mt-2">
                        <a href={`https://mempool.space/testnet/tx/${log.btcTx}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary inline-block px-4 py-2">View {chain.toUpperCase()} transaction</a>
                      </div>
                    )}
                  </div>
                )}

                {useFusion && fusionOrderId && (
                  <div className="message info mt-6">
                    <h4 className="font-semibold mb-4">Fusion+ order</h4>
                    <div><strong>Order ID:</strong> <code className="bg-white px-2 py-1 rounded text-sm">{fusionOrderId}</code></div>
                    <div><strong>Status:</strong> {fusionStatus}</div>
                    {log && typeof log === 'object' && 'txHash' in log && typeof log.txHash === 'string' && (
                      <div className="mt-2">
                        <strong>Transaction Hash:</strong> <code className="bg-white px-2 py-1 rounded text-sm">{log.txHash}</code>
                        <div className="mt-2">
                          <a 
                            href={`https://sepolia.etherscan.io/tx/${log.txHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-secondary inline-block px-4 py-2 text-sm"
                          >
                            View on Etherscan
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="mt-4">
                      <button className="btn btn-primary mr-2" onClick={() => {}}>Check status</button>
                      <button className="btn btn-primary mr-2" onClick={() => {}}>Create on chain</button>
                      <button className="btn btn-primary mr-2" onClick={() => {}}>Match order</button>
                      <button className="btn btn-primary mr-2" onClick={() => matchSelectedOrder()}>Match selected</button>
                      <button className="btn btn-secondary" onClick={() => {}}>Cancel order</button>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      This order is now available for matching on the Fusion+ network
                    </div>
                  </div>
                )}
                
                {direction === 'eth2btc' && ethContract && ethAddress && !useFusion && (
                  <div className="mt-6">
                    <button className="btn btn-primary mr-2" onClick={lockEth}>Lock ETH</button>
                    <button className="btn btn-primary mr-2" onClick={redeemEth}>Redeem</button>
                    <button className="btn btn-secondary" onClick={refundEth}>Refund</button>
                    {txStatus && <div className="message info mt-2">{txStatus}</div>}
                    {txHash && <div className="mt-2"><a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary inline-block px-4 py-2">View transaction</a></div>}
                  </div>
                )}
                <div className="mt-4">
                  <strong>Next steps:</strong>
                  <ol className="mt-2 pl-6">
                    <li>Lock funds on source chain using the above hashlock and timelock.</li>
                    <li>Share hashlock with counterparty to lock on destination chain.</li>
                    <li>Redeem on destination chain with secret when ready.</li>
                    <li>Monitor both chains for redeem/refund status.</li>
                  </ol>
                  <p className="mt-2 text-sm text-gray-600">All transactions must be copy-pasted into your wallet or CLI. No wallet integration.</p>
                </div>
              </div>
            )}
            {step > 0 && direction === 'btc2eth' && utxoAddress && (
              <div className="message info mt-6">
                <h3 className="font-semibold mb-4">UTXO chain actions</h3>
                <button className="btn btn-primary mr-2" onClick={lockUtxo}>Lock funds (wallet)</button>
                {utxoTxStatus && <div className="mt-2">{utxoTxStatus}</div>}
                {utxoTxId && <div className="mt-2"><strong>TxID:</strong> <code className="bg-white px-2 py-1 rounded text-sm">{utxoTxId}</code></div>}
                <div className="mt-4">
                  <strong>Instructions:</strong>
                  <ol className="mt-2 pl-6">
                    <li>Connect your browser wallet for {chain.toUpperCase()} (Unisat, Hiro, Xverse, etc).</li>
                    <li>Click "Lock funds" to sign and broadcast the HTLC transaction.</li>
                    <li>Monitor status and redeem/refund as needed.</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="explainer" className="py-24 bg-gradient-to-br from-white to-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Features
            </div>
            <h2 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">What is this?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              This tool allows you to transfer crypto assets across different blockchains using the best available routes in real time.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-white/20 hover:border-blue-200/50">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">No custodial risk</h3>
              <p className="text-gray-600 leading-relaxed">
                Your assets remain in your control throughout the entire process. No third-party custody required.
              </p>
            </div>
            
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-white/20 hover:border-blue-200/50">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Optimized liquidity routes</h3>
              <p className="text-gray-600 leading-relaxed">
                Automatically finds the best available paths across multiple bridges and exchanges.
              </p>
            </div>
            
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-white/20 hover:border-blue-200/50">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Live status updates</h3>
              <p className="text-gray-600 leading-relaxed">
                Real-time tracking of your swap progress across both source and destination chains.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white/90 text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
            Built for ETHGlobal
          </div>
          <p className="text-xl mb-6 font-medium">Designed for people who care about UX.</p>
          <a href="https://github.com/art3mis/fusion-xbtc" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-300 hover:text-blue-200 underline transition-colors duration-200 font-medium">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
            </svg>
            View on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
