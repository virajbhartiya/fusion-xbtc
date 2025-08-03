import * as bitcoin from 'bitcoinjs-lib';
export declare function buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime, network }: {
    hashlock: Buffer;
    recipientPubkey: Buffer;
    refundPubkey: Buffer;
    locktime: number;
    network: bitcoin.Network;
}): bitcoin.payments.Payment;
export declare function getNetwork(chain: 'bitcoin' | 'litecoin' | 'dogecoin' | 'bch'): bitcoin.Network;
