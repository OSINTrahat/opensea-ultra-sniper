/**
 * Ultra Broadcaster (Multi-Node RPC Racing Engine)
 * Blasts pre-signed raw transactions across all configured RPC nodes simultaneously.
 * The fastest responder resolves the promise, eliminating network latency bottlenecks.
 */

const { ethers } = require('ethers');
const config = require('./sniper_config');

class UltraBroadcaster {
  constructor(chainKey = 'base') {
    this.chainKey = chainKey;
    this.chain = config.CHAINS[chainKey] || config.CHAINS.base;
    this.providers = this.chain.rpc.map(url => new ethers.JsonRpcProvider(url));
  }

  async raceBroadcast(rawTx) {
    if (!this.providers || this.providers.length === 0) {
      throw new Error(`[ERROR] No active RPC providers configured for ${this.chainKey}`);
    }

    // Broadcast across all RPCs concurrently; fastest successful acceptance wins
    return Promise.any(
      this.providers.map(async (provider, index) => {
        try {
          const txRes = await provider.broadcastTransaction(rawTx);
          return {
            providerIndex: index,
            rpc: this.chain.rpc[index],
            hash: txRes.hash
          };
        } catch (err) {
          // If transaction was already known / in mempool, treat as successful propagation
          if (err.message && (err.message.includes('already known') || err.message.includes('known transaction') || err.message.includes('nonce too low'))) {
            return {
              providerIndex: index,
              rpc: this.chain.rpc[index],
              hash: 'Mempool accepted'
            };
          }
          throw err;
        }
      })
    );
  }
}

module.exports = UltraBroadcaster;
