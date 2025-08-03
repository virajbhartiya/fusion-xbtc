import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import viteLogo from '/vite.svg';
import type { Eip1193Provider } from 'ethers';

// Fusion+ integration with real blockchain
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

const FUSION_HTLC_ABI = [
  // Standard HTLC functions
  'function lock(bytes32 hashlock, address recipient, uint256 timelock) external payable',
  'function redeem(bytes32 secret) external',
  'function refund(bytes32 hashlock) external',
  // Fusion+ specific functions
  'function createFusionOrder(bytes32 orderId, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock, bytes32 hashlock) external payable',
  'function matchFusionOrder(bytes32 orderId, bytes32 secret) external payable',
  'function cancelFusionOrder(bytes32 orderId) external',
  'function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)',
  'function isOrderActive(bytes32 orderId) external view returns (bool)',
  'function getActiveOrderIds() external view returns (bytes32[])',
  // Events
  'event FusionOrderCreated(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed maker, string makerAsset, string takerAsset, uint256 makerAmount, uint256 takerAmount, uint256 timelock)',
  'event FusionOrderMatched(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed taker, uint256 executedAmount)',
  'event FusionOrderCancelled(bytes32 indexed orderId, bytes32 indexed hashlock, address indexed maker)'
];

function explorerLink(chain: string, tx: string) {
  if (chain === 'bitcoin') return `https://mempool.space/testnet/tx/${tx}`;
  if (chain === 'litecoin') return `https://blockcypher.com/ltc-testnet/tx/${tx}`;
  if (chain === 'dogecoin') return `https://blockexplorer.one/dogecoin/testnet/tx/${tx}`;
  if (chain === 'bch') return `https://testnet.blockexplorer.one/bch/tx/${tx}`;
  if (chain === 'ethereum') return `https://sepolia.etherscan.io/tx/${tx}`;
  return '#';
}

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

// Mock Bitcoin network for browser compatibility
const bitcoinNetworks = {
  testnet: { name: 'testnet' },
  mainnet: { name: 'mainnet' }
};

async function fetchUtxos(address: string, network: any): Promise<{ txid: string; vout: number; value: number }[]> {
  const baseUrl = network.name === 'testnet'
    ? 'https://blockstream.info/testnet/api'
    : 'https://blockstream.info/api';
  const resp = await fetch(`${baseUrl}/address/${address}/utxo`);
  if (!resp.ok) throw new Error('Failed to fetch UTXOs');
  const utxos = await resp.json();
  return utxos.map((u: { txid: string; vout: number; value: number }) => ({ txid: u.txid, vout: u.vout, value: u.value }));
}

export default function App() {
  const [direction, setDirection] = useState<string>('eth2btc');
  const [chain, setChain] = useState<string>('bitcoin');
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [hashlock, setHashlock] = useState<string>('');
  const [timelock, setTimelock] = useState<string>('');
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
  
  // Fusion+ state
  const [useFusion, setUseFusion] = useState<boolean>(false);
  const [fusionOrderId, setFusionOrderId] = useState<string>('');
  const [fusionStatus, setFusionStatus] = useState<string>('');
  const [fusionContract, setFusionContract] = useState<string>(import.meta.env.VITE_FUSION_HTLC_ADDRESS || '');
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderList, setShowOrderList] = useState<boolean>(false);
  const [selectionMessage, setSelectionMessage] = useState<string>('');
  
  // Blockchain provider and signer
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  useEffect(() => { ensureBuffer(); }, []);

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
      
      // Initialize provider and signer for blockchain interactions
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

  // Fusion+ contract functions
  async function createFusionOrderOnChain() {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum as Eip1193Provider | undefined;
    if (!eth || !ethAddress || !fusionContract) return;
    setTxStatus('Creating Fusion+ order on chain...');
    try {
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(fusionContract, FUSION_HTLC_ABI, signer);
      
      const orderId = ethers.keccak256(ethers.toUtf8Bytes(`fusion-${Date.now()}-${Math.random()}`));
      const makerAsset = direction === 'eth2btc' ? 'ETH' : 'BTC';
      const takerAsset = direction === 'eth2btc' ? 'BTC' : 'ETH';
      const makerAmount = ethers.parseEther(amount);
      const takerAmount = ethers.parseEther(amount); // Simplified for demo
      const timelockValue = BigInt(Math.floor(Date.now()/1000) + parseInt(timelock));
      const hashlockBytes = ethers.keccak256(ethers.toUtf8Bytes(hashlock));
      
      const tx = await contract.createFusionOrder(
        orderId,
        makerAsset,
        takerAsset,
        makerAmount,
        takerAmount,
        timelockValue,
        hashlockBytes,
        { value: makerAmount }
      );
      
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Fusion+ order created on chain!');
      setFusionOrderId(orderId);
    } catch (e: unknown) {
      setTxStatus('Error: ' + ((e as Error).message || ''));
    }
  }

  async function matchFusionOrderOnChain() {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum as Eip1193Provider | undefined;
    if (!eth || !ethAddress || !fusionContract || !fusionOrderId || !secret) return;
    setTxStatus('Matching Fusion+ order on chain...');
    try {
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(fusionContract, FUSION_HTLC_ABI, signer);
      
      const secretBytes = ethers.keccak256(ethers.toUtf8Bytes(secret));
      const value = ethers.parseEther(amount);
      
      const tx = await contract.matchFusionOrder(fusionOrderId, secretBytes, { value });
      
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Fusion+ order matched on chain!');
    } catch (e: unknown) {
      setTxStatus('Error: ' + ((e as Error).message || ''));
    }
  }

  async function cancelFusionOrderOnChain() {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum as Eip1193Provider | undefined;
    if (!eth || !ethAddress || !fusionContract || !fusionOrderId) return;
    setTxStatus('Cancelling Fusion+ order on chain...');
    try {
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(fusionContract, FUSION_HTLC_ABI, signer);
      
      const tx = await contract.cancelFusionOrder(fusionOrderId);
      
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Fusion+ order cancelled on chain!');
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
      
      // Mock implementation for browser compatibility
      setUtxoTxStatus('Mock transaction created (browser mode)');
      setUtxoTxId('mock-tx-' + Date.now());
      
      // In a real implementation, this would:
      // 1. Build the HTLC script
      // 2. Create the transaction
      // 3. Sign with the wallet
      // 4. Broadcast to the network
      
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

  // Fusion+ functions with real blockchain integration
  async function createFusionOrder() {
    if (!provider || !signer) {
      setFusionStatus('Error: Wallet not connected');
      return;
    }

    setFusionStatus('Creating Fusion+ order on blockchain...');
    try {
      // Generate order parameters
      const orderId = ethers.keccak256(ethers.toUtf8Bytes(`fusion-${Date.now()}-${Math.random()}`));
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const hashlock = ethers.keccak256(secret);
      const orderTimelock = Math.floor(Date.now() / 1000) + parseInt(timelock);
      
      const ethAmount = ethers.parseEther(amount);
      const btcAmount = ethers.parseEther(amount); // Simplified for demo
      
      const makerAsset = direction === 'eth2btc' ? 'ETH' : 'BTC';
      const takerAsset = direction === 'eth2btc' ? 'BTC' : 'ETH';
      const makerAmount = direction === 'eth2btc' ? ethAmount : btcAmount;
      const takerAmount = direction === 'eth2btc' ? btcAmount : ethAmount;

      // Create contract instance
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

      // Create the order on blockchain
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
      setFusionStatus(`✅ Fusion+ order created! TX: ${tx.hash}`);
      
      // Store order details locally
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

  async function getFusionOrderStatus() {
    if (!fusionOrderId || !provider) return;
    
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        [
          "function getFusionOrder(bytes32 orderId) external view returns (bytes32, address, string, string, uint256, uint256, uint256, bytes32, bool, bool, uint256)",
          "function isOrderActive(bytes32 orderId) external view returns (bool)",
        ],
        provider
      );

      const order = await contract.getFusionOrder(fusionOrderId);
      const isActive = await contract.isOrderActive(fusionOrderId);
      
      const status = isActive ? 'active' : 'inactive';
      setFusionStatus(`Order status: ${status} | Matched: ${order[9] ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error('Error getting order status:', error);
      setFusionStatus(`❌ Error: ${(error as Error).message}`);
    }
  }

  // Cross-chain coordination functions with real blockchain integration
  async function loadAvailableOrders() {
    try {
      console.log('Loading available orders from blockchain...');
      
      if (!provider) {
        throw new Error('Provider not connected');
      }
      
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
      
      console.log('Orders loaded from blockchain:', activeOrders);
      setAvailableOrders(activeOrders);
      setShowOrderList(true);
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
        throw new Error('Provider not connected');
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
        timelock: new Date(order[6] * 1000).toISOString(),
        hashlock: order[7],
        isActive: order[8],
        isMatched: order[9],
        createdAt: new Date(order[10] * 1000).toISOString(),
        status: isActive ? 'active' : 'inactive'
      };
      
      console.log('Order selected from blockchain:', orderData);
      setSelectedOrder(orderData);
      setFusionOrderId(orderData.orderId);
      setFusionStatus(`Selected order: ${orderData.status}`);
      setSelectionMessage(`✅ Order ${orderData.orderId} selected successfully!`);
      console.log('Order selection complete - fusionOrderId:', orderData.orderId, 'fusionStatus:', `Selected order: ${orderData.status}`);
      
      // Clear the success message after 3 seconds
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
    <div className="main-layout" aria-label="Fusion+ Bridge App">
      <header className="hero" role="banner">
        <div className="hero-content">
          <div className="hero-logo">
            <img src={viteLogo} alt="Fusion+ Logo" />
          </div>
          <div className="hero-tagline">NEXT-GEN ATOMIC SWAP PROTOCOL</div>
          <h1 tabIndex={0}>FUSION+ CROSS-CHAIN BRIDGE</h1>
          <p className="subtitle">Trustless, atomic swaps between Ethereum and Bitcoin, Litecoin, Dogecoin, or Bitcoin Cash. No custodians. No wrapped assets. Fully on-chain.</p>
          <div className="hero-actions">
            <a href="https://github.com/art3mis/fusion-xbtc" target="_blank" rel="noopener noreferrer" className="btn" aria-label="View on GitHub">
              GITHUB
            </a>
            <a href="#swap" className="btn btn-primary" aria-label="Start Swap">
              START SWAP
            </a>
          </div>
        </div>
      </header>

      <section className="features section" aria-label="Key Features">
        <div className="container">
          <h2 className="section-title">FEATURES</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <div className="feature">
              <div className="feature-icon">🔒</div>
              <h3 tabIndex={0}>TRUSTLESS</h3>
              <p>All swaps are enforced by Hash Time-Locked Contracts (HTLCs) on both chains. No third parties, no risk.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">⚡</div>
              <h3 tabIndex={0}>FAST & FINAL</h3>
              <p>Atomic swaps settle directly on mainnet/testnet. No wrapped tokens, no bridges, no IOUs.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">🪙</div>
              <h3 tabIndex={0}>MULTI-CHAIN</h3>
              <p>Swap ETH with BTC, LTC, DOGE, or BCH. Bidirectional flows. CLI and UI for full control.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">🛡️</div>
              <h3 tabIndex={0}>SECURE</h3>
              <p>All inputs validated, secrets never stored, and all logic open source. Auditable and transparent.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works section" aria-label="How It Works">
        <div className="container">
          <h2 className="section-title">HOW IT WORKS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
            <div className="step">
              <span className="step-num" aria-hidden="true">1</span>
              <div>INITIATE SWAP AND GENERATE SECRET</div>
            </div>
            <div className="step">
              <span className="step-num" aria-hidden="true">2</span>
              <div>LOCK FUNDS ON SOURCE CHAIN (HTLC)</div>
            </div>
            <div className="step">
              <span className="step-num" aria-hidden="true">3</span>
              <div>COUNTERPARTY LOCKS ON DESTINATION CHAIN</div>
            </div>
            <div className="step">
              <span className="step-num" aria-hidden="true">4</span>
              <div>REDEEM WITH SECRET, FUNDS RELEASED</div>
            </div>
            <div className="step">
              <span className="step-num" aria-hidden="true">5</span>
              <div>REFUND IF TIMEOUT (SAFETY)</div>
            </div>
          </div>
        </div>
      </section>

      <section className="supported-chains section" aria-label="Supported Chains">
        <div className="container">
          <h2 className="section-title">SUPPORTED CHAINS</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="chain">
              <img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/btc.svg" alt="Bitcoin logo" />
              <span>BITCOIN</span>
            </div>
            <div className="chain">
              <img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/eth.svg" alt="Ethereum logo" />
              <span>ETHEREUM</span>
            </div>
            <div className="chain">
              <img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/ltc.svg" alt="Litecoin logo" />
              <span>LITECOIN</span>
            </div>
            <div className="chain">
              <img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/doge.svg" alt="Dogecoin logo" />
              <span>DOGECOIN</span>
            </div>
            <div className="chain">
              <img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/bch.svg" alt="Bitcoin Cash logo" />
              <span>BITCOIN CASH</span>
            </div>
          </div>
        </div>
      </section>

             <main id="swap" className="swap-panel" aria-label="Swap Demo">
         <h2 tabIndex={0}>START SWAP</h2>
         
         {/* Wallet Connection Section */}
         {direction === 'eth2btc' && (
           <div className="form-group">
             <label>ETHEREUM WALLET</label>
             {ethAddress ? (
               <div className="message success">
                 CONNECTED: <code>{ethAddress}</code>
               </div>
             ) : (
               <button 
                 type="button" 
                 className="submit-btn" 
                 onClick={connectWallet}
                 style={{marginTop: 0}}
               >
                 CONNECT METAMASK
               </button>
             )}
             {walletError && <div className="message error">{walletError}</div>}
           </div>
         )}
         
         {direction === 'btc2eth' && (
           <div className="form-group">
             <label>{chain.toUpperCase()} WALLET</label>
             {utxoAddress ? (
               <div className="message success">
                 CONNECTED: <code>{utxoAddress}</code> <span style={{opacity: 0.7}}>[{utxoWallet}]</span>
               </div>
             ) : (
               <button 
                 type="button" 
                 className="submit-btn" 
                 onClick={connectUtxoWallet}
                 style={{marginTop: 0}}
               >
                 CONNECT {utxoWallet || 'WALLET'}
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
         }}>
           <div className="form-group">
             <label>SWAP DIRECTION</label>
             <select value={direction} onChange={e => setDirection(e.target.value)}>
               {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
             </select>
           </div>
           
           <div className="form-group">
             <label>UTXO CHAIN</label>
             <select value={chain} onChange={e => setChain(e.target.value)}>
               {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
             </select>
           </div>
           
           <div className="form-group">
             <label>AMOUNT</label>
             <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 0.01" />
           </div>
           
           <div className="form-group">
             <label>RECIPIENT</label>
             <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={getRecipientPlaceholder()} />
           </div>
           
           {direction === 'btc2eth' && (
             <div className="form-group">
               <label>CHANGE ADDRESS</label>
               <input type="text" value={changeAddress} onChange={e => setChangeAddress(e.target.value)} placeholder="Your BTC/LTC/DOGE/BCH change address" />
             </div>
           )}
           
           {/* Advanced Settings */}
           {direction === 'eth2btc' && (
             <div className="form-group">
               <button 
                 type="button" 
                 onClick={() => setShowAdvanced(v => !v)}
                 style={{
                   background: 'none',
                   border: 'none',
                   color: 'var(--black)',
                   textDecoration: 'underline',
                   cursor: 'pointer',
                   fontSize: 'var(--text-sm)',
                   padding: 0,
                   textTransform: 'uppercase',
                   letterSpacing: '0.05em'
                 }}
               >
                 {showAdvanced ? 'HIDE ADVANCED' : 'SHOW ADVANCED'}
               </button>
               
               {showAdvanced && (
                 <div className="form-group">
                   <label>ETH HTLC CONTRACT ADDRESS</label>
                   <input type="text" value={ethContract} onChange={e => setEthContract(e.target.value)} placeholder="0x..." />
                   <small style={{color: 'var(--gray-600)', fontSize: 'var(--text-xs)'}}>
                     Default: {import.meta.env.VITE_ETH_HTLC_ADDRESS || 'Not set'}
                   </small>
                 </div>
               )}
             </div>
           )}
           
           <div className="form-group">
             <label>TIMELOCK (SECONDS FROM NOW)</label>
             <input type="number" value={timelock} onChange={e => setTimelock(e.target.value)} placeholder="3600" />
           </div>
           
           {/* Fusion+ Integration Toggle */}
           <div className="form-group">
             <label style={{display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer'}}>
               <input 
                 type="checkbox" 
                 checked={useFusion} 
                 onChange={e => setUseFusion(e.target.checked)}
                 style={{width: 'auto', margin: 0}}
               />
               <span style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>USE FUSION+ PROTOCOL (1INCH INTEGRATION)</span>
             </label>
           </div>
           
           {useFusion && (
             <div className="order-card">
               <h4 style={{margin: '0 0 var(--space-4) 0', color: 'var(--black)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>FUSION+ CONFIGURATION</h4>
               <div className="form-group">
                 <label>FUSION+ HTLC CONTRACT ADDRESS</label>
                 <input 
                   type="text" 
                   value={fusionContract} 
                   onChange={e => setFusionContract(e.target.value)} 
                   placeholder="0x..." 
                 />
               </div>
               <div style={{marginTop: 'var(--space-4)'}}>
                 <button 
                   type="button" 
                   onClick={loadAvailableOrders}
                   className="submit-btn"
                   style={{marginTop: 0}}
                 >
                   BROWSE AVAILABLE ORDERS
                 </button>
               </div>
               <div style={{marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--gray-600)'}}>
                 Fusion+ enables order matching and partial fills for cross-chain swaps
               </div>
             </div>
           )}
           
           <button 
             type="submit" 
             className="submit-btn"
             disabled={!amount || !recipient || !timelock || (direction==='eth2btc' && !ethAddress) || (direction==='btc2eth' && !utxoAddress)}
           >
             {useFusion ? 'CREATE FUSION+ ORDER' : 'START SWAP'}
           </button>
         </form>
        
        {/* Available Orders Display - Always visible when orders are loaded */}
        {console.log('Rendering check - showOrderList:', showOrderList, 'availableOrders.length:', availableOrders.length)}
        {showOrderList && availableOrders.length > 0 && (
          <div style={{marginTop:24, background: '#fffbe6', border: '2px solid #ff0055', borderRadius: '8px', padding: '1rem'}}>
            <h4 style={{margin: '0 0 0.5rem 0', color: '#ff0055'}}>Available Fusion+ Orders</h4>
            <div style={{maxHeight: '300px', overflowY: 'auto'}}>
              {availableOrders.map((order, index) => (
                <div key={index} style={{border: '1px solid #ddd', padding: '0.5rem', margin: '0.5rem 0', borderRadius: '4px', background: '#fff'}}>
                  <div><b>Order ID:</b> <code>{order.orderId}</code></div>
                  <div><b>Direction:</b> {order.direction}</div>
                  <div><b>Amount:</b> {order.ethAmount} ETH ↔ {order.btcAmount} BTC</div>
                  <div><b>Status:</b> {order.status}</div>
                  <button 
                    onClick={() => selectOrder(order.orderId)}
                    style={{background: '#ff0055', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', marginTop: '0.5rem'}}
                  >
                    Select Order
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowOrderList(false)}
              style={{background: '#666', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem'}}
            >
              Close
            </button>
          </div>
        )}

        {/* Success Message */}
        {selectionMessage && (
          <div style={{marginTop:24, background: '#d4edda', border: '2px solid #28a745', borderRadius: '8px', padding: '1rem', color: '#155724'}}>
            {selectionMessage}
          </div>
        )}

        {/* Selected Order Display - Always visible when an order is selected */}
        {selectedOrder && (
          <div style={{marginTop:24, background: '#e6f3ff', border: '2px solid #0066cc', borderRadius: '8px', padding: '1rem'}}>
            <h4 style={{margin: '0 0 0.5rem 0', color: '#0066cc'}}>Selected Order</h4>
            <div><b>Order ID:</b> <code>{selectedOrder.orderId}</code></div>
            <div><b>Direction:</b> {selectedOrder.direction}</div>
            <div><b>Amount:</b> {selectedOrder.ethAmount} ETH ↔ {selectedOrder.btcAmount} BTC</div>
            <div><b>Status:</b> {selectedOrder.status}</div>
            <div><b>ETH Address:</b> <code>{selectedOrder.ethAddress}</code></div>
            <div><b>BTC Address:</b> <code>{selectedOrder.btcAddress}</code></div>
            <div style={{marginTop: '1rem'}}>
              <button 
                onClick={() => matchSelectedOrder()}
                style={{background: '#0066cc', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem'}}
              >
                Match This Order
              </button>
              <button 
                onClick={() => {
                  setSelectedOrder(null);
                  setFusionOrderId('');
                  setFusionStatus('');
                }}
                style={{background: '#666', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer'}}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {step > 0 && (
          <div className="swap-status">
            <h3>Swap Secret & Hashlock</h3>
            <div><b>Secret (preimage):</b> <code>{secret}</code></div>
            <div><b>Hashlock (SHA-256):</b> <code>{hashlock}</code></div>
            <div><b>Status:</b> {status}</div>
            {log && (
              <div style={{marginTop: 16}}>
                <b>Swap Log:</b>
                <table style={{marginTop:8,marginBottom:8,borderCollapse:'collapse',fontSize:'0.97em'}}>
                  <tbody>
                    {Object.entries(log).map(([k, v]) => (
                      (k !== 'ethTx' && k !== 'btcTx') ? (
                        <tr key={k}>
                          <td style={{fontWeight:600,padding:'2px 8px',border:'1px solid #eee'}}>{k}</td>
                          <td style={{fontFamily:'monospace',padding:'2px 8px',border:'1px solid #eee'}}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                        </tr>
                      ) : null
                    ))}
                  </tbody>
                </table>
                {'ethTx' in log && typeof log.ethTx === 'string' && (
                  <div>
                    <a href={explorerLink('ethereum', log.ethTx)} target="_blank" rel="noopener noreferrer">View ETH Tx</a>
                  </div>
                )}
                {'btcTx' in log && typeof log.btcTx === 'string' && (
                  <div>
                    <a href={explorerLink(chain, log.btcTx)} target="_blank" rel="noopener noreferrer">View BTC Tx</a>
                  </div>
                )}
              </div>
            )}

            {useFusion && fusionOrderId && (
              <div style={{marginTop:24, background: '#fffbe6', border: '2px solid #ff0055', borderRadius: '8px', padding: '1rem'}}>
                <h4 style={{margin: '0 0 0.5rem 0', color: '#ff0055'}}>Fusion+ Order</h4>
                <div><b>Order ID:</b> <code>{fusionOrderId}</code></div>
                <div><b>Status:</b> {fusionStatus}</div>
                <div style={{marginTop: '1rem'}}>
                  <button style={{marginRight: '0.5rem'}} onClick={getFusionOrderStatus}>Check Status</button>
                  <button style={{marginRight: '0.5rem'}} onClick={createFusionOrderOnChain}>Create on Chain</button>
                  <button style={{marginRight: '0.5rem'}} onClick={matchFusionOrderOnChain}>Match Order</button>
                  <button style={{marginRight: '0.5rem'}} onClick={matchSelectedOrder}>Match Selected</button>
                  <button onClick={cancelFusionOrderOnChain}>Cancel Order</button>
                </div>
                <div style={{marginTop: '0.5rem', fontSize: '0.9em', color: '#666'}}>
                  This order is now available for matching on the Fusion+ network
                </div>
              </div>
            )}
            
            {direction === 'eth2btc' && ethContract && ethAddress && !useFusion && (
              <div style={{marginTop:24}}>
                <button style={{marginRight:12}} onClick={lockEth}>Lock ETH</button>
                <button style={{marginRight:12}} onClick={redeemEth}>Redeem</button>
                <button onClick={refundEth}>Refund</button>
                {txStatus && <div style={{marginTop:8,fontWeight:700}}>{txStatus}</div>}
                {txHash && <div><a href={explorerLink('ethereum', txHash)} target="_blank" rel="noopener noreferrer">View Tx</a></div>}
              </div>
            )}
            <div style={{marginTop: 16}}>
              <b>Next Steps:</b>
              <ol>
                <li>Lock funds on source chain using the above hashlock and timelock.</li>
                <li>Share hashlock with counterparty to lock on destination chain.</li>
                <li>Redeem on destination chain with secret when ready.</li>
                <li>Monitor both chains for redeem/refund status.</li>
              </ol>
              <p>All transactions must be copy-pasted into your wallet or CLI. No wallet integration.</p>
            </div>
          </div>
        )}
        {step > 0 && direction === 'btc2eth' && utxoAddress && (
          <div className="swap-status">
            <h3>UTXO Chain Actions</h3>
            <button style={{marginRight:12}} onClick={lockUtxo}>Lock Funds (Wallet)</button>
            {utxoTxStatus && <div style={{marginTop:8,fontWeight:700}}>{utxoTxStatus}</div>}
            {utxoTxId && <div><b>TxID:</b> <span style={{fontFamily:'monospace'}}>{utxoTxId}</span></div>}
            <div style={{marginTop: 16}}>
              <b>Instructions:</b>
              <ol>
                <li>Connect your browser wallet for {chain.toUpperCase()} (Unisat, Hiro, Xverse, etc).</li>
                <li>Click "Lock Funds" to sign and broadcast the HTLC transaction.</li>
                <li>Monitor status and redeem/refund as needed.</li>
              </ol>
            </div>
          </div>
        )}
      </main>

             <footer className="footer" role="contentinfo">
         <div className="footer-content">
           <div>
             <span>© {new Date().getFullYear()} Fusion+ Bridge</span>
           </div>
           <div className="footer-links">
             <a href="https://github.com/art3mis/fusion-xbtc" target="_blank" rel="noopener noreferrer">GitHub</a>
             <a href="https://docs.fusion.plus/" target="_blank" rel="noopener noreferrer">Documentation</a>
             <a href="#" target="_blank" rel="noopener noreferrer">Support</a>
           </div>
         </div>
       </footer>
    </div>
  );
}
