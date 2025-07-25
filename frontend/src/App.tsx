import { useState, useEffect } from 'react';
import './App.css';

const CHAINS = [
  { label: 'Bitcoin', value: 'bitcoin' },
  { label: 'Litecoin', value: 'litecoin' },
  { label: 'Dogecoin', value: 'dogecoin' },
];

const DIRECTIONS = [
  { label: 'ETH → BTC/LTC/DOGE', value: 'eth2btc' },
  { label: 'BTC/LTC/DOGE → ETH', value: 'btc2eth' },
];

function explorerLink(chain: string, tx: string) {
  if (chain === 'bitcoin') return `https://mempool.space/testnet/tx/${tx}`;
  if (chain === 'litecoin') return `https://blockcypher.com/ltc-testnet/tx/${tx}`;
  if (chain === 'dogecoin') return `https://blockexplorer.one/dogecoin/testnet/tx/${tx}`;
  if (chain === 'ethereum') return `https://sepolia.etherscan.io/tx/${tx}`;
  return '#';
}

function App() {
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

  function handleStart() {
    generateSecret();
    setStep(1);
    setStatus('Secret generated. Proceed to lock funds on source chain.');
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
    <div className="swap-demo">
      <h1>Fusion+ Cross-Chain Swap Demo</h1>
      <div className="swap-form">
        <label>
          Swap Direction:
          <select value={direction} onChange={e => setDirection(e.target.value)}>
            {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        <label>
          UTXO Chain:
          <select value={chain} onChange={e => setChain(e.target.value)}>
            {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label>
          Amount:
          <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 0.01" />
        </label>
        <label>
          Recipient:
          <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={direction === 'eth2btc' ? 'BTC/LTC/DOGE pubkey' : 'ETH address'} />
        </label>
        <label>
          Timelock (seconds from now):
          <input type="number" value={timelock} onChange={e => setTimelock(e.target.value)} placeholder="3600" />
        </label>
        <button onClick={handleStart} disabled={!amount || !recipient || !timelock}>Start Swap</button>
      </div>
      {step > 0 && (
        <div className="swap-status">
          <h2>Swap Secret & Hashlock</h2>
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
    </div>
  );
}

export default App;
