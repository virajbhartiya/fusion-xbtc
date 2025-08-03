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
exports.buildHTLCScript = buildHTLCScript;
exports.getNetwork = getNetwork;
// @ts-ignore: Buffer is available in Node.js environments
const bitcoin = __importStar(require("bitcoinjs-lib"));
function buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime, network }) {
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
function getNetwork(chain) {
    if (chain === 'bitcoin')
        return bitcoin.networks.bitcoin;
    if (chain === 'litecoin') {
        return {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: { public: 0x019da462, private: 0x019d9cfe },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0,
        };
    }
    if (chain === 'dogecoin') {
        return {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'doge',
            bip32: { public: 0x02facafd, private: 0x02fac398 },
            pubKeyHash: 0x1e,
            scriptHash: 0x16,
            wif: 0x9e,
        };
    }
    if (chain === 'bch') {
        return {
            messagePrefix: '\x18Bitcoin Cash Signed Message:\n',
            bech32: 'bch',
            bip32: { public: 0x0488b21e, private: 0x0488ade4 },
            pubKeyHash: 0x00,
            scriptHash: 0x05,
            wif: 0x80,
        };
    }
    throw new Error('Unsupported chain');
}
