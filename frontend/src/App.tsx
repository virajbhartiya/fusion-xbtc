import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

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

  useEffect(() => {
    if (!hashlock) return;
    const interval = setInterval(() => {
      fetch(`/api/track?hashlock=${hashlock}`)
        .then(r => r.ok ? r.json() : null)
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
    <div className="main-layout">
      <header className="hero">
        <div className="hero-content">
          <div className="hero-tagline">Next-Gen Atomic Swap Protocol</div>
          <h1>Fusion+ Cross-Chain Bridge</h1>
          <p className="subtitle">Trustless, atomic swaps between Ethereum and Bitcoin, Litecoin, Dogecoin, or Bitcoin Cash. No custodians. No wrapped assets. Fully on-chain.</p>
          <div className="hero-actions">
            <a href="https://github.com/art3mis/fusion-xbtc" target="_blank" rel="noopener noreferrer" className="hero-link">View on GitHub</a>
            <a href="#swap" className="hero-link primary">Start Swap</a>
          </div>
        </div>
        <svg className="hero-divider" viewBox="0 0 1440 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 32L1440 0V32H0Z" fill="#fff"/></svg>
      </header>

      <section className="features">
        <div className="feature">
          <h3>🔒 100% Trustless</h3>
          <p>All swaps are enforced by Hash Time-Locked Contracts (HTLCs) on both chains. No third parties, no risk.</p>
        </div>
        <div className="feature">
          <h3>⚡ Fast & Final</h3>
          <p>Atomic swaps settle directly on mainnet/testnet. No wrapped tokens, no bridges, no IOUs.</p>
        </div>
        <div className="feature">
          <h3>🪙 Multi-Chain</h3>
          <p>Swap ETH with BTC, LTC, DOGE, or BCH. Bidirectional flows. CLI and UI for full control.</p>
        </div>
        <div className="feature">
          <h3>🛡️ Secure by Design</h3>
          <p>All inputs validated, secrets never stored, and all logic open source. Auditable and transparent.</p>
        </div>
      </section>

      <main id="swap" className="swap-panel">
        <h2>Swap Demo</h2>
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
            <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={direction === 'eth2btc' ? 'BTC/LTC/DOGE/BCH pubkey' : 'ETH address'} />
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
          <button type="submit" disabled={!amount || !recipient || !timelock || (direction==='eth2btc' && !ethAddress) || (direction==='btc2eth' && !changeAddress)}>Start Swap</button>
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
      </main>

      <footer className="footer">
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
