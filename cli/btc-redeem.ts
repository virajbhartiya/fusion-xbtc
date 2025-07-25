import { z } from 'zod';
import { spawnSync } from 'child_process';
import { getNetwork } from '../btc-scripts/htlc.js';
import fs from 'fs';
import path from 'path';

const argsSchema = z.object({
  hashlock: z.string(),
  secret: z.string(),
  utxoTxid: z.string(),
  utxoVout: z.string(),
  utxoAmount: z.string(),
  redeemPrivkey: z.string(),
  htlcRecipientPubkey: z.string(),
  htlcRefundPubkey: z.string(),
  htlcLocktime: z.string(),
  htlcScript: z.string(),
  destAddress: z.string(),
  feeSats: z.string(),
  network: z.string().default('testnet'),
  electrumHost: z.string(),
  electrumPort: z.string(),
  electrumProto: z.string().default('ssl'),
  chain: z.string().default('bitcoin'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

const network = getNetwork(args.chain as 'bitcoin' | 'litecoin' | 'dogecoin');

const relayerArgs = Object.entries(args).map(([k, v]) => `--${k}=${v}`);
const result = spawnSync('pnpm', ['--filter', 'relayer', 'exec', 'ts-node', 'relayer/btc-redeem.ts', ...relayerArgs], { encoding: 'utf-8' });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

  const chain = args.chain as 'bitcoin' | 'litecoin' | 'dogecoin';
  const logDir = chain === 'dogecoin'
    ? path.resolve(__dirname, '../examples/doge')
    : chain === 'litecoin'
      ? path.resolve(__dirname, '../examples/ltc')
      : path.resolve(__dirname, '../examples/swaps');
  const logPath = path.join(logDir, `${args.hashlock}.json`);
  let logData = {};
  if (fs.existsSync(logPath)) {
    logData = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  }
  Object.assign(logData, {
    intentId: args.hashlock,
    status: 'redeemed',
    btcTx: result.stdout?.match(/"txid":\s*"([a-f0-9]+)"/)?.[1] || '',
    secret: args.secret,
    timestamp: Date.now(),
  });
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2)); 