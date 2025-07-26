// @ts-ignore: Buffer is available in Node.js environments
import * as bitcoin from 'bitcoinjs-lib';

export function buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime, network }: {
  hashlock: Buffer;
  recipientPubkey: Buffer;
  refundPubkey: Buffer;
  locktime: number;
  network: bitcoin.Network;
}): bitcoin.payments.Payment {
  const script = bitcoin.script.compile([
    bitcoin.opcodes.OP_IF,
      recipientPubkey,
      bitcoin.opcodes.OP_CHECKSIGVERIFY,
      bitcoin.opcodes.OP_SHA256,
      hashlock,
      bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.opcodes.OP_ELSE,
      bitcoin.script.number.encode(locktime),
      bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
      bitcoin.opcodes.OP_DROP,
      refundPubkey,
      bitcoin.opcodes.OP_CHECKSIGVERIFY,
    bitcoin.opcodes.OP_ENDIF,
  ]);
  return bitcoin.payments.p2sh({ redeem: { output: script }, network });
}

export function getNetwork(chain: 'bitcoin' | 'litecoin' | 'dogecoin' | 'bch'): bitcoin.Network {
  if (chain === 'bitcoin') return bitcoin.networks.bitcoin;
  if (chain === 'litecoin') {
    return {
      messagePrefix: '\x19Litecoin Signed Message:\n',
      bech32: 'ltc',
      bip32: { public: 0x019da462, private: 0x019d9cfe },
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0,
    } as bitcoin.Network;
  }
  if (chain === 'dogecoin') {
    return {
      messagePrefix: '\x19Dogecoin Signed Message:\n',
      bech32: 'doge',
      bip32: { public: 0x02facafd, private: 0x02fac398 },
      pubKeyHash: 0x1e,
      scriptHash: 0x16,
      wif: 0x9e,
    } as bitcoin.Network;
  }
  if (chain === 'bch') {
    return {
      messagePrefix: '\x18Bitcoin Cash Signed Message:\n',
      bech32: 'bch',
      bip32: { public: 0x0488b21e, private: 0x0488ade4 },
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80,
    } as bitcoin.Network;
  }
  throw new Error('Unsupported chain');
} 