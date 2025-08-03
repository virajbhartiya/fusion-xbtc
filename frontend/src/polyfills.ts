// Node.js and CommonJS polyfills for browser
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import * as util from 'util';

// Polyfill CommonJS globals
(window as any).exports = {};
(window as any).module = { exports: {} };

// Use a simple require that doesn't cause recursion
const moduleCache: Record<string, any> = {};
(window as any).require = (id: string) => {
  if (id === 'buffer') return { Buffer };
  if (id === 'events') return { EventEmitter };
  if (id === 'util') return util;
  if (id === 'bip32') {
    // Return a mock bip32 module for browser
    return {
      BIP32Factory: () => ({
        fromPrivateKey: () => ({}),
        fromPublicKey: () => ({}),
        fromSeed: () => ({}),
      }),
    };
  }
  if (id === 'tiny-secp256k1') {
    // Return a mock secp256k1 module for browser
    return {
      sign: () => Buffer.alloc(64),
      signSchnorr: () => Buffer.alloc(64),
      verify: () => true,
      verifySchnorr: () => true,
      privateAdd: () => Buffer.alloc(32),
      privateModInverse: () => Buffer.alloc(32),
      privateNegate: () => Buffer.alloc(32),
      pointFromScalar: () => Buffer.alloc(33),
      pointCompress: () => Buffer.alloc(33),
      isPoint: () => true,
      isPrivate: () => true,
      isXOnlyPoint: () => true,
      xOnlyPointAddTweak: () => ({ parity: 0, xOnlyPubkey: Buffer.alloc(32) }),
    };
  }
  
  // For other modules, use dynamic import or throw error
  if (!moduleCache[id]) {
    console.warn(`Module '${id}' not available in browser environment, using mock`);
    return {};
  }
  return moduleCache[id];
};

// Polyfill Node.js globals
(window as any).Buffer = Buffer;
(window as any).EventEmitter = EventEmitter;
(window as any).util = util;
(window as any).process = { env: {} };
(window as any).global = window;

export {}; 