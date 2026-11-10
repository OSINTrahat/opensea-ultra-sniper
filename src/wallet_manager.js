/**
 * Wallet Manager (Supports 5 Independent Wallets + Recipient + Auto-Funder/Sweeper)
 * Handles encrypted/local storage, validation, multi-chain balance queries,
 * auto-distributing gas from Master wallet (Wallet 1), and sweeping funds.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const config = require('./sniper_config');

const WALLETS_FILE = path.join(__dirname, '..', 'wallets.json');

// Initialize wallets template if not present
function initWalletsFile() {
  if (!fs.existsSync(WALLETS_FILE)) {
    const defaultData = {
      recipient: "", // Main vault address to receive minted NFTs and swept funds
      wallets: [
        { id: 1, name: "Wallet 1 (Master)", address: "", privateKey: "" },
        { id: 2, name: "Wallet 2", address: "", privateKey: "" },
        { id: 3, name: "Wallet 3", address: "", privateKey: "" },
        { id: 4, name: "Wallet 4", address: "", privateKey: "" },
        { id: 5, name: "Wallet 5", address: "", privateKey: "" }
      ]
    };
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(defaultData, null, 2));
  }
}

// Load wallets from JSON
function loadData() {
  initWalletsFile();
  try {
    const raw = fs.readFileSync(WALLETS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Legacy format migration
      return { recipient: "", wallets: parsed };
    }
    return parsed;
  } catch (err) {
    console.error("[ERROR] Failed to load wallets.json:", err.message);
    return { recipient: "", wallets: [] };
  }
}

function loadWallets() {
  return loadData().wallets;
}

function getRecipient() {
  const data = loadData();
  return data.recipient || (data.wallets[0] ? data.wallets[0].address : "");
}

function setRecipient(address) {
  if (!ethers.isAddress(address)) {
    return "[ERROR] Invalid Ethereum recipient address.";
  }
  const data = loadData();
  data.recipient = ethers.getAddress(address);
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(data, null, 2));
  return `[OK] Recipient address updated -> ${data.recipient}`;
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
    const data = loadData();
    const target = data.wallets.find(w => w.id === id);
    if (target) {
      target.address = wallet.address;
      target.privateKey = cleanKey;
      fs.writeFileSync(WALLETS_FILE, JSON.stringify(data, null, 2));
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

// Auto-Fund: Distribute exact amount from Wallet 1 to other active wallets
async function fundSubWallets(amountEthStr, chainKey = 'base') {
  const chain = config.CHAINS[chainKey] || config.CHAINS.base;
  const provider = new ethers.JsonRpcProvider(chain.rpc[0]);
  const wallets = loadWallets();

  const master = wallets[0];
  if (!master || !master.privateKey) {
    throw new Error("Master Wallet (Wallet 1) must be configured with a private key to fund others.");
  }

  const masterSigner = new ethers.Wallet(master.privateKey, provider);
  const targetWallets = wallets.filter(w => w.id > 1 && w.address);

  if (targetWallets.length === 0) {
    throw new Error("No active sub-wallets (Wallets 2-5) configured to receive funds.");
  }

  const valWei = ethers.parseEther(amountEthStr);
  const results = [];

  for (const sub of targetWallets) {
    try {
      const tx = await masterSigner.sendTransaction({
        to: sub.address,
        value: valWei
      });
      await tx.wait(1);
      results.push({
        Wallet: sub.name,
        Address: sub.address,
        Amount: `${amountEthStr} ${chain.symbol}`,
        Status: "FUNDED",
        TxHash: tx.hash
      });
    } catch (err) {
      results.push({
        Wallet: sub.name,
        Address: sub.address,
        Amount: `${amountEthStr} ${chain.symbol}`,
        Status: "FAILED",
        Error: err.message
      });
    }
  }

  return results;
}

// Sweeper / Withdraw: Sweep remaining ETH from sub-wallets back to Master Wallet or Recipient
async function sweepFunds(chainKey = 'base') {
  const chain = config.CHAINS[chainKey] || config.CHAINS.base;
  const provider = new ethers.JsonRpcProvider(chain.rpc[0]);
  const wallets = loadWallets();
  const recipientAddr = getRecipient();

  if (!recipientAddr) {
    throw new Error("Recipient address not configured.");
  }

  const subWallets = wallets.filter(w => w.id > 1 && w.privateKey);
  const results = [];

  for (const w of subWallets) {
    try {
      const signer = new ethers.Wallet(w.privateKey, provider);
      const balWei = await provider.getBalance(signer.address);

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei');
      const gasLimit = 21000n;
      const gasCost = gasPrice * gasLimit;

      if (balWei <= gasCost) {
        results.push({
          Wallet: w.name,
          Address: signer.address,
          Swept: `0.0000 ${chain.symbol}`,
          Status: "SKIPPED (Balance <= Gas)"
        });
        continue;
      }

      const sendAmount = balWei - gasCost;
      const tx = await signer.sendTransaction({
        to: recipientAddr,
        value: sendAmount,
        gasLimit: gasLimit,
        gasPrice: gasPrice
      });
      await tx.wait(1);

      results.push({
        Wallet: w.name,
        Address: signer.address,
        Swept: `${ethers.formatEther(sendAmount)} ${chain.symbol}`,
        Status: "SWEPT_SUCCESS",
        TxHash: tx.hash
      });
    } catch (err) {
      results.push({
        Wallet: w.name,
        Address: w.address,
        Swept: "0.0000",
        Status: "FAIL",
        Error: err.message
      });
    }
  }

  return results;
}

module.exports = {
  loadWallets,
  setWalletKey,
  checkBalances,
  getRecipient,
  setRecipient,
  fundSubWallets,
  sweepFunds
};
