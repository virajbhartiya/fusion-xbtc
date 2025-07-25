import { z } from 'zod';
import ElectrumClient from 'electrum-client';
import * as bitcoin from 'bitcoinjs-lib';
import { buildHTLCScript } from '../btc-scripts/htlc.js';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';

const ECPair = ECPairFactory(tinysecp);

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
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function main() {
  const network = bitcoin.networks[args.network];
  const client = new ElectrumClient(
    parseInt(args.electrumPort, 10),
    args.electrumHost,
    args.electrumProto
  );
  await client.connect();

  const hashlock = Buffer.from(args.hashlock.replace(/^0x/, ''), 'hex');
  const secret = Buffer.from(args.secret.replace(/^0x/, ''), 'hex');
  const recipientPubkey = Buffer.from(args.htlcRecipientPubkey, 'hex');
  const refundPubkey = Buffer.from(args.htlcRefundPubkey, 'hex');
  const locktime = parseInt(args.htlcLocktime, 10);
  const redeemPrivkey = ECPair.fromWIF(args.redeemPrivkey, network);
  const htlc = buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime });
  const redeemScript = htlc.redeem?.output || htlc.output;

  const psbt = new bitcoin.Psbt({ network });
  psbt.addInput({
    hash: args.utxoTxid,
    index: parseInt(args.utxoVout, 10),
    witnessUtxo: {
      script: redeemScript!,
      value: parseInt(args.utxoAmount, 10),
    },
    redeemScript,
  });
  psbt.addOutput({
    address: args.destAddress,
    value: parseInt(args.utxoAmount, 10) - parseInt(args.feeSats, 10),
  });
  psbt.signInput(0, redeemPrivkey);
  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  const txid = await client.blockchain_transaction_broadcast(txHex);
  await client.close();
  console.log(JSON.stringify({
    event: 'btc-redeem-broadcast',
    txid,
    note: 'BTC redeem transaction broadcasted',
  }, null, 2));
}

main(); 