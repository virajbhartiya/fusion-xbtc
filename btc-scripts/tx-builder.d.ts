import * as bitcoin from 'bitcoinjs-lib';
export declare function buildLockTx({ utxos, htlcAddress, amountSats, changeAddress, feeSats, network }: {
    utxos: {
        txid: string;
        vout: number;
        value: number;
        keyPair: any;
    }[];
    htlcAddress: string;
    amountSats: number;
    changeAddress: string;
    feeSats: number;
    network: bitcoin.Network;
}): bitcoin.Psbt;
