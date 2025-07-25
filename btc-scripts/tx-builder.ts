import * as bitcoin from 'bitcoinjs-lib';

export function buildLockTx({
  utxos,
  htlcAddress,
  amountSats,
  changeAddress,
  feeSats,
  network
}: {
  utxos: { txid: string; vout: number; value: number; keyPair: any }[];
  htlcAddress: string;
  amountSats: number;
  changeAddress: string;
  feeSats: number;
  network: bitcoin.Network;
}) {
  const psbt = new bitcoin.Psbt({ network });
  let inputSum = 0;
  for (const utxo of utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: { script: bitcoin.address.toOutputScript(changeAddress, network), value: utxo.value },
    });
    inputSum += utxo.value;
  }
  psbt.addOutput({ address: htlcAddress, value: amountSats });
  const change = inputSum - amountSats - feeSats;
  if (change > 0) {
    psbt.addOutput({ address: changeAddress, value: change });
  }
  utxos.forEach((utxo, i) => {
    psbt.signInput(i, utxo.keyPair);
  });
  return psbt;
} 