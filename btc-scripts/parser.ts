import * as bitcoin from 'bitcoinjs-lib';

export function extractHTLCParams(scriptHex: string) {
  const script = Buffer.from(scriptHex, 'hex');
  const decompiled = bitcoin.script.decompile(script);
  if (!decompiled) throw new Error('Invalid script');
  // Basic validation for HTLC structure
  if (
    decompiled[0] !== bitcoin.opcodes.OP_IF ||
    typeof decompiled[1] !== 'object' || // recipient pubkey
    decompiled[2] !== bitcoin.opcodes.OP_CHECKSIGVERIFY ||
    decompiled[3] !== bitcoin.opcodes.OP_SHA256 ||
    !Buffer.isBuffer(decompiled[4]) || // hashlock
    decompiled[5] !== bitcoin.opcodes.OP_EQUALVERIFY ||
    decompiled[6] !== bitcoin.opcodes.OP_ELSE
  ) {
    throw new Error('Not a valid HTLC script');
  }
  return {
    recipientPubkey: decompiled[1],
    hashlock: decompiled[4],
    locktime: bitcoin.script.number.decode(Buffer.isBuffer(decompiled[7]) ? decompiled[7] : Buffer.from([decompiled[7] as number])),
    refundPubkey: decompiled[9],
  };
} 