#!/usr/bin/env node

/**
 * OpenSea SeaDrop & Multi-Chain Contract Sniper CLI
 * Interactive Picker & High-Frequency Multi-Node Minting Automation.
 */

const readline = require('readline');
const { ethers } = require('ethers');
const walletManager = require('./wallet_manager');
const dropInspector = require('./drop_inspector');
const UniversalSniper = require('./snipe_engine');
const gasTracker = require('./gas_tracker');
const universalDetector = require('./universal_detector');
const config = require('./sniper_config');
const ui = require('./ui');
const { c } = ui;

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function selectChainInteractive(defaultChain = 'base') {
  console.log(`\n  ${c.bYellow}${c.bold}Select Blockchain Network:${c.reset}`);
  console.log(`    ${c.bWhite}1)${c.reset} ${c.bCyan}Base${c.reset} (Chain ID: 8453)  ${c.gray}[Recommended / Ultra-Cheap]${c.reset}`);
  console.log(`    ${c.bWhite}2)${c.reset} ${c.bCyan}Ethereum${c.reset} (Chain ID: 1)  ${c.gray}[Flashbots Protect MEV]${c.reset}`);
  console.log(`    ${c.bWhite}3)${c.reset} ${c.bCyan}Robinhood${c.reset} (Chain ID: 48)`);
  console.log(`    ${c.bWhite}4)${c.reset} ${c.bCyan}Ink Chain${c.reset} (Chain ID: 57073)`);
  
  const choice = await askQuestion(`\n  Choose [1-4] (default: 1): `);
  if (choice === '2') return 'ethereum';
  if (choice === '3') return 'robinhood';
  if (choice === '4') return 'ink';
  return 'base';
}

async function interactiveMenu() {
  ui.banner();
  console.log(`  ${c.bYellow}${c.bold}What would you like to do?${c.reset}`);
  console.log(`    ${c.bGreen}1)${c.reset} ${c.bWhite}Snipe / Mint Drop${c.reset}       ${c.gray}(Pre-sign & atomic blast at 0ms)${c.reset}`);
  console.log(`    ${c.bGreen}2)${c.reset} ${c.bWhite}Inspect Drop / Contract${c.reset} ${c.gray}(Phases, start time, price, limits)${c.reset}`);
  console.log(`    ${c.bGreen}3)${c.reset} ${c.bWhite}Live Gas Stream${c.reset}         ${c.gray}(Monitor Base Fee & Priority Gwei)${c.reset}`);
  console.log(`    ${c.bGreen}4)${c.reset} ${c.bWhite}Check Wallet Balances${c.reset}   ${c.gray}(View all 5 wallets on any chain)${c.reset}`);
  console.log(`    ${c.bGreen}5)${c.reset} ${c.bWhite}Auto-Fund Sub-Wallets${c.reset}   ${c.gray}(Send gas from Wallet 1 to Wallets 2-5)${c.reset}`);
  console.log(`    ${c.bGreen}6)${c.reset} ${c.bWhite}Sweep Balances${c.reset}          ${c.gray}(Withdraw leftover ETH to Vault)${c.reset}`);
  console.log(`    ${c.bGreen}7)${c.reset} ${c.bWhite}Set / Update Wallet Key${c.reset} ${c.gray}(Save private key 1 to 5)${c.reset}`);
  console.log(`    ${c.bGreen}8)${c.reset} ${c.bWhite}Set Recipient Cold Vault${c.reset}${c.gray}(Direct delivery address)${c.reset}`);
  console.log(`    ${c.bRed}0)${c.reset} ${c.gray}Exit${c.reset}`);

  const choice = await askQuestion(`\n  Enter option [0-8]: `);

  if (choice === '1') {
    const contract = await askQuestion(`\n  Enter NFT Contract Address: `);
    if (!contract) {
      ui.log('WARN', 'Contract address required.');
      return;
    }
    const chain = await selectChainInteractive();
    const qtyStr = await askQuestion(`  Quantity per wallet (default: 1): `);
    const qty = parseInt(qtyStr, 10) || 1;
    
    console.log(`\n  Priority Gas Boost Tier:`);
    console.log(`    1) Fast (+0%)  2) Turbo (+35%)  3) War (+100%)`);
    const speedPick = await askQuestion(`  Select speed [1-3] (default: 2 - Turbo): `);
    let speed = 'turbo';
    if (speedPick === '1') speed = 'fast';
    if (speedPick === '3') speed = 'war';

    return executeSnipe(contract, chain, 'all', qty, speed);
  }

  if (choice === '2') {
    const contract = await askQuestion(`\n  Enter Contract Address to inspect: `);
    if (!contract) return;
    const chain = await selectChainInteractive();
    return executeInspect(contract, chain);
  }

  if (choice === '3') {
    const chain = await selectChainInteractive();
    return executeGas(chain);
  }

  if (choice === '4') {
    const chain = await selectChainInteractive();
    return executeWallets(chain);
  }

  if (choice === '5') {
    const amt = await askQuestion(`\n  ETH amount to send to each sub-wallet (e.g. 0.005): `);
    if (!amt) return;
    const chain = await selectChainInteractive();
    return executeFund(amt, chain);
  }

  if (choice === '6') {
    const chain = await selectChainInteractive();
    return executeSweep(chain);
  }

  if (choice === '7') {
    console.log(`\n  Select Wallet Slot to Configure:`);
    console.log(`    1) Wallet 1 (Master Funder)`);
    console.log(`    2) Wallet 2 (Sniper Sub-1)`);
    console.log(`    3) Wallet 3 (Sniper Sub-2)`);
    console.log(`    4) Wallet 4 (Sniper Sub-3)`);
    console.log(`    5) Wallet 5 (Sniper Sub-4)`);
    const slot = await askQuestion(`  Slot [1-5]: `);
    const key = await askQuestion(`  Enter Private Key (64-char hex): `);
    if (slot && key) {
      const res = walletManager.setWalletKey(slot, key);
      ui.log('OK', res);
    }
    return;
  }

  if (choice === '8') {
    const current = walletManager.getRecipient();
    console.log(`\n  Current Vault: ${c.cyan}${current || 'Not set (mints deliver to minter wallets)'}${c.reset}`);
    const addr = await askQuestion(`  Enter new Recipient / Vault address (leave empty to keep current): `);
    if (addr) {
      const res = walletManager.setRecipient(addr);
      ui.log('OK', res);
    }
    return;
  }

  console.log(`  ${c.gray}Exiting.${c.reset}`);
}

async function executeWallets(chainKey) {
  ui.section(`5-WALLET BALANCES | ${chainKey.toUpperCase()}`);
  const list = await walletManager.checkBalances(chainKey);
  ui.renderTable(
    ['ID', 'Name', 'Address', 'Balance', 'Status'],
    list.map(w => [w.ID, w.Name, w.Address, w.Balance, ui.badge(w.Status)])
  );
}

async function executeGas(chainKey) {
  ui.section(`LIVE GAS STREAM | ${chainKey.toUpperCase()}`);
  ui.log('INFO', `Polling every 2.5s via multi-RPC failover. Press ${c.bYellow}Ctrl+C${c.reset} to exit.\n`);
  gasTracker.watchGas(chainKey, (data) => {
    const time = new Date().toLocaleTimeString();
    const gweiStr = `${c.bGreen}${data.gwei} Gwei${c.reset}`;
    const prioStr = `${c.cyan}${data.priorityGwei} Gwei${c.reset}`;
    const costStr = `${c.bYellow}~${data.estimatedCostEth} ${data.symbol}${c.reset}`;
    console.log(`  ${c.gray}[${time}]${c.reset}  Base: ${gweiStr}  ${c.gray}|${c.reset}  Priority: ${prioStr}  ${c.gray}|${c.reset}  Est. Mint Gas: ${costStr}`);
  });
}

async function executeFund(amt, chainKey) {
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
}

async function executeSweep(chainKey) {
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
}

async function executeInspect(contract, chainKey) {
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
}

async function executeSnipe(contract, chainKey, targetMode = 'all', quantity = 1, speedTier = 'turbo') {
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

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // 1. If user just runs 'sniper' with no args -> show interactive menu!
  if (!command) {
    return interactiveMenu();
  }

  // 2. Help
  if (command === 'help' || command === '--help' || command === '-h') {
    ui.banner();
    console.log(`
  ${c.bWhite}${c.bold}INTERACTIVE MODE:${c.reset}
    Simply run ${c.bGreen}sniper${c.reset} to open the interactive menu with options!

  ${c.bWhite}${c.bold}DIRECT CLI COMMANDS:${c.reset}
    ${c.bGreen}sniper gas [chain]${c.reset}                   Stream live gas fees (prompts chain if omitted)
    ${c.bGreen}sniper wallets [chain]               ${c.reset}Check all 5 wallet balances
    ${c.bGreen}sniper inspect [contract] [chain]    ${c.reset}Inspect drop stages and prices
    ${c.bGreen}sniper snipe [contract] [chain]      ${c.reset}Launch zero-latency mint sniper
    ${c.bGreen}sniper fund [amountEth] [chain]      ${c.reset}Auto-fund sub-wallets from Wallet 1
    ${c.bGreen}sniper sweep [chain]                 ${c.reset}Withdraw leftover funds to Vault
    ${c.bGreen}sniper set-wallet <1-5> <key>        ${c.reset}Save or update private key
    ${c.bGreen}sniper recipient [address]           ${c.reset}Set cold vault address
`);
    return;
  }

  // 3. Direct Gas
  if (command === 'gas') {
    let chainKey = args[1];
    if (!chainKey) chainKey = await selectChainInteractive();
    return executeGas(chainKey);
  }

  // 4. Direct Wallets
  if (command === 'wallets') {
    let chainKey = args[1];
    if (!chainKey) chainKey = await selectChainInteractive();
    return executeWallets(chainKey);
  }

  // 5. Direct Fund
  if (command === 'fund') {
    let amt = args[1];
    if (!amt) amt = await askQuestion(`\n  Enter amount of ETH to fund each sub-wallet (e.g. 0.005): `);
    let chainKey = args[2];
    if (!chainKey) chainKey = await selectChainInteractive();
    return executeFund(amt, chainKey);
  }

  // 6. Direct Sweep
  if (command === 'sweep') {
    let chainKey = args[1];
    if (!chainKey) chainKey = await selectChainInteractive();
    return executeSweep(chainKey);
  }

  // 7. Direct Set Wallet
  if (command === 'set-wallet') {
    let id = args[1];
    let key = args[2];
    if (!id || !key) {
      id = await askQuestion(`  Wallet Slot [1-5]: `);
      key = await askQuestion(`  Enter Private Key: `);
    }
    const res = walletManager.setWalletKey(id, key);
    ui.log('OK', res);
    return;
  }

  // 8. Direct Recipient
  if (command === 'recipient') {
    let addr = args[1];
    if (!addr) {
      const current = walletManager.getRecipient();
      console.log(`\n  Current Vault: ${c.cyan}${current || 'Not set'}${c.reset}`);
      addr = await askQuestion(`  Enter new Recipient Vault address: `);
    }
    if (addr) {
      const res = walletManager.setRecipient(addr);
      ui.log('OK', res);
    }
    return;
  }

  // 9. Direct Inspect
  if (command === 'inspect') {
    let contract = args[1];
    if (!contract) contract = await askQuestion(`  Enter NFT Contract address: `);
    let chainKey = args[2];
    if (!chainKey) chainKey = await selectChainInteractive();
    return executeInspect(contract, chainKey);
  }

  // 10. Direct Snipe
  if (command === 'snipe') {
    let contract = args[1];
    if (!contract) contract = await askQuestion(`  Enter Contract Address to snipe: `);
    let chainKey = args[2];
    if (!chainKey) chainKey = await selectChainInteractive();
    let targetMode = args[3] || 'all';
    
    let quantity = 1;
    let speedTier = 'turbo';
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--qty' && args[i + 1]) quantity = parseInt(args[i + 1], 10) || 1;
      if (args[i] === '--speed' && args[i + 1]) speedTier = args[i + 1].toLowerCase();
    }
    return executeSnipe(contract, chainKey, targetMode, quantity, speedTier);
  }

  console.log(`  ${c.bYellow}Unknown command: ${command}. Run ${c.white}sniper${c.bYellow} for interactive menu.${c.reset}`);
}

main().catch(console.error);
