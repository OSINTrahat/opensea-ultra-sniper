/**
 * Wallet Manager (Supports 5 Independent Wallets)
 * Handles encrypted/local storage, validation, and multi-chain balance queries.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const config = require('./sniper_config');

const WALLETS_FILE = path.join(__dirname, 'wallets.json');

// Initialize wallets template if not present
function initWalletsFile() {
  if (!fs.existsSync(WALLETS_FILE)) {
    const defaultWallets = [
      { id: 1, name: "Wallet 1", address: "", privateKey: "" },
      { id: 2, name: "Wallet 2", address: "", privateKey: "" },
      { id: 3, name: "Wallet 3", address: "", privateKey: "" },
      { id: 4, name: "Wallet 4", address: "", privateKey: "" },
      { id: 5, name: "Wallet 5", address: "", privateKey: "" }
    ];
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(defaultWallets, null, 2));
  }
}

// Load wallets from JSON
function loadWallets() {
  initWalletsFile();
  try {
    const raw = fs.readFileSync(WALLETS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("[ERROR] Failed to load wallets.json:", err.message);
    return [];
  }
}

// Save or update private key for a specific wallet (1 to 5)
function setWalletKey(walletId, privateKey) {
  const id = Number(walletId);
  if (id < 1 || id > 5) {
    return "[ERROR] Wallet ID must be between 1 and 5.";
  }

  const cleanKey = privateKey.trim().startsWith('0x') ? privateKey.trim() : `0x${privateKey.trim()}`;
  try {
    const wallet = new ethers.Wallet(cleanKey);
    const wallets = loadWallets();
    const target = wallets.find(w => w.id === id);
    if (target) {
      target.address = wallet.address;
      target.privateKey = cleanKey;
      fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
      return `[OK] Wallet ${id} successfully configured -> Address: ${wallet.address}`;
    }
  } catch (err) {
    return `[ERROR] Invalid Private Key: ${err.message}`;
  }
}

// Check native ETH balances across 5 wallets on any supported chain
async function checkBalances(chainKey = 'base') {
  const chain = config.CHAINS[chainKey] || config.CHAINS.base;
  const provider = new ethers.JsonRpcProvider(chain.rpc[0]);
  const wallets = loadWallets();

  const results = [];
  for (const w of wallets) {
    if (!w.address) {
      results.push({
        ID: w.id,
        Name: w.name,
        Address: "Not configured",
        Balance: `0.0000 ${chain.symbol}`,
        Status: "INACTIVE"
      });
      continue;
    }

    try {
      const balWei = await provider.getBalance(w.address);
      const balEth = ethers.formatEther(balWei);
      results.push({
        ID: w.id,
        Name: w.name,
        Address: w.address,
        Balance: `${parseFloat(balEth).toFixed(5)} ${chain.symbol}`,
        Status: "ACTIVE"
      });
    } catch (err) {
      results.push({
        ID: w.id,
        Name: w.name,
        Address: w.address,
        Balance: "Error querying balance",
        Status: "RPC_ERROR"
      });
    }
  }
  return results;
}

module.exports = {
  loadWallets,
  setWalletKey,
  checkBalances
};
