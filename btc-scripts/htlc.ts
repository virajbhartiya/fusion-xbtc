// @ts-ignore: Buffer is available in Node.js environments
import * as bitcoin from 'bitcoinjs-lib';

export function buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime }: {
  hashlock: Buffer;
  recipientPubkey: Buffer;
  refundPubkey: Buffer;
  locktime: number;
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
  return bitcoin.payments.p2sh({ redeem: { output: script } });
} 