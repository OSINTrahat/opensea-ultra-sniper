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

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    ui.banner();
    console.log(`
  ${c.bWhite}${c.bold}TOTAL COMMANDS: 8${c.reset}  ${c.gray}(Run any command without args for quick help)${c.reset}
  ${c.gray}------------------------------------------------------${c.reset}

  ${c.bYellow}${c.bold}[ 1. WALLET SETUP & MANAGEMENT ]${c.reset}
  ${c.bGreen}sniper set-wallet <1-5> <privateKey>${c.reset}
      Configure or update private key for wallet 1 through 5.
      ${c.gray}Example: sniper set-wallet 1 0xac0974bec39a17e36ba4a6b4...${c.reset}

  ${c.bGreen}sniper recipient [address]${c.reset}
      View or set main Vault/Receiver address. All minted NFTs and swept
      funds go straight to this cold wallet.
      ${c.gray}Example: sniper recipient 0xYourMainVaultAddress${c.reset}

  ${c.bGreen}sniper wallets [chain]${c.reset}
      Check real-time native ETH balances and readiness of all 5 wallets.
      ${c.gray}Example: sniper wallets base${c.reset}

  ${c.bYellow}${c.bold}[ 2. AUTOMATIC GAS DISPATCH & RECOVERY ]${c.reset}
  ${c.bGreen}sniper fund <amountEth> [chain]${c.reset}
      Auto-distribute gas from Master Wallet 1 to Sub-Wallets 2-5 in 1 command.
      ${c.gray}Example: sniper fund 0.005 base${c.reset}

  ${c.bGreen}sniper sweep [chain]${c.reset}
      Sweep leftover ETH from sub-wallets back to Master / Recipient Vault.
      ${c.gray}Example: sniper sweep base${c.reset}

  ${c.bYellow}${c.bold}[ 3. MONITORING & DROP INSPECTION ]${c.reset}
  ${c.bGreen}sniper gas [chain]${c.reset}
      Live stream Base Fee, Priority Fee, and estimated mint costs every 2.5s.
      ${c.gray}Example: sniper gas base${c.reset}

  ${c.bGreen}sniper inspect <contractAddress> [chain]${c.reset}
      Inspect drop schedules (GTD, FCFS, Public), prices, limits, and wallet checks.
      ${c.gray}Example: sniper inspect 0x889c162A52277d332F09025eB0E63b36E08f9064 base${c.reset}

  ${c.bYellow}${c.bold}[ 4. ULTRA-FAST ZERO-LATENCY SNIPING ]${c.reset}
  ${c.bGreen}sniper snipe <contractAddress> [chain] [walletId or 'all'] [--qty N] [--speed fast|turbo|war]${c.reset}
      Pre-sign transactions into memory, stream countdown, and burst fire at 0ms.
      ${c.gray}Options:${c.reset}
        --qty <N>              Number of NFTs per wallet (Default: 1)
        --speed fast|turbo|war Priority fee boost (+0%, +35%, +100%)
      ${c.gray}Example: sniper snipe 0x889c...9064 base all --qty 2 --speed turbo${c.reset}

  ${c.bYellow}${c.bold}[ SUPPORTED NETWORKS ]${c.reset}
    ${c.cyan}ethereum${c.reset} (1)  |  ${c.cyan}base${c.reset} (8453)  |  ${c.cyan}robinhood${c.reset} (48)  |  ${c.cyan}ink${c.reset} (57073)
  ${c.gray}------------------------------------------------------${c.reset}
`);
    return;
  }

  // 1. Set Wallet
  if (command === 'set-wallet') {
    const id = args[1];
    const key = args[2];
    if (!id || !key) {
      ui.log('WARN', `Usage: ${c.white}sniper set-wallet <1-5> <privateKey>${c.reset}`);
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

  // 2. Recipient Vault
  if (command === 'recipient') {
    const addr = args[1];
    if (addr) {
      const res = walletManager.setRecipient(addr);
      if (res.startsWith('[OK]')) {
        ui.log('OK', `${c.bGreen}${res.slice(5)}${c.reset}`);
      } else {
        ui.log('ERROR', `${c.bRed}${res.slice(8)}${c.reset}`);
      }
    } else {
      const current = walletManager.getRecipient();
      ui.section('MAIN VAULT / RECIPIENT');
      ui.infoRow('Recipient Address', current || 'Not configured (Defaults to Wallet 1)', c.bGreen);
    }
    return;
  }

  // 3. Auto-Fund Wallets 2-5 from Wallet 1
  if (command === 'fund') {
    const amt = args[1];
    const chainKey = args[2] || 'base';
    if (!amt) {
      ui.log('WARN', `Usage: ${c.white}sniper fund <amountEth> [chain]${c.reset}`);
      return;
    }
    ui.section(`AUTO-FUND SUB-WALLETS | ${chainKey.toUpperCase()}`);
    ui.log('INFO', `Dispatching ${c.bGreen}${amt} ETH${c.reset} from Wallet 1 (Master) to Wallets 2-5...`);
    try {
      const res = await walletManager.fundSubWallets(amt, chainKey);
      ui.renderTable(
        ['Wallet', 'Address', 'Amount', 'Status', 'Tx Hash'],
        res.map(r => [r.Wallet, r.Address, r.Amount, ui.badge(r.Status), r.TxHash || r.Error || 'N/A'])
      );
    } catch (err) {
      ui.log('ERROR', err.message);
    }
    return;
  }

  // 4. Sweep / Withdraw
  if (command === 'sweep' || command === 'withdraw') {
    const chainKey = args[1] || 'base';
    ui.section(`SWEEPER / WITHDRAW | ${chainKey.toUpperCase()}`);
    ui.log('INFO', `Sweeping leftover balances from sub-wallets to Recipient Vault...`);
    try {
      const res = await walletManager.sweepFunds(chainKey);
      ui.renderTable(
        ['Wallet', 'Address', 'Amount Swept', 'Status'],
        res.map(r => [r.Wallet, r.Address, r.Swept, ui.badge(r.Status)])
      );
    } catch (err) {
      ui.log('ERROR', err.message);
    }
    return;
  }

  // 5. Wallets balance
  if (command === 'wallets') {
    const chainKey = args[1] || 'base';
    ui.section(`5-WALLET BALANCES | ${chainKey.toUpperCase()}`);
    const list = await walletManager.checkBalances(chainKey);
    ui.renderTable(
      ['ID', 'Name', 'Address', 'Balance', 'Status'],
      list.map(w => [w.ID, w.Name, w.Address, w.Balance, ui.badge(w.Status)])
    );
    return;
  }

  // 3. Live Gas Monitor
  if (command === 'gas') {
    const chainKey = args[1] || 'base';
    ui.section(`LIVE GAS STREAM | ${chainKey.toUpperCase()}`);
    ui.log('INFO', `Polling every 2.5s via multi-RPC failover. Press ${c.bYellow}Ctrl+C${c.reset} to exit.\n`);
    gasTracker.watchGas(chainKey, (data) => {
      const time = new Date().toLocaleTimeString();
      const gweiStr = `${c.bGreen}${data.gwei} Gwei${c.reset}`;
      const prioStr = `${c.cyan}${data.priorityGwei} Gwei${c.reset}`;
      const costStr = `${c.bYellow}~${data.estimatedCostEth} ${data.symbol}${c.reset}`;
      console.log(`  ${c.gray}[${time}]${c.reset}  Base: ${gweiStr}  ${c.gray}|${c.reset}  Priority: ${prioStr}  ${c.gray}|${c.reset}  Est. Mint Gas: ${costStr}`);
    });
    return;
  }

  // 4. Inspect drop & eligibility
  if (command === 'inspect') {
    const contract = args[1];
    const chainKey = args[2] || 'base';
    if (!contract) {
      ui.log('WARN', `Usage: ${c.white}sniper inspect <contractAddress> [chain]${c.reset}`);
      return;
    }

    ui.section(`CONTRACT INSPECTOR | ${chainKey.toUpperCase()}`);
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
        ui.renderTable(
          ['Phase', 'Price', 'Start Time', 'End Time', 'Max Mint', 'Status'],
          result.phases.map((p, idx) => [
            `#${idx + 1}: ${p.phaseName}`,
            p.priceEth,
            p.startTime,
            p.endTime,
            String(p.maxPerWallet),
            ui.badge(p.status)
          ])
        );
      } else {
        ui.log('INFO', 'No active SeaDrop schedules registered for this contract.');
      }

      ui.section(`5-WALLET READINESS & FEE VERIFICATION`);
      ui.renderTable(
        ['Wallet', 'Address', 'Target Phase', 'Balance', 'Mint Price', 'Fee Ready', 'Status'],
        result.wallets.map(w => [
          `${w.id}: ${w.name}`,
          w.address,
          w.targetSlot,
          w.currentBalance,
          w.pricePerMint,
          ui.badge(w.hasFee ? 'YES' : 'NO'),
          ui.badge(w.readyToSnipe)
        ])
      );
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
      ui.renderTable(
        ['Wallet', 'Address', 'Mint Price', 'Key Loaded', 'Status'],
        wallets.map(w => [
          `${w.id}: ${w.name}`,
          w.address || 'Unconfigured',
          `${reqPrice} ETH`,
          ui.badge(w.privateKey ? 'YES' : 'NO'),
          ui.badge(w.privateKey ? 'READY' : 'NO_KEY')
        ])
      );
    }

    return;
  }

  // 5. Snipe
  if (command === 'snipe') {
    const contract = args[1];
    const chainKey = args[2] || 'base';
    const targetMode = args[3] || 'all';

    if (!contract) {
      ui.log('WARN', `Usage: ${c.white}sniper snipe <contractAddress> [chain] [walletId or 'all']${c.reset}`);
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
      ui.log('ERROR', `No active wallets configured. Run ${c.white}sniper set-wallet <1-5> <key>${c.reset} first.`);
      return;
    }

    const sniper = new UniversalSniper(chainKey);

    const liveGas = await gasTracker.getLiveGas(chainKey);
    ui.log('GAS', `Network Gas: ${c.bGreen}${liveGas.gwei} Gwei${c.reset} ${c.gray}|${c.reset} Priority: ${c.cyan}${liveGas.priorityGwei} Gwei${c.reset} ${c.gray}|${c.reset} Est Fee: ${c.bYellow}~${liveGas.estimatedCostEth} ${liveGas.symbol}${c.reset}`);

    ui.log('INFO', `Inspecting target contract bytecode on ${c.cyan}${chainKey.toUpperCase()}${c.reset}...`);
    const detection = await universalDetector.detectContractMintMethod(contract, chainKey);
    const isSeaDrop = detection.type === 'SEADROP';

    let customData = null;
    let customPriceWei = 0n;

    // Parse optional flags: --qty <N>, --speed <fast|turbo|war>
    let quantity = 1;
    let speedTier = 'fast';
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--qty' && args[i + 1]) {
        quantity = parseInt(args[i + 1], 10) || 1;
      }
      if (args[i] === '--speed' && args[i + 1]) {
        speedTier = args[i + 1].toLowerCase();
      }
    }

    if (!isSeaDrop) {
      ui.log('INFO', `Custom contract detected: ${detection.methodsFound.join(', ') || 'mint()'}`);
      const iface = new ethers.Interface(universalDetector.COMMON_MINT_SIGNATURES);
      const chosenMethod = detection.methodsFound[0] || 'function mint() payable';
      if (chosenMethod.includes('(uint256')) {
        customData = iface.encodeFunctionData(chosenMethod.split(' ')[1], [quantity]);
      } else {
        customData = iface.encodeFunctionData(chosenMethod.split(' ')[1], []);
      }
      customPriceWei = ethers.parseEther(detection.estimatedPriceEth || '0');
    }

    ui.log('INFO', `Pre-signing raw transactions in memory (Zero Signing Latency)...`);
    const recipientAddr = walletManager.getRecipient();
    const armed = await sniper.armWallets(selectedWallets, contract, isSeaDrop, customData, customPriceWei, null, recipientAddr, quantity, speedTier);

    ui.hudBar(chainKey, config.chains[chainKey].flashbotsRpc ? 'FLASHBOTS (PRIVATE)' : 'MULTI-RPC RACING', '3 NODES RACING', speedTier);

    let currentGweiStr = `${liveGas.gwei} Gwei`;
    const stopGasWatcher = gasTracker.watchGas(chainKey, (g) => {
      currentGweiStr = `${g.gwei} Gwei`;
    });

    console.log(`\n  ${c.bYellow}${c.bold}COUNTDOWN SYNCHRONIZATION ACTIVE${c.reset}`);

    try {
      const results = await sniper.executeCountdownSnipe(armed, contract, (diffMs) => {
        if (diffMs > 1000 && diffMs % 2000 < 20) {
          const sec = (diffMs / 1000).toFixed(1);
          process.stdout.write(`\r  ${c.bCyan}[ COUNTDOWN: ${c.bWhite}${sec}s${c.bCyan} ]${c.reset}  ${c.gray}|${c.reset}  Gas: ${c.bGreen}${currentGweiStr}${c.reset}  ${c.gray}|${c.reset}  Mempool: ${c.bMagenta}BURST READY${c.reset} `);
        }
      });
      stopGasWatcher();
      console.log(`\n`);
      ui.section(`INSTITUTIONAL EXECUTION SUMMARY`);
      ui.renderTable(
        ['Status', 'Wallet', 'Latency', 'Tx Hash / Error'],
        results.map(r => [
          r.success ? ui.badge('SUCCESS') : ui.badge('FAILED'),
          r.wallet,
          r.latencyMs ? `${r.latencyMs}ms` : 'N/A',
          r.hash || r.error || 'N/A'
        ])
      );
      const successCount = results.filter(r => r.success).length;
      console.log(`  ${c.bGreen}${c.bold}SUMMARY:${c.reset} ${c.bWhite}${successCount}/${results.length} Mints Confirmed${c.reset} | ${c.cyan}Destination Vault: ${recipientAddr || 'Sub-Wallets'}${c.reset}`);
      console.log(`  ${c.gray}--------------------------------------------------------------------------------${c.reset}\n`);
    } catch (err) {
      stopGasWatcher();
      console.log(`\n`);
      ui.log('ERROR', err.message);
    }
  }
}

main().catch(console.error);
