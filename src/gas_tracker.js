/**
 * High-Precision Real-Time Gas & Gwei Tracker
 * Provides live Gwei updates, priority fee optimization, and mint cost estimates.
 */

const { ethers } = require('ethers');
const config = require('./sniper_config');

async function getLiveGas(chainKey = 'base') {
  const chain = config.CHAINS[chainKey] || config.CHAINS.base;
  let lastErr = null;

  for (const rpcUrl of chain.rpc) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const feeData = await provider.getFeeData();

      const baseFeeWei = feeData.gasPrice || feeData.maxFeePerGas || 0n;
      const priorityFeeWei = feeData.maxPriorityFeePerGas || 0n;

      const gweiVal = parseFloat(ethers.formatUnits(baseFeeWei, 'gwei')).toFixed(3);
      const priorityGwei = parseFloat(ethers.formatUnits(priorityFeeWei, 'gwei')).toFixed(3);

      const estimatedGasLimit = 180000n;
      const estimatedCostEth = ethers.formatEther(baseFeeWei * estimatedGasLimit);

      return {
        chain: chain.name,
        symbol: chain.symbol,
        gwei: gweiVal,
        priorityGwei: priorityGwei,
        estimatedCostEth: parseFloat(estimatedCostEth).toFixed(6),
        rpcUsed: rpcUrl
      };
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(`[ERROR] All RPC nodes failed for chain ${chainKey}: ${lastErr ? lastErr.message : 'Unknown'}`);
}

function watchGas(chainKey = 'base', callback, intervalMs = 2500) {
  let running = true;

  const poll = async () => {
    if (!running) return;
    try {
      const gasInfo = await getLiveGas(chainKey);
      callback(gasInfo);
    } catch (err) {}
    if (running) {
      setTimeout(poll, intervalMs);
    }
  };

  poll();

  return () => {
    running = false;
  };
}

module.exports = {
  getLiveGas,
  watchGas
};
