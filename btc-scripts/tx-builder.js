"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLockTx = buildLockTx;
const bitcoin = __importStar(require("bitcoinjs-lib"));
function buildLockTx({ utxos, htlcAddress, amountSats, changeAddress, feeSats, network }) {
    const psbt = new bitcoin.Psbt({ network });
    let inputSum = 0;
    for (const utxo of utxos) {
        psbt.addInput({
            hash: Buffer.from(utxo.txid, 'hex').reverse(),
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
        // Use the ECPair directly but ensure it's properly configured
        psbt.signInput(i, utxo.keyPair);
    });
    return psbt;
}
