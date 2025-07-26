import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import viteLogo from '/vite.svg';
import type { Eip1193Provider } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';

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

async function fetchUtxos(address: string, network: bitcoin.Network): Promise<{ txid: string; vout: number; value: number }[]> {
  const baseUrl = network === bitcoin.networks.testnet
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
      const network = bitcoin.networks.testnet;
      const utxos = await fetchUtxos(utxoAddress, network);
      if (!utxos.length) throw new Error('No UTXOs found for address');
      const unisatPubkeyHex = import.meta.env.VITE_UNISAT_PUBKEY;
      if (!unisatPubkeyHex) throw new Error('VITE_UNISAT_PUBKEY env variable not set');
      const { Buffer } = await import('buffer');
      const recipientPubkey = Buffer.from(unisatPubkeyHex, 'hex');
      const refundPubkey = Buffer.from(unisatPubkeyHex, 'hex');
      const hashlockBuf = Buffer.from(hashlock, 'hex');
      const locktimeNum = parseInt(timelock, 10);
      const htlc = bitcoin.payments.p2sh({
        redeem: { output: bitcoin.script.compile([
          bitcoin.opcodes.OP_IF,
            recipientPubkey,
            bitcoin.opcodes.OP_CHECKSIGVERIFY,
            bitcoin.opcodes.OP_SHA256,
            hashlockBuf,
            bitcoin.opcodes.OP_EQUALVERIFY,
          bitcoin.opcodes.OP_ELSE,
            bitcoin.script.number.encode(locktimeNum),
            bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
            bitcoin.opcodes.OP_DROP,
            refundPubkey,
            bitcoin.opcodes.OP_CHECKSIGVERIFY,
          bitcoin.opcodes.OP_ENDIF,
        ]) }
      });
      if (!htlc.address) throw new Error('Failed to build HTLC address');
      const amountSats = Math.floor(Number(amount) * 1e8);
      const feeSats = 500;
      const psbt = new bitcoin.Psbt({ network });
      let inputSum = 0;
      utxos.forEach(utxo => {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: { script: bitcoin.address.toOutputScript(utxoAddress, network), value: utxo.value },
        });
        inputSum += utxo.value;
      });
      psbt.addOutput({ address: htlc.address, value: amountSats });
      const change = inputSum - amountSats - feeSats;
      if (change > 0) {
        psbt.addOutput({ address: changeAddress, value: change });
      }
      const psbtHex = psbt.toHex();
      const unisat = (window as unknown as { unisat?: { signPsbt: (psbtHex: string) => Promise<string>; pushPsbt: (signedPsbtHex: string) => Promise<string> } }).unisat;
      if (!unisat) throw new Error('Unisat wallet not found');
      const signedPsbtHex = await unisat.signPsbt(psbtHex);
      const txid = await unisat.pushPsbt(signedPsbtHex);
      setUtxoTxStatus('Transaction signed and broadcast.');
      setUtxoTxId(txid);
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
          <div className="chain"><img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/btc.svg" alt="Bitcoin logo" /><span>Bitcoin</span></div>
          <div className="chain"><img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/eth.svg" alt="Ethereum logo" /><span>Ethereum</span></div>
          <div className="chain"><img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/ltc.svg" alt="Litecoin logo" /><span>Litecoin</span></div>
          <div className="chain"><img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/doge.svg" alt="Dogecoin logo" /><span>Dogecoin</span></div>
          <div className="chain"><img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/svg/color/bch.svg" alt="Bitcoin Cash logo" /><span>Bitcoin Cash</span></div>
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
