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
  
  // For other modules, return a mock or use dynamic import
  if (!moduleCache[id]) {
    moduleCache[id] = {};
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