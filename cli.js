#!/usr/bin/env node

/**
 * OpenSea SeaDrop & Multi-Chain Contract Sniper CLI
 * High-frequency minting automation with multi-node racing and live gas monitoring.
 */

const { ethers } = require('ethers');
const walletManager = require('./wallet_manager');
const dropInspector = require('./drop_inspector');
const UniversalSniper = require('./snipe_engine');
const gasTracker = require('./gas_tracker');
const universalDetector = require('./universal_detector');
const config = require('./sniper_config');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    console.log(`
================================================================================
  OPENSEA SEADROP & MULTI-CHAIN MINT SNIPER (v1.0.0)
================================================================================
Supported Chains:
  - ethereum  (Ethereum Mainnet - Chain ID: 1)
  - base      (Base Mainnet     - Chain ID: 8453)
  - robinhood (Robinhood Chain  - Chain ID: 48)
  - ink       (Ink Chain        - Chain ID: 57073)

Available Commands:
  node cli.js set-wallet <1-5> <privateKey>
      Configure private key for a specific wallet (1 through 5).

  node cli.js wallets [chain]
      Query native ETH balances across all 5 wallets (default: base).

  node cli.js gas [chain]
      Stream live network Base Fee, Priority Fee, and estimated mint gas.

  node cli.js inspect <contractAddress> [chain]
      Inspect drop schedule (GTD / FCFS / Public), prices, and wallet fee status.

  node cli.js snipe <contractAddress> [chain] [walletId or 'all']
      Arm pre-signed transactions, track live gas, and execute atomic snipe.

Examples:
  node cli.js gas base
  node cli.js inspect 0x1234...5678 base
  node cli.js snipe 0x1234...5678 base all
================================================================================
    `);
    return;
  }

  // 1. Set Wallet
  if (command === 'set-wallet') {
    const id = args[1];
    const key = args[2];
    if (!id || !key) {
      console.log("Usage: node cli.js set-wallet <1-5> <privateKey>");
      return;
    }
    const res = walletManager.setWalletKey(id, key);
    console.log(res);
    return;
  }

  // 2. Wallets balance
  if (command === 'wallets') {
    const chainKey = args[1] || 'base';
    console.log(`[INFO] Querying 5-Wallet Balances on ${chainKey.toUpperCase()}...`);
    const list = await walletManager.checkBalances(chainKey);
    console.table(list);
    return;
  }

  // 3. Live Gas Monitor
  if (command === 'gas') {
    const chainKey = args[1] || 'base';
    console.log(`[INFO] Streaming network gas updates for ${chainKey.toUpperCase()} (Press Ctrl+C to terminate)...`);
    gasTracker.watchGas(chainKey, (data) => {
      const time = new Date().toLocaleTimeString();
      console.log(`[${time}] Base: ${data.gwei} Gwei | Priority: ${data.priorityGwei} Gwei | Est. Mint Gas: ~${data.estimatedCostEth} ${data.symbol}`);
    });
    return;
  }

  // 4. Inspect drop & eligibility
  if (command === 'inspect') {
    const contract = args[1];
    const chainKey = args[2] || 'base';
    if (!contract) {
      console.log("Usage: node cli.js inspect <contractAddress> [chain]");
      return;
    }

    const [wallets, liveGas, detection] = await Promise.all([
      walletManager.loadWallets(),
      gasTracker.getLiveGas(chainKey),
      universalDetector.detectContractMintMethod(contract, chainKey)
    ]);

    if (!detection.success) {
      console.log(`[ERROR] ${detection.error || 'Failed to detect contract'}`);
      return;
    }

    if (detection.type === 'SEADROP') {
      const result = await dropInspector.inspectDrop(contract, chainKey, wallets);

      console.log("\n======================== DROP METADATA ========================");
      console.log(`Network:     ${result.chain} (Chain ID: ${result.chainId})`);
      console.log(`Contract:    ${result.nftContract}`);
      console.log(`Protocol:    OpenSea SeaDrop (${result.seadropAddress})`);
      console.log(`Network Gas: ${liveGas.gwei} Gwei (~${liveGas.estimatedCostEth} ${liveGas.symbol} per mint)`);

      console.log("\n=================== DROP SCHEDULE (ALL PHASES) ===================");
      if (result.phases.length > 0) {
        console.table(result.phases.map((p, idx) => ({
          Phase: `#${idx + 1}: ${p.phaseName}`,
          Price: p.priceEth,
          StartTime: p.startTime,
          EndTime: p.endTime,
          MaxPerWallet: p.maxPerWallet,
          Status: p.status
        })));
      } else {
        console.log("[INFO] No active SeaDrop schedules registered for this contract.");
      }

      console.log("\n================== WALLET READINESS & BALANCES ==================");
      console.table(result.wallets.map(w => ({
        Wallet: `${w.id}: ${w.name}`,
        Address: w.address,
        TargetPhase: w.targetSlot,
        Balance: w.currentBalance,
        MintPrice: w.pricePerMint,
        HasFee: w.hasFee,
        Readiness: w.readyToSnipe
      })));
    } else {
      console.log("\n====================== CUSTOM CONTRACT METADATA ======================");
      console.log(`Network:     ${chainKey.toUpperCase()}`);
      console.log(`Contract:    ${contract}`);
      console.log(`Type:        Generic Web3 Smart Contract`);
      console.log(`Functions:   ${detection.methodsFound.join(', ') || 'Fallback standard mint() supported'}`);
      console.log(`Price:       ${detection.estimatedPriceEth} ETH`);
      console.log(`Status:      ${detection.isPaused ? 'PAUSED' : 'ACTIVE'}`);
      console.log(`Network Gas: ${liveGas.gwei} Gwei (~${liveGas.estimatedCostEth} ${liveGas.symbol} per mint)`);

      console.log("\n================== WALLET READINESS & BALANCES ==================");
      const reqPrice = parseFloat(detection.estimatedPriceEth || '0');
      console.table(wallets.map(w => ({
        Wallet: `${w.id}: ${w.name}`,
        Address: w.address,
        MintPrice: `${reqPrice} ETH`,
        HasFee: 'VERIFIED',
        Readiness: w.privateKey ? 'READY' : 'NO_KEY'
      })));
    }

    return;
  }

  // 5. Snipe
  if (command === 'snipe') {
    const contract = args[1];
    const chainKey = args[2] || 'base';
    const targetMode = args[3] || 'all';

    if (!contract) {
      console.log("Usage: node cli.js snipe <contractAddress> [chain] [walletId or 'all']");
      return;
    }

    const allWallets = walletManager.loadWallets();
    let selectedWallets = [];

    if (targetMode === 'all') {
      selectedWallets = allWallets.filter(w => w.privateKey);
      console.log(`[INFO] Configured ${selectedWallets.length} active wallet(s) for simultaneous parallel blast.`);
    } else {
      const single = allWallets.find(w => w.id === Number(targetMode));
      if (!single || !single.privateKey) {
        console.log(`[ERROR] Wallet ID ${targetMode} is not configured.`);
        return;
      }
      selectedWallets = [single];
      console.log(`[INFO] Selected single wallet: ${single.name} (${single.address})`);
    }

    if (selectedWallets.length === 0) {
      console.log("[ERROR] No active wallets configured. Run `node cli.js set-wallet <1-5> <key>` first.");
      return;
    }

    const sniper = new UniversalSniper(chainKey);

    const liveGas = await gasTracker.getLiveGas(chainKey);
    console.log(`[GAS] Network Gas: ${liveGas.gwei} Gwei | Est Fee: ~${liveGas.estimatedCostEth} ${liveGas.symbol}`);

    console.log(`[INFO] Inspecting target contract on ${chainKey.toUpperCase()}...`);
    const detection = await universalDetector.detectContractMintMethod(contract, chainKey);
    const isSeaDrop = detection.type === 'SEADROP';

    let customData = null;
    let customPriceWei = 0n;

    if (!isSeaDrop) {
      console.log(`[INFO] Custom contract detected: ${detection.methodsFound.join(', ') || 'mint()'}`);
      const iface = new ethers.Interface(universalDetector.COMMON_MINT_SIGNATURES);
      const chosenMethod = detection.methodsFound[0] || 'function mint() payable';
      if (chosenMethod.includes('(uint256')) {
        customData = iface.encodeFunctionData(chosenMethod.split(' ')[1], [1]);
      } else {
        customData = iface.encodeFunctionData(chosenMethod.split(' ')[1], []);
      }
      customPriceWei = ethers.parseEther(detection.estimatedPriceEth || '0');
    }

    console.log("[INFO] Arming and pre-signing raw transactions...");
    const armed = await sniper.armWallets(selectedWallets, contract, isSeaDrop, customData, customPriceWei);

    let currentGweiStr = `${liveGas.gwei} Gwei`;
    const stopGasWatcher = gasTracker.watchGas(chainKey, (g) => {
      currentGweiStr = `${g.gwei} Gwei (~${g.estimatedCostEth} ${g.symbol})`;
    });

    try {
      const results = await sniper.executeCountdownSnipe(armed, contract, (diffMs) => {
        if (diffMs > 1000 && diffMs % 3000 < 20) {
          process.stdout.write(`\r[COUNTDOWN] ${(diffMs / 1000).toFixed(1)}s remaining | Live Gas: [${currentGweiStr}] `);
        }
      });
      stopGasWatcher();
      console.log("\n======================== SNIPE EXECUTION RESULTS ========================");
      console.table(results);
    } catch (err) {
      stopGasWatcher();
      console.error("\n[ERROR] " + err.message);
    }
  }
}

main().catch(console.error);
