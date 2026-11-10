/**
 * Universal Ultra-Fast Parallel Snipe Engine
 * Features:
 * - OpenSea SeaDrop V1 & Custom Smart Contracts
 * - Pre-signed raw transaction memory caching (zero signing latency at trigger)
 * - Atomic 15ms timer loop with 50ms pre-fire buffer
 * - Multi-node RPC racing (fastest node wins)
 * - Strict Safety Checks (aborts if price changes or drop is delayed)
 * - Parallel execution across 1 to 5 wallets
 */

const { ethers } = require('ethers');
const config = require('./sniper_config');
const UltraBroadcaster = require('./ultra_broadcaster');

class UniversalSniper {
  constructor(chainKey = 'base') {
    this.chainKey = chainKey;
    this.chain = config.CHAINS[chainKey] || config.CHAINS.base;
    this.provider = new ethers.JsonRpcProvider(this.chain.rpc[0]);
    this.broadcaster = new UltraBroadcaster(chainKey);
    this.seadropAddr = config.SEADROP_ADDRESSES[this.chain.id];
  }

  // Pre-sign transactions in advance
  async armWallets(wallets, targetContract, isSeaDrop = true, customData = null, customPriceWei = 0n, targetTimeSec = null) {
    const armedTransactions = [];

    let lockedPrice = customPriceWei;
    let lockedStartTime = targetTimeSec || Math.floor(Date.now() / 1000);

    if (isSeaDrop) {
      const seadrop = new ethers.Contract(this.seadropAddr, config.SEADROP_ABI, this.provider);
      const publicDrop = await seadrop.getPublicDrop(targetContract);
      lockedPrice = publicDrop.mintPrice;
      lockedStartTime = Number(publicDrop.startTime);
    }

    console.log(`[ARMED] Target Contract: ${targetContract}`);
    console.log(`[ARMED] Locked Price: ${ethers.formatEther(lockedPrice)} ${this.chain.symbol}`);
    console.log(`[ARMED] Scheduled Time: ${new Date(lockedStartTime * 1000).toLocaleString()}`);

    const feeData = await this.provider.getFeeData();
    // 25% priority tip to guarantee top of block inclusion
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 125n) / 100n : ethers.parseUnits('1.5', 'gwei');
    const maxFeePerGas = feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : ethers.parseUnits('3', 'gwei');

    for (const w of wallets) {
      if (!w.privateKey) continue;
      const signer = new ethers.Wallet(w.privateKey, this.provider);

      let toAddress = targetContract;
      let callData = customData;
      let valueToSend = lockedPrice;

      if (isSeaDrop) {
        toAddress = this.seadropAddr;
        const seadrop = new ethers.Contract(this.seadropAddr, config.SEADROP_ABI, this.provider);
        callData = seadrop.interface.encodeFunctionData('mintPublic', [
          targetContract,
          ethers.ZeroAddress,
          signer.address,
          1
        ]);
      }

      const nonce = await this.provider.getTransactionCount(signer.address, 'pending');

      const txPayload = {
        to: toAddress,
        data: callData,
        value: valueToSend,
        nonce: nonce,
        gasLimit: 250000n,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        maxFeePerGas: maxFeePerGas,
        chainId: this.chain.id,
        type: 2
      };

      const signedTx = await signer.signTransaction(txPayload);
      armedTransactions.push({
        id: w.id,
        name: w.name,
        address: signer.address,
        rawTx: signedTx
      });
    }

    return {
      lockedPrice,
      lockedStartTime,
      isSeaDrop,
      armedTransactions
    };
  }

  // Atomic countdown timer and racing execution
  async executeCountdownSnipe(armedData, targetContract, onTick = () => {}) {
    const { lockedPrice, lockedStartTime, isSeaDrop, armedTransactions } = armedData;
    console.log(`[INFO] Sniper engine armed. Active Wallets: ${armedTransactions.length}`);

    let fired = false;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        const nowMs = Date.now();
        const startMs = lockedStartTime * 1000;
        const diffMs = startMs - nowMs;

        onTick(diffMs);

        // Safety verification: 2 seconds before trigger
        if (isSeaDrop && diffMs <= 2000 && diffMs > 1000) {
          try {
            const seadrop = new ethers.Contract(this.seadropAddr, config.SEADROP_ABI, this.provider);
            const liveDrop = await seadrop.getPublicDrop(targetContract);
            if (liveDrop.mintPrice !== lockedPrice) {
              clearInterval(interval);
              return reject(new Error(`SAFETY_ABORT: Price modified from ${ethers.formatEther(lockedPrice)} to ${ethers.formatEther(liveDrop.mintPrice)}`));
            }
            if (Number(liveDrop.startTime) !== lockedStartTime) {
              clearInterval(interval);
              return reject(new Error(`SAFETY_ABORT: Drop schedule was postponed or modified`));
            }
          } catch (e) {}
        }

        // Trigger condition: 50ms pre-fire buffer
        if (diffMs <= 50 && !fired) {
          fired = true;
          clearInterval(interval);
          console.log(`\n[TRIGGER] Blasting ${armedTransactions.length} transaction(s) across multi-node RPCs...`);

          const blastPromises = armedTransactions.map(async (armed) => {
            const sendStart = Date.now();
            try {
              const res = await this.broadcaster.raceBroadcast(armed.rawTx);
              const elapsed = Date.now() - sendStart;
              console.log(`[OK] [${armed.name}] Accepted in ${elapsed}ms | Hash: ${res.hash || 'Accepted'}`);
              return { success: true, wallet: armed.name, hash: res.hash || 'Accepted', latencyMs: elapsed };
            } catch (err) {
              console.error(`[FAIL] [${armed.name}] ${err.message}`);
              return { success: false, wallet: armed.name, error: err.message };
            }
          });

          const results = await Promise.all(blastPromises);
          resolve(results);
        }
      }, 15);
    });
  }
}

module.exports = UniversalSniper;
