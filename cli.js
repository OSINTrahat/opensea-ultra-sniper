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
const ui = require('./ui');
const { c } = ui;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    ui.banner();
    console.log(`
  ${c.bYellow}${c.bold}SUPPORTED NETWORKS:${c.reset}
    ${c.gray}*${c.reset} ${c.cyan}ethereum${c.reset}  ${c.gray}Mainnet (Chain ID: 1)${c.reset}
    ${c.gray}*${c.reset} ${c.cyan}base${c.reset}      ${c.gray}Base Mainnet (Chain ID: 8453)${c.reset}
    ${c.gray}*${c.reset} ${c.cyan}robinhood${c.reset} ${c.gray}Robinhood Chain (Chain ID: 48)${c.reset}
    ${c.gray}*${c.reset} ${c.cyan}ink${c.reset}       ${c.gray}Ink Chain (Chain ID: 57073)${c.reset}

  ${c.bYellow}${c.bold}AVAILABLE COMMANDS:${c.reset}
    ${c.bGreen}node cli.js set-wallet <1-5> <privateKey>${c.reset}
        ${c.gray}Configure or update private key for wallet 1 through 5.${c.reset}

    ${c.bGreen}node cli.js wallets [chain]${c.reset}
        ${c.gray}Query real-time native ETH balances across all 5 wallets.${c.reset}

    ${c.bGreen}node cli.js gas [chain]${c.reset}
        ${c.gray}Stream network Base Fee, Priority Fee, and estimated mint gas.${c.reset}

    ${c.bGreen}node cli.js inspect <contractAddress> [chain]${c.reset}
        ${c.gray}Inspect all drop phases (GTD, FCFS, Public), prices, and wallet readiness.${c.reset}

    ${c.bGreen}node cli.js snipe <contractAddress> [chain] [walletId or 'all']${c.reset}
        ${c.gray}Pre-sign, stream live Gwei during countdown, and atomic snipe at 0ms.${c.reset}

  ${c.bYellow}${c.bold}QUICK EXAMPLES:${c.reset}
    ${c.white}node cli.js gas base${c.reset}
    ${c.white}node cli.js inspect 0x1234...5678 base${c.reset}
    ${c.white}node cli.js snipe 0x1234...5678 base all${c.reset}
`);
    return;
  }

  // 1. Set Wallet
  if (command === 'set-wallet') {
    const id = args[1];
    const key = args[2];
    if (!id || !key) {
      ui.log('WARN', `Usage: ${c.white}node cli.js set-wallet <1-5> <privateKey>${c.reset}`);
      return;
    }
    const res = walletManager.setWalletKey(id, key);
    if (res.startsWith('[OK]')) {
      ui.log('OK', `${c.bGreen}${res.slice(5)}${c.reset}`);
    } else {
      ui.log('ERROR', `${c.bRed}${res.slice(8)}${c.reset}`);
    }
    return;
  }

  // 2. Wallets balance
  if (command === 'wallets') {
    const chainKey = args[1] || 'base';
    ui.section(`5-WALLET BALANCES â€¢ ${chainKey.toUpperCase()}`);
    const list = await walletManager.checkBalances(chainKey);
    console.table(list.map(w => ({
      ID: w.ID,
      Name: w.Name,
      Address: w.Address,
      Balance: w.Balance,
      Status: w.Status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
    })));
    return;
  }

  // 3. Live Gas Monitor
  if (command === 'gas') {
    const chainKey = args[1] || 'base';
    ui.section(`LIVE GAS STREAM â€¢ ${chainKey.toUpperCase()}`);
    ui.log('INFO', `Polling every 2.5s via multi-RPC failover. Press ${c.bYellow}Ctrl+C${c.reset} to exit.\n`);
    gasTracker.watchGas(chainKey, (data) => {
      const time = new Date().toLocaleTimeString();
      const gweiStr = `${c.bGreen}${data.gwei} Gwei${c.reset}`;
      const prioStr = `${c.cyan}${data.priorityGwei} Gwei${c.reset}`;
      const costStr = `${c.bYellow}~${data.estimatedCostEth} ${data.symbol}${c.reset}`;
      console.log(`  ${c.gray}[${time}]${c.reset}  Base: ${gweiStr}  ${c.gray}â”‚${c.reset}  Priority: ${prioStr}  ${c.gray}â”‚${c.reset}  Est. Mint Gas: ${costStr}`);
    });
    return;
  }

  // 4. Inspect drop & eligibility
  if (command === 'inspect') {
    const contract = args[1];
    const chainKey = args[2] || 'base';
    if (!contract) {
      ui.log('WARN', `Usage: ${c.white}node cli.js inspect <contractAddress> [chain]${c.reset}`);
      return;
    }

    ui.section(`CONTRACT INSPECTOR â€¢ ${chainKey.toUpperCase()}`);
    ui.log('INFO', `Analyzing contract: ${c.cyan}${contract}${c.reset}`);

    const [wallets, liveGas, detection] = await Promise.all([
      walletManager.loadWallets(),
      gasTracker.getLiveGas(chainKey),
      universalDetector.detectContractMintMethod(contract, chainKey)
    ]);

    if (!detection.success) {
      ui.log('ERROR', `${detection.error || 'Failed to detect contract'}`);
      return;
    }

    if (detection.type === 'SEADROP') {
      const result = await dropInspector.inspectDrop(contract, chainKey, wallets);

      console.log(`\n  ${c.bYellow}${c.bold}METADATA SUMMARY${c.reset}`);
      ui.infoRow('Network', `${result.chain} (Chain ID: ${result.chainId})`);
      ui.infoRow('Contract', result.nftContract);
      ui.infoRow('Protocol', `OpenSea SeaDrop (${result.seadropAddress})`);
      ui.infoRow('Current Gas', `${liveGas.gwei} Gwei (~${liveGas.estimatedCostEth} ${liveGas.symbol} per mint)`);

      ui.section(`SCHEDULED DROP PHASES (GTD / FCFS / PUBLIC)`);
      if (result.phases.length > 0) {
        console.table(result.phases.map((p, idx) => ({
          Phase: `#${idx + 1}: ${p.phaseName}`,
          Price: p.priceEth,
          StartTime: p.startTime,
          EndTime: p.endTime,
          MaxMint: p.maxPerWallet,
          Status: p.status
        })));
      } else {
        ui.log('INFO', 'No active SeaDrop schedules registered for this contract.');
      }

      ui.section(`5-WALLET READINESS & FEE VERIFICATION`);
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
      console.log(`\n  ${c.bYellow}${c.bold}CUSTOM CONTRACT METADATA${c.reset}`);
      ui.infoRow('Network', chainKey.toUpperCase());
      ui.infoRow('Contract', contract);
      ui.infoRow('Contract Type', 'Generic Web3 / Custom Mint');
      ui.infoRow('Detected Functions', detection.methodsFound.join(', ') || 'Fallback mint() supported');
      ui.infoRow('Price Detected', `${detection.estimatedPriceEth} ETH`);
      ui.infoRow('Contract Status', detection.isPaused ? 'PAUSED' : 'ACTIVE');
      ui.infoRow('Current Gas', `${liveGas.gwei} Gwei (~${liveGas.estimatedCostEth} ${liveGas.symbol} per mint)`);

      ui.section(`5-WALLET READINESS & FEE VERIFICATION`);
      const reqPrice = parseFloat(detection.estimatedPriceEth || '0');
      console.table(wallets.map(w => ({
        Wallet: `${w.id}: ${w.name}`,
        Address: w.address || 'Unconfigured',
        MintPrice: `${reqPrice} ETH`,
        HasFee: w.privateKey ? 'YES' : 'NO',
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
      ui.log('WARN', `Usage: ${c.white}node cli.js snipe <contractAddress> [chain] [walletId or 'all']${c.reset}`);
      return;
    }

    ui.section(`HIGH-FREQUENCY SNIPER INITIALIZATION`);

    const allWallets = walletManager.loadWallets();
    let selectedWallets = [];

    if (targetMode === 'all') {
      selectedWallets = allWallets.filter(w => w.privateKey);
      ui.log('INFO', `Target Mode: ${c.bGreen}ALL (${selectedWallets.length} active wallets for parallel blast)${c.reset}`);
    } else {
      const single = allWallets.find(w => w.id === Number(targetMode));
      if (!single || !single.privateKey) {
        ui.log('ERROR', `Wallet ID ${targetMode} is not configured.`);
        return;
      }
      selectedWallets = [single];
      ui.log('INFO', `Target Mode: ${c.cyan}Single Wallet -> ${single.name} (${single.address})${c.reset}`);
    }

    if (selectedWallets.length === 0) {
      ui.log('ERROR', `No active wallets configured. Run ${c.white}node cli.js set-wallet <1-5> <key>${c.reset} first.`);
      return;
    }

    const sniper = new UniversalSniper(chainKey);

    const liveGas = await gasTracker.getLiveGas(chainKey);
    ui.log('GAS', `Network Gas: ${c.bGreen}${liveGas.gwei} Gwei${c.reset} ${c.gray}â”‚${c.reset} Priority: ${c.cyan}${liveGas.priorityGwei} Gwei${c.reset} ${c.gray}â”‚${c.reset} Est Fee: ${c.bYellow}~${liveGas.estimatedCostEth} ${liveGas.symbol}${c.reset}`);

    ui.log('INFO', `Inspecting target contract bytecode on ${c.cyan}${chainKey.toUpperCase()}${c.reset}...`);
    const detection = await universalDetector.detectContractMintMethod(contract, chainKey);
    const isSeaDrop = detection.type === 'SEADROP';

    let customData = null;
    let customPriceWei = 0n;

    if (!isSeaDrop) {
      ui.log('INFO', `Custom contract detected: ${detection.methodsFound.join(', ') || 'mint()'}`);
      const iface = new ethers.Interface(universalDetector.COMMON_MINT_SIGNATURES);
      const chosenMethod = detection.methodsFound[0] || 'function mint() payable';
      if (chosenMethod.includes('(uint256')) {
        customData = iface.encodeFunctionData(chosenMethod.split(' ')[1], [1]);
      } else {
        customData = iface.encodeFunctionData(chosenMethod.split(' ')[1], []);
      }
      customPriceWei = ethers.parseEther(detection.estimatedPriceEth || '0');
    }

    ui.log('INFO', `Pre-signing raw transactions in memory (Zero Signing Latency)...`);
    const armed = await sniper.armWallets(selectedWallets, contract, isSeaDrop, customData, customPriceWei);

    let currentGweiStr = `${liveGas.gwei} Gwei`;
    const stopGasWatcher = gasTracker.watchGas(chainKey, (g) => {
      currentGweiStr = `${g.gwei} Gwei`;
    });

    console.log(`\n  ${c.bYellow}${c.bold}COUNTDOWN SYNCHRONIZATION ACTIVE${c.reset}`);

    try {
      const results = await sniper.executeCountdownSnipe(armed, contract, (diffMs) => {
        if (diffMs > 1000 && diffMs % 2000 < 20) {
          const sec = (diffMs / 1000).toFixed(1);
          process.stdout.write(`\r  ${c.bCyan}[ COUNTDOWN: ${c.bWhite}${sec}s${c.bCyan} ]${c.reset}  ${c.gray}--${c.reset}  Live Gas: ${c.bGreen}${currentGweiStr}${c.reset}  ${c.gray}--${c.reset}  Status: ${c.bgGreen}${c.bold}${c.black} ARMED ${c.reset} `);
        }
      });
      stopGasWatcher();
      console.log(`\n`);
      ui.section(`SNIPE EXECUTION SUMMARY`);
      console.table(results.map(r => ({
        Success: r.success ? 'TRUE' : 'FALSE',
        Wallet: r.wallet,
        Latency: r.latencyMs ? `${r.latencyMs}ms` : 'N/A',
        TxHash: r.hash || r.error
      })));
    } catch (err) {
      stopGasWatcher();
      console.log(`\n`);
      ui.log('ERROR', err.message);
    }
  }
}

main().catch(console.error);
