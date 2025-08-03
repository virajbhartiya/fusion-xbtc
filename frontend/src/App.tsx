import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
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
      setFusionStatus('Error: Wallet not connected');
      return;
    }

    setFusionStatus('Creating Fusion+ order on blockchain...');
    try {
      const orderId = ethers.keccak256(ethers.toUtf8Bytes(`fusion-${Date.now()}-${Math.random()}`));
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const hashlock = ethers.keccak256(secret);
      const orderTimelock = Math.floor(Date.now() / 1000) + parseInt(timelock);
      
      const ethAmount = ethers.parseEther(amount);
      const btcAmount = ethers.parseEther(amount);
      
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
      
      // Check if provider is connected
      if (!provider) {
        setFusionStatus('❌ Please connect your wallet first');
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
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <a href="#" className="logo animate-fade-in">Fusion+</a>
          <nav>
            <ul className="nav-links">
              <li><a href="#swap" className="animate-slide-in-left">Demo</a></li>
              <li><a href="#explainer" className="animate-slide-in-right">About</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-content">
          <h1 className="animate-fade-in-up">Swap crypto. No friction. No noise.</h1>
          <p className="subtitle animate-fade-in-up">A seamless interface to move assets across chains, designed for clarity and trust.</p>
          <div className="hero-actions">
            <a href="https://github.com/art3mis/fusion-xbtc" target="_blank" rel="noopener noreferrer" className="btn btn-secondary animate-fade-in-up">
              View on GitHub
            </a>
            <a href="#swap" className="btn btn-primary btn-large animate-fade-in-up">
              Launch Demo
            </a>
          </div>
        </div>
      </section>



      <section id="swap" className="swap-interface">
        <div className="swap-container">
          <div className="swap-card animate-fade-in-up">
            <div className="swap-header">
              <h2 className="swap-title">Start a Swap</h2>
              <p className="swap-subtitle">Configure your cross-chain atomic swap</p>
            </div>
            
            {direction === 'eth2btc' && (
              <div className="form-group">
                <label className="form-label">Ethereum wallet</label>
                {ethAddress ? (
                  <div className="message success">
                    Connected: <code>{ethAddress}</code>
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
              <div className="form-group">
                <label className="form-label">{chain.toUpperCase()} wallet</label>
                {utxoAddress ? (
                  <div className="message success">
                    Connected: <code>{utxoAddress}</code> <span style={{opacity: 0.7}}>[{utxoWallet}]</span>
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
            }}>
              <div className="form-group">
                <label className="form-label">Swap direction</label>
                <select className="form-select" value={direction} onChange={e => setDirection(e.target.value)}>
                  {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">UTXO chain</label>
                <select className="form-select" value={chain} onChange={e => setChain(e.target.value)}>
                  {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 0.01" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Recipient address</label>
                <input className="form-input" type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={getRecipientPlaceholder()} />
              </div>
              
              {direction === 'btc2eth' && (
                <div className="form-group">
                  <label className="form-label">Change address</label>
                  <input className="form-input" type="text" value={changeAddress} onChange={e => setChangeAddress(e.target.value)} placeholder="Your BTC/LTC/DOGE/BCH change address" />
                </div>
              )}
              
              {direction === 'eth2btc' && (
                <div className="form-group">
                  <button 
                    type="button" 
                    onClick={() => setShowAdvanced(v => !v)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-600)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      padding: 0,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: '600',
                      transition: 'color var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-700)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary-600)'}
                  >
                    {showAdvanced ? 'Hide advanced' : 'Show advanced'}
                  </button>
                  
                  {showAdvanced && (
                    <div className="form-group">
                      <label className="form-label">ETH HTLC contract address</label>
                      <input className="form-input" type="text" value={ethContract} onChange={e => setEthContract(e.target.value)} placeholder="0x..." />
                      <small style={{color: 'var(--gray-600)', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem'}}>
                        Default: {import.meta.env.VITE_ETH_HTLC_ADDRESS || 'Not set'}
                      </small>
                    </div>
                  )}
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Timelock (seconds from now)</label>
                <input className="form-input" type="number" value={timelock} onChange={e => setTimelock(e.target.value)} placeholder="3600" />
              </div>
              
              <div className="form-group">
                <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'}}>
                  <input 
                    type="checkbox" 
                    checked={useFusion} 
                    onChange={e => setUseFusion(e.target.checked)}
                    style={{width: 'auto', margin: 0, accentColor: 'var(--primary-600)'}}
                  />
                  <span style={{textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.875rem'}}>Use Fusion+ protocol (1inch integration)</span>
                </label>
              </div>
              
              {useFusion && (
                <div className="message info">
                  <h4>Fusion+ configuration</h4>
                  <div className="form-group">
                    <label className="form-label">Fusion+ HTLC contract address</label>
                    <input 
                      className="form-input" 
                      type="text" 
                      value={fusionContract} 
                      onChange={e => setFusionContract(e.target.value)} 
                      placeholder="0x..." 
                    />
                  </div>
                  <div style={{marginTop: '1rem'}}>
                    <button 
                      type="button" 
                      onClick={loadAvailableOrders}
                      className="btn btn-secondary"
                    >
                      Browse available orders
                    </button>
                  </div>
                  <div style={{marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-600)'}}>
                    Fusion+ enables order matching and partial fills for cross-chain swaps
                  </div>
                </div>
              )}
              
              <button 
                type="submit" 
                className="btn btn-primary btn-large btn-full"
                disabled={!amount || !recipient || !timelock || (direction==='eth2btc' && !ethAddress) || (direction==='btc2eth' && !utxoAddress)}
              >
                {useFusion ? 'Create Fusion+ order' : 'Start swap'}
              </button>
            </form>
            
            {showOrderList && availableOrders.length > 0 && (
              <div className="message info">
                <h4>Available Fusion+ orders</h4>
                <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                  {availableOrders.map((order, index) => (
                    <div key={index} style={{margin: '0.5rem 0', padding: '1rem', background: 'var(--white)', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)'}}>
                      <div><strong>Order ID:</strong> <code>{order.orderId}</code></div>
                      <div><strong>Direction:</strong> {order.direction}</div>
                      <div><strong>Amount:</strong> {order.ethAmount} ETH ↔ {order.btcAmount} BTC</div>
                      <div><strong>Status:</strong> {order.status}</div>
                      <button 
                        onClick={() => selectOrder(order.orderId)}
                        className="btn btn-primary"
                        style={{marginTop: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem'}}
                      >
                        Select order
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setShowOrderList(false)}
                  className="btn btn-secondary"
                  style={{marginTop: '1rem'}}
                >
                  Close
                </button>
              </div>
            )}

            {selectionMessage && (
              <div className="message success">
                {selectionMessage}
              </div>
            )}

            {selectedOrder && (
              <div className="message info">
                <h4>Selected order</h4>
                <div><strong>Order ID:</strong> <code>{selectedOrder.orderId}</code></div>
                <div><strong>Direction:</strong> {selectedOrder.direction}</div>
                <div><strong>Amount:</strong> {selectedOrder.ethAmount} ETH ↔ {selectedOrder.btcAmount} BTC</div>
                <div><strong>Status:</strong> {selectedOrder.status}</div>
                <div><strong>ETH address:</strong> <code>{selectedOrder.ethAddress}</code></div>
                <div><strong>BTC address:</strong> <code>{selectedOrder.btcAddress}</code></div>
                <div style={{marginTop: '1rem'}}>
                  <button 
                    onClick={() => matchSelectedOrder()}
                    className="btn btn-primary"
                    style={{marginRight: '0.5rem'}}
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
              <div className="message info">
                <h3>Swap secret & hashlock</h3>
                <div><strong>Secret (preimage):</strong> <code>{secret}</code></div>
                <div><strong>Hashlock (SHA-256):</strong> <code>{hashlock}</code></div>
                <div><strong>Status:</strong> {status}</div>
                {log && (
                  <div style={{marginTop: '1rem'}}>
                    <strong>Swap log:</strong>
                    <div style={{marginTop: '0.5rem', fontSize: '0.875rem', background: 'var(--gray-50)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)'}}>
                      {Object.entries(log).map(([k, v]) => (
                        (k !== 'ethTx' && k !== 'btcTx') ? (
                          <div key={k} style={{marginBottom: '0.5rem'}}>
                            <strong>{k}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </div>
                        ) : null
                      ))}
                    </div>
                    {'ethTx' in log && typeof log.ethTx === 'string' && (
                      <div style={{marginTop: '0.5rem'}}>
                        <a href={`https://sepolia.etherscan.io/tx/${log.ethTx}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{display: 'inline-block', padding: '0.5rem 1rem'}}>View ETH transaction</a>
                      </div>
                    )}
                    {'btcTx' in log && typeof log.btcTx === 'string' && (
                      <div style={{marginTop: '0.5rem'}}>
                        <a href={`https://mempool.space/testnet/tx/${log.btcTx}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{display: 'inline-block', padding: '0.5rem 1rem'}}>View {chain.toUpperCase()} transaction</a>
                      </div>
                    )}
                  </div>
                )}

                {useFusion && fusionOrderId && (
                  <div className="message info">
                    <h4>Fusion+ order</h4>
                    <div><strong>Order ID:</strong> <code>{fusionOrderId}</code></div>
                    <div><strong>Status:</strong> {fusionStatus}</div>
                    {log && typeof log === 'object' && 'txHash' in log && typeof log.txHash === 'string' && (
                      <div style={{marginTop: '0.5rem'}}>
                        <strong>Transaction Hash:</strong> <code>{log.txHash}</code>
                        <div style={{marginTop: '0.5rem'}}>
                          <a 
                            href={`https://sepolia.etherscan.io/tx/${log.txHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-secondary"
                            style={{display: 'inline-block', padding: '0.5rem 1rem', fontSize: '0.875rem'}}
                          >
                            View on Etherscan
                          </a>
                        </div>
                      </div>
                    )}
                    <div style={{marginTop: '1rem'}}>
                      <button className="btn btn-primary" style={{marginRight: '0.5rem'}} onClick={() => {}}>Check status</button>
                      <button className="btn btn-primary" style={{marginRight: '0.5rem'}} onClick={() => {}}>Create on chain</button>
                      <button className="btn btn-primary" style={{marginRight: '0.5rem'}} onClick={() => {}}>Match order</button>
                      <button className="btn btn-primary" style={{marginRight: '0.5rem'}} onClick={() => matchSelectedOrder()}>Match selected</button>
                      <button className="btn btn-secondary" onClick={() => {}}>Cancel order</button>
                    </div>
                    <div style={{marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-600)'}}>
                      This order is now available for matching on the Fusion+ network
                    </div>
                  </div>
                )}
                
                {direction === 'eth2btc' && ethContract && ethAddress && !useFusion && (
                  <div style={{marginTop: '1.5rem'}}>
                    <button className="btn btn-primary" style={{marginRight: '0.5rem'}} onClick={lockEth}>Lock ETH</button>
                    <button className="btn btn-primary" style={{marginRight: '0.5rem'}} onClick={redeemEth}>Redeem</button>
                    <button className="btn btn-secondary" onClick={refundEth}>Refund</button>
                    {txStatus && <div className="message info" style={{marginTop: '0.5rem'}}>{txStatus}</div>}
                    {txHash && <div style={{marginTop: '0.5rem'}}><a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{display: 'inline-block', padding: '0.5rem 1rem'}}>View transaction</a></div>}
                  </div>
                )}
                <div style={{marginTop: '1rem'}}>
                  <strong>Next steps:</strong>
                  <ol style={{marginTop: '0.5rem', paddingLeft: '1.5rem'}}>
                    <li>Lock funds on source chain using the above hashlock and timelock.</li>
                    <li>Share hashlock with counterparty to lock on destination chain.</li>
                    <li>Redeem on destination chain with secret when ready.</li>
                    <li>Monitor both chains for redeem/refund status.</li>
                  </ol>
                  <p style={{marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-600)'}}>All transactions must be copy-pasted into your wallet or CLI. No wallet integration.</p>
                </div>
              </div>
            )}
            {step > 0 && direction === 'btc2eth' && utxoAddress && (
              <div className="message info">
                <h3>UTXO chain actions</h3>
                <button className="btn btn-primary" style={{marginRight: '0.5rem'}} onClick={lockUtxo}>Lock funds (wallet)</button>
                {utxoTxStatus && <div style={{marginTop: '0.5rem'}}>{utxoTxStatus}</div>}
                {utxoTxId && <div style={{marginTop: '0.5rem'}}><strong>TxID:</strong> <code>{utxoTxId}</code></div>}
                <div style={{marginTop: '1rem'}}>
                  <strong>Instructions:</strong>
                  <ol style={{marginTop: '0.5rem', paddingLeft: '1.5rem'}}>
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

      <section id="explainer" className="explainer">
        <div className="explainer-content">
          <div className="explainer-header">
            <h2 className="explainer-title">What is this?</h2>
            <p className="explainer-subtitle">
              This tool allows you to transfer crypto assets across different blockchains using the best available routes in real time.
            </p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">No custodial risk</h3>
              <p className="feature-description">
                Your assets remain in your control throughout the entire process. No third-party custody required.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🛣️</div>
              <h3 className="feature-title">Optimized liquidity routes</h3>
              <p className="feature-description">
                Automatically finds the best available paths across multiple bridges and exchanges.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3 className="feature-title">Live status updates</h3>
              <p className="feature-description">
                Real-time tracking of your swap progress across both source and destination chains.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="hackathon-footer">
        <div className="hackathon-content">
          <p className="hackathon-text">Built for ETHGlobal. Designed for people who care about UX.</p>
          <a href="https://github.com/art3mis/fusion-xbtc" target="_blank" rel="noopener noreferrer" className="hackathon-link">GitHub</a>
        </div>
      </section>
    </div>
  );
}
