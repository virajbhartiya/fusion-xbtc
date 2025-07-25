import { z } from 'zod';
import { spawnSync } from 'child_process';
import { getNetwork } from '../btc-scripts/htlc.js';

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