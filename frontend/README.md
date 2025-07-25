# NOTE: This frontend expects a backend endpoint /api/track?hashlock=... to serve swap log status for real-time updates.

# Fusion+ Frontend — Wallet Integration

## Wallet Integration (UTXO Chains)

This frontend now supports browser-based wallet integration for Bitcoin, Litecoin, Dogecoin, and Bitcoin Cash. Users can:

- Connect their browser wallet (Unisat, Hiro, Xverse, etc.) for the selected UTXO chain
- Sign and broadcast transactions directly from the UI (no copy-paste/manual steps required)
- See connection status, errors, and transaction feedback in real time

### Supported Wallets
- **Bitcoin:** Unisat, Hiro, Xverse
- **Litecoin, Dogecoin, BCH:** Unisat

### How to Use
1. Select swap direction and UTXO chain
2. Click "Connect Wallet" to connect your browser wallet
3. Fill in swap details and start the swap
4. Use the "Lock Funds (Wallet)" button to sign and broadcast the HTLC transaction
5. Monitor status and follow on-screen instructions for redeem/refund

> **Note:** ETH actions still use MetaMask. UTXO chains now use browser wallet APIs for all signing and broadcasting.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
