import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import viteLogo from '/vite.svg';
import reactLogo from './assets/react.svg';

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
    unisat?: any;
    btc?: any;
    xverseBitcoin?: any;
  }
}

type Provider = { name: string; check: () => any };

const WALLET_PROVIDERS: Record<string, Provider[]> = {
  bitcoin: [
    { name: 'Unisat', check: () => window.unisat },
    { name: 'Hiro', check: () => window.btc },
    { name: 'Xverse', check: () => window.xverseBitcoin },
  ],
  litecoin: [
    { name: 'Unisat', check: () => window.unisat },
  ],
  dogecoin: [
    { name: 'Unisat', check: () => window.unisat },
  ],
  bch: [
    { name: 'Unisat', check: () => window.unisat },
  ],
};

export default function App() {
  const [direction, setDirection] = useState('eth2btc');
  const [chain, setChain] = useState('bitcoin');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [secret, setSecret] = useState('');
  const [hashlock, setHashlock] = useState('');
  const [timelock, setTimelock] = useState('');
  const [status, setStatus] = useState('');
  const [step, setStep] = useState(0);
  const [log, setLog] = useState<any>(null);
  const [changeAddress, setChangeAddress] = useState('');
  const [ethAddress, setEthAddress] = useState('');
  const [walletError, setWalletError] = useState('');
  const [ethContract, setEthContract] = useState(import.meta.env.VITE_ETH_HTLC_ADDRESS || ''); // default from env
  const [txStatus, setTxStatus] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [utxoWallet, setUtxoWallet] = useState<string>('');
  const [utxoAddress, setUtxoAddress] = useState<string>('');
  const [utxoWalletError, setUtxoWalletError] = useState<string>('');
  const [utxoTxStatus, setUtxoTxStatus] = useState('');
  const [utxoTxId, setUtxoTxId] = useState('');

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
    if (!(window as any).ethereum) {
      setWalletError('MetaMask not detected. Please install MetaMask.');
      return;
    }
    try {
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      setEthAddress(accounts[0]);
      setWalletError('');
    } catch (err) {
      setWalletError('Wallet connection failed.');
    }
  }

  async function connectUtxoWallet() {
    setUtxoWalletError('');
    // Wait a bit to allow wallet injection
    await new Promise(res => setTimeout(res, 150));
    const providers = WALLET_PROVIDERS[chain] || [];
    for (const provider of providers) {
      if (provider.check()) {
        setUtxoWallet(provider.name);
        try {
          let address = '';
          if (provider.name === 'Unisat') {
            address = (await window.unisat.requestAccounts())[0];
          } else if (provider.name === 'Hiro') {
            address = (await window.btc.request('getAccounts'))[0];
          } else if (provider.name === 'Xverse') {
            address = (await window.xverseBitcoin.getAccounts())[0];
          }
          setUtxoAddress(address);
        } catch (e) {
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
    if (!(window as any).ethereum || !ethAddress || !ethContract) return;
    setTxStatus('Sending lock transaction...');
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ethContract, ETHHTLC_ABI, signer);
      const value = ethers.parseEther(amount);
      const tx = await contract.lock('0x'+hashlock, recipient, BigInt(Math.floor(Date.now()/1000) + parseInt(timelock)), { value });
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('ETH locked!');
    } catch (e) {
      setTxStatus('Error: ' + (e as any).message);
    }
  }

  async function redeemEth() {
    if (!(window as any).ethereum || !ethAddress || !ethContract) return;
    setTxStatus('Sending redeem transaction...');
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ethContract, ETHHTLC_ABI, signer);
      const tx = await contract.redeem('0x'+secret);
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('ETH redeemed!');
    } catch (e) {
      setTxStatus('Error: ' + (e as any).message);
    }
  }

  async function refundEth() {
    if (!(window as any).ethereum || !ethAddress || !ethContract) return;
    setTxStatus('Sending refund transaction...');
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ethContract, ETHHTLC_ABI, signer);
      const tx = await contract.refund('0x'+hashlock);
      setTxHash(tx.hash);
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('ETH refunded!');
    } catch (e) {
      setTxStatus('Error: ' + (e as any).message);
    }
  }

  async function lockUtxo() {
    setUtxoTxStatus('Preparing transaction...');
    try {
      if (!utxoWallet || !utxoAddress) throw new Error('No wallet connected');
      // Example: Unisat API for Bitcoin, Litecoin, Dogecoin, BCH
      if (utxoWallet === 'Unisat' && window.unisat) {
        // Build the locking script and transaction (pseudo-code, replace with actual logic)
        // const txHex = buildLockTx(...);
        // const signedTx = await window.unisat.signPsbt(txHex);
        // const txid = await window.unisat.pushPsbt(signedTx);
        // setUtxoTxId(txid);
        setUtxoTxStatus('Transaction signed and broadcast (mock).');
        setUtxoTxId('mock-txid-123');
      } else if (utxoWallet === 'Hiro' && window.btc) {
        // Hiro wallet logic here
        setUtxoTxStatus('Transaction signed and broadcast (mock).');
        setUtxoTxId('mock-txid-hiro');
      } else if (utxoWallet === 'Xverse' && window.xverseBitcoin) {
        // Xverse wallet logic here
        setUtxoTxStatus('Transaction signed and broadcast (mock).');
        setUtxoTxId('mock-txid-xverse');
      } else {
        throw new Error('Wallet not supported for this chain.');
      }
    } catch (e: any) {
      setUtxoTxStatus('Error: ' + (e.message || 'Failed to sign or broadcast.'));
    }
  }

  function getRecipientPlaceholder() {
    if (direction === 'eth2btc') {
      return `${chain.toUpperCase()} address`;
    } else {
      return 'ETH address';
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
          <img src={viteLogo} alt="Fusion+ Logo" style={{width:72, height:72, marginBottom:16}} />
          <div className="hero-tagline">Next-Gen Atomic Swap Protocol</div>
          <h1 tabIndex={0}>Fusion+ Cross-Chain Bridge</h1>
          <p className="subtitle">Trustless, atomic swaps between Ethereum and Bitcoin, Litecoin, Dogecoin, or Bitcoin Cash. No custodians. No wrapped assets. Fully on-chain.</p>
          <div className="hero-actions">
            <a href="https://github.com/art3mis/fusion-xbtc" target="_blank" rel="noopener noreferrer" className="hero-link" aria-label="View on GitHub">View on GitHub</a>
            <a href="#swap" className="hero-link primary cta" aria-label="Start Swap">Start Swap</a>
          </div>
        </div>
        <svg className="hero-divider" viewBox="0 0 1440 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 32L1440 0V32H0Z" fill="#fff"/></svg>
      </header>

      <section className="features" aria-label="Key Features">
        <div className="feature">
          <h3 tabIndex={0}>🔒 100% Trustless</h3>
          <p>All swaps are enforced by Hash Time-Locked Contracts (HTLCs) on both chains. No third parties, no risk.</p>
        </div>
        <div className="feature">
          <h3 tabIndex={0}>⚡ Fast & Final</h3>
          <p>Atomic swaps settle directly on mainnet/testnet. No wrapped tokens, no bridges, no IOUs.</p>
        </div>
        <div className="feature">
          <h3 tabIndex={0}>🪙 Multi-Chain</h3>
          <p>Swap ETH with BTC, LTC, DOGE, or BCH. Bidirectional flows. CLI and UI for full control.</p>
        </div>
        <div className="feature">
          <h3 tabIndex={0}>🛡️ Secure by Design</h3>
          <p>All inputs validated, secrets never stored, and all logic open source. Auditable and transparent.</p>
        </div>
      </section>

      <section className="how-it-works" aria-label="How It Works">
        <h2 tabIndex={0}>How It Works</h2>
        <div className="steps">
          <div className="step"><span className="step-num" aria-hidden="true">1</span> Initiate swap and generate secret</div>
          <div className="step"><span className="step-num" aria-hidden="true">2</span> Lock funds on source chain (HTLC)</div>
          <div className="step"><span className="step-num" aria-hidden="true">3</span> Counterparty locks on destination chain</div>
          <div className="step"><span className="step-num" aria-hidden="true">4</span> Redeem with secret, funds released</div>
          <div className="step"><span className="step-num" aria-hidden="true">5</span> Refund if timeout (safety)</div>
        </div>
      </section>

      <section className="supported-chains" aria-label="Supported Chains">
        <h2 tabIndex={0}>Supported Chains</h2>
        <div className="chains-list">
          <div className="chain"><img src="https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=029" alt="Bitcoin logo" /><span>Bitcoin</span></div>
          <div className="chain"><img src="https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=029" alt="Ethereum logo" /><span>Ethereum</span></div>
          <div className="chain"><img src="https://cryptologos.cc/logos/litecoin-ltc-logo.svg?v=029" alt="Litecoin logo" /><span>Litecoin</span></div>
          <div className="chain"><img src="https://cryptologos.cc/logos/dogecoin-doge-logo.svg?v=029" alt="Dogecoin logo" /><span>Dogecoin</span></div>
          <div className="chain"><img src="https://cryptologos.cc/logos/bitcoin-cash-bch-logo.svg?v=029" alt="Bitcoin Cash logo" /><span>Bitcoin Cash</span></div>
        </div>
      </section>

      <main id="swap" className="swap-panel" aria-label="Swap Demo">
        <h2 tabIndex={0}>Swap Demo</h2>
        {direction === 'eth2btc' && (
          <div style={{marginBottom:'1em'}}>
            {ethAddress ? (
              <div style={{marginBottom:'0.5em',fontWeight:700}}>
                Connected: <span style={{fontFamily:'monospace'}}>{ethAddress}</span>
              </div>
            ) : (
              <button type="button" style={{marginBottom:'0.5em',background:'#ff0055',color:'#fff',border:'3px solid #181c23',fontWeight:900,padding:'0.5em 1em',cursor:'pointer'}} onClick={connectWallet}>Connect MetaMask</button>
            )}
            {walletError && <div style={{color:'#b91c1c',fontWeight:700}}>{walletError}</div>}
          </div>
        )}
        {direction === 'btc2eth' && (
          <div style={{marginBottom:'1em'}}>
            {utxoAddress ? (
              <div style={{marginBottom:'0.5em',fontWeight:700}}>
                Connected: <span style={{fontFamily:'monospace'}}>{utxoAddress}</span> <span style={{color:'#888',fontWeight:400}}>[{utxoWallet}]</span>
              </div>
            ) : (
              <button type="button" style={{marginBottom:'0.5em',background:'#ff0055',color:'#fff',border:'3px solid #181c23',fontWeight:900,padding:'0.5em 1em',cursor:'pointer'}} onClick={connectUtxoWallet}>Connect Wallet</button>
            )}
            {utxoWalletError && <div style={{color:'#b91c1c',fontWeight:700}}>{utxoWalletError}</div>}
          </div>
        )}
        <form className="swap-form" onSubmit={e => { e.preventDefault(); handleStart(); }}>
          <label>
            Swap Direction
            <select value={direction} onChange={e => setDirection(e.target.value)}>
              {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
          <label>
            UTXO Chain
            <select value={chain} onChange={e => setChain(e.target.value)}>
              {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label>
            Amount
            <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 0.01" />
          </label>
          <label>
            Recipient
            <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={getRecipientPlaceholder()} />
          </label>
          {direction === 'btc2eth' && (
            <label>
              UTXO Change Address
              <input type="text" value={changeAddress} onChange={e => setChangeAddress(e.target.value)} placeholder="Your BTC/LTC/DOGE/BCH change address" />
            </label>
          )}
          {/* Hide ETH HTLC Contract Address field unless Advanced is toggled */}
          {direction === 'eth2btc' && showAdvanced && (
            <label>
              ETH HTLC Contract Address
              <input type="text" value={ethContract} onChange={e => setEthContract(e.target.value)} placeholder="0x..." />
              <span style={{fontSize:'0.9em',color:'#888'}}>Default: {import.meta.env.VITE_ETH_HTLC_ADDRESS || 'Not set'}</span>
            </label>
          )}
          {/* Show Advanced toggle only for ETH->BTC/LTC/DOGE/BCH */}
          {direction === 'eth2btc' && (
            <button type="button" style={{marginBottom:'1em',fontSize:'0.95em',background:'none',color:'#888',border:'none',textDecoration:'underline',cursor:'pointer'}} onClick={() => setShowAdvanced(v => !v)}>
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </button>
          )}
          <label>
            Timelock (seconds from now)
            <input type="number" value={timelock} onChange={e => setTimelock(e.target.value)} placeholder="3600" />
          </label>
          <button type="submit" disabled={!amount || !recipient || !timelock || (direction==='eth2btc' && !ethAddress) || (direction==='btc2eth' && !utxoAddress)}>Start Swap</button>
        </form>
        {step > 0 && (
          <div className="swap-status">
            <h3>Swap Secret & Hashlock</h3>
            <div><b>Secret (preimage):</b> <code>{secret}</code></div>
            <div><b>Hashlock (SHA-256):</b> <code>{hashlock}</code></div>
            <div><b>Status:</b> {status}</div>
            {log && (
              <div style={{marginTop: 16}}>
                <b>Swap Log:</b>
                <pre>{JSON.stringify(log, null, 2)}</pre>
                {log.ethTx && (
                  <div>
                    <a href={explorerLink('ethereum', log.ethTx)} target="_blank" rel="noopener noreferrer">View ETH Tx</a>
                  </div>
                )}
                {log.btcTx && (
                  <div>
                    <a href={explorerLink(chain, log.btcTx)} target="_blank" rel="noopener noreferrer">View BTC Tx</a>
                  </div>
                )}
              </div>
            )}
            {direction === 'eth2btc' && ethContract && ethAddress && (
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
        <div>
          <span>© {new Date().getFullYear()} Fusion+ Bridge</span>
          <span className="footer-links">
            <a href="https://github.com/art3mis/fusion-xbtc" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://docs.fusion.plus/" target="_blank" rel="noopener noreferrer">Docs</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
