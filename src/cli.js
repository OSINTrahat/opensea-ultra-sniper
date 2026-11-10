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
const { resolveTarget } = require('./input_resolver');
const config = require('./sniper_config');
const ui = require('./ui');
const { c } = ui;

let pipedLines = [];
let pipedWaiters = [];
let pipedReady = false;

function initPipedReader() {
  if (pipedReady) return;
  pipedReady = true;
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', line => {
    const waiter = pipedWaiters.shift();
    if (waiter) waiter(line.trim());
    else pipedLines.push(line.trim());
  });
}

function askQuestion(query) {
  // Piped input arrives in one burst: queue the lines so each prompt gets its own.
  if (!process.stdin.isTTY) {
    process.stdout.write(query);
    initPipedReader();
    if (pipedLines.length) return Promise.resolve(pipedLines.shift());
    return new Promise(resolve => pipedWaiters.push(resolve));
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

function selectOptionArrow(title, options, opts = {}) {
  const stdin = process.stdin;

  // Non-interactive fallback (piped input / CI): print the screen, read a line.
  if (!stdin.isTTY) {
    ui.screen(title, options, opts.startIndex || 0, opts).forEach(l => console.log(l));
    return askQuestion(`  Select: `).then(ans => {
      const key = String(ans).trim();
      const hit = options.find((o, i) => (o.key !== undefined ? String(o.key) : String(i + 1)) === key);
      return (hit || options[0]).value;
    });
  }

  return new Promise((resolve) => {
    let selectedIndex = Math.min(Math.max(0, opts.startIndex || 0), options.length - 1);
    let frame = [];
    let introDone = false;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function paint() {
      frame = ui.screen(title, options, selectedIndex, opts);
      let skip = 0;
      if (!introDone) {
        introDone = true;
        if (opts.banner) skip = ui.intro(process.stdout.columns);
      }
      const body = skip ? frame.slice(skip) : frame;
      process.stdout.write(body.join('\n') + '\n');
    }

    function repaint() {
      readline.moveCursor(process.stdout, 0, -frame.length);
      readline.clearScreenDown(process.stdout);
      paint();
    }

    function cleanup() {
      stdin.removeListener('data', onData);
      if (stdin.setRawMode) stdin.setRawMode(false);
      stdin.pause();
    }

    function finish(value) {
      readline.moveCursor(process.stdout, 0, -frame.length);
      readline.clearScreenDown(process.stdout);
      const chosen = options.find(o => String(o.value) === String(value));
      if (chosen) ui.pick(String(chosen.label).replace(/^\s*\d+\)\s*/, ''));
      else console.log('');
      cleanup();
      resolve(value);
    }

    function keyOf(opt, idx) {
      return opt.key !== undefined ? String(opt.key) : String(idx + 1);
    }

    function onData(chunk) {
      const key = chunk.toString();

      if (key === '\u0003') { cleanup(); process.stdout.write('\n'); process.exit(0); }
      if (key === 'q' || key === 'Q' || key === '\u001b') {
        const exitOpt = options.find(o => String(o.value) === '0' || String(o.value) === 'exit');
        if (exitOpt) return finish(exitOpt.value);
        cleanup(); process.stdout.write('\n'); process.exit(0);
      }
      if (key === '\r' || key === '\n') return finish(options[selectedIndex].value);
      if (key === '\u001b[A' || key === '\u001bOA') { selectedIndex = (selectedIndex - 1 + options.length) % options.length; return repaint(); }
      if (key === '\u001b[B' || key === '\u001bOB') { selectedIndex = (selectedIndex + 1) % options.length; return repaint(); }

      const hit = options.findIndex((o, i) => keyOf(o, i) === key.trim());
      if (hit >= 0) {
        selectedIndex = hit;
        return finish(options[hit].value);
      }

      // j / k vim keys
      if (key === 'j') { selectedIndex = (selectedIndex + 1) % options.length; return repaint(); }
      if (key === 'k') { selectedIndex = (selectedIndex - 1 + options.length) % options.length; return repaint(); }
    }

    paint();
    stdin.on('data', onData);
  });
}

async function selectChainInteractive(defaultChain = 'base') {
  const opts = [
    { label: '1) Base', hint: '(Chain ID: 8453) [Recommended / Ultra-Cheap]', value: 'base' },
    { label: '2) Ethereum', hint: '(Chain ID: 1) [Flashbots Protect MEV]', value: 'ethereum' },
    { label: '3) Robinhood', hint: '(Chain ID: 48)', value: 'robinhood' },
    { label: '4) Ink Chain', hint: '(Chain ID: 57073)', value: 'ink' }
  ];
  const start = Math.max(0, opts.findIndex(o => o.value === defaultChain));
  return selectOptionArrow('Select Blockchain Network:', opts, { startIndex: start });
}

function showHelp() {
  ui.banner();
  console.log(`
  ${c.bWhite}${c.bold}INTERACTIVE MODE:${c.reset}
    Just run ${c.bGreen}sniper${c.reset} (or double-click ${c.bGreen}run.bat${c.reset}) and pick a menu item.
    ${c.gray}1${c.reset} Snipe / inspect a drop   ${c.gray}2${c.reset} Live gas   ${c.gray}3${c.reset} Balances
    ${c.gray}4${c.reset} Auto-fund wallets        ${c.gray}5${c.reset} Sweep back to vault
    ${c.gray}6${c.reset} Set / update wallet key  ${c.gray}7${c.reset} Set recipient vault

  ${c.bWhite}${c.bold}DIRECT CLI COMMANDS:${c.reset}
    ${c.bGreen}sniper snipe [contract|link] [chain] [all|1|1,2,4]${c.reset}
        Full drop info, then mint. ${c.gray}--qty N  --speed fast|turbo|war${c.reset}
    ${c.bGreen}sniper inspect [contract|link] [chain]${c.reset}
        Read-only: phases, countdown, eligibility. Never signs, never spends.
    ${c.bGreen}sniper gas [chain]${c.reset}                   Stream live gas fees
    ${c.bGreen}sniper wallets [chain]${c.reset}               Check all 5 wallet balances
    ${c.bGreen}sniper fund [amountEth] [chain]${c.reset}      Send gas from Wallet 1 to 2-5
    ${c.bGreen}sniper sweep [chain]${c.reset}                 Withdraw leftover ETH to the vault
    ${c.bGreen}sniper set-wallet <1-5> <key>${c.reset}        Save or update a private key
    ${c.bGreen}sniper recipient [address]${c.reset}           Set the cold vault address

  ${c.bWhite}${c.bold}TIPS:${c.reset}
    ${c.gray}·${c.reset} A raw ${c.white}0x…${c.reset} address or an OpenSea / Basescan / mint link both work.
    ${c.gray}·${c.reset} Arrow keys ${c.white}↑ ↓${c.reset} move, ${c.white}Enter${c.reset} selects, number keys jump, ${c.white}q${c.reset} quits.
    ${c.gray}·${c.reset} In multi mint, type ${c.white}1 2 4 5${c.reset} or ${c.white}all${c.reset}; slots without a key are skipped.

  ${c.bWhite}${c.bold}SAFETY:${c.reset}
    ${c.gray}·${c.reset} Never share your private key — keys stay in ${c.white}wallets.json${c.reset} on this device only.
    ${c.gray}·${c.reset} Use a burner wallet with small funds, not your main wallet.

  ${c.gray}Chains:${c.reset} base · ethereum · robinhood · ink
`);
}

async function interactiveMenu() {
  const choice = await selectOptionArrow('Main Menu', [
    { label: '1) Snipe / Mint Drop', hint: '(Paste address or OpenSea link)', value: 'snipe' },
    { label: '2) Live Gas Stream', hint: '(Monitor Base Fee & Priority Gwei)', value: 'gas' },
    { label: '3) Check Wallet Balances', hint: '(View all 5 wallets on any chain)', value: 'wallets' },
    { label: '4) Auto-Fund Sub-Wallets', hint: '(Send gas from Wallet 1 to Wallets 2-5)', value: 'fund' },
    { label: '5) Sweep Balances', hint: '(Withdraw leftover ETH to Vault)', value: 'sweep' },
    { label: '6) Set / Update Wallet Key', hint: '(Save private key 1 to 5)', value: 'key' },
    { label: '7) Set Recipient Cold Vault', hint: '(Direct delivery address)', value: 'recipient' },
    { label: '8) Help', hint: '(Commands, tips, safety)', value: 'help', key: '8' },
    { label: '0) Exit', hint: 'Close Super Mint', value: 'exit', key: '0' }
  ], { banner: true });

  if (choice === 'exit' || choice === undefined || choice === null) {
    console.log(`\n  ${c.mintBright}${c.bold}Super Mint${c.reset} ${c.gray}closed.${c.reset}\n`);
    return;
  }

  if (choice === 'snipe') {
    const raw = await askQuestion(`\n  Enter NFT Contract Address or OpenSea / mint link: `);
    if (!raw) {
      ui.log('WARN', 'Contract address required.');
      return;
    }
    const target = await resolveTarget(raw);
    if (!target.ok) {
      ui.log('ERROR', target.error);
      return;
    }
    if (target.source !== 'address') {
      ui.log('OK', `Resolved: ${c.cyan}${target.address}${c.reset}${target.chain ? `  (${target.chain})` : ''}`);
    }
    const contract = target.address;
    const chain = target.chain || await selectChainInteractive('base');

    const sp = ui.spinner(`Reading drop data on ${chain.toUpperCase()}…`);
    const info = await loadDropInfo(contract, chain);
    sp.stop();
    if (!info.ok) {
      ui.log('ERROR', info.error);
      return;
    }
    renderDropInfo(info);

    const ids = await chooseTargets(walletManager.loadWallets());
    if (!ids) return;

    const qtyStr = await askQuestion(`  Quantity per NFT wallet (default: 1): `);
    const qty = parseInt(qtyStr, 10) || 1;
    
    const speed = await selectOptionArrow('Priority Gas Boost Tier:', [
      { label: '1) Fast', hint: '(+0% Tip)', value: 'fast' },
      { label: '2) Turbo', hint: '(+35% Tip - Recommended)', value: 'turbo' },
      { label: '3) War', hint: '(+100% Tip - Frontrun MEV)', value: 'war' }
    ]);

    return executeSnipe(contract, chain, ids, qty, speed);
  }

  if (choice === 'gas') {
    const chain = await selectChainInteractive();
    return executeGas(chain);
  }

  if (choice === 'wallets') {
    const chain = await selectChainInteractive();
    return executeWallets(chain);
  }

  if (choice === 'fund') {
    const amt = await askQuestion(`\n  ETH amount to send to each sub-wallet (e.g. 0.005): `);
    if (!amt) return;
    const chain = await selectChainInteractive();
    return executeFund(amt, chain);
  }

  if (choice === 'sweep') {
    const chain = await selectChainInteractive();
    return executeSweep(chain);
  }

  if (choice === 'key') {
    const slot = await selectOptionArrow('Select Wallet Slot to Configure:', [
      { label: '1) Wallet 1', hint: 'Master funder wallet', value: '1' },
      { label: '2) Wallet 2', hint: 'Sniper sub-wallet 1', value: '2' },
      { label: '3) Wallet 3', hint: 'Sniper sub-wallet 2', value: '3' },
      { label: '4) Wallet 4', hint: 'Sniper sub-wallet 3', value: '4' },
      { label: '5) Wallet 5', hint: 'Sniper sub-wallet 4', value: '5' }
    ]);
    const key = await askQuestion(`  Enter Private Key (64-char hex): `);
    if (slot && key) {
      const res = walletManager.setWalletKey(slot, key);
      ui.log('OK', res);
    }
    return;
  }

  if (choice === 'recipient') {
    const current = walletManager.getRecipient();
    console.log(`\n  Current Vault: ${c.cyan}${current || 'Not set (mints deliver to minter wallets)'}${c.reset}`);
    const addr = await askQuestion(`  Enter new Recipient / Vault address (leave empty to keep current): `);
    if (addr) {
      const res = walletManager.setRecipient(addr);
      ui.log('OK', res);
    }
    return;
  }

  if (choice === 'help') {
    showHelp();
    await askQuestion(`\n  Press Enter to go back to the menu... `);
    return interactiveMenu();
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

function shortAddr(a) {
  if (!a) return '—';
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function fmtDur(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function phaseTiming(p) {
  const now = Math.floor(Date.now() / 1000);
  if (p.rawStart && now < p.rawStart) return `in ${fmtDur(p.rawStart - now)}`;
  if (p.rawEnd && now < p.rawEnd) return `${fmtDur(p.rawEnd - now)} left`;
  return 'ended';
}

/** Pull live drop data once, so the dashboard and the mint flow share it. */
async function loadDropInfo(contract, chainKey) {
  const [wallets, liveGas, detection] = await Promise.all([
    walletManager.loadWallets(),
    gasTracker.getLiveGas(chainKey),
    universalDetector.detectContractMintMethod(contract, chainKey)
  ]);
  if (!detection.success) return { ok: false, error: detection.error || 'Failed to detect contract', wallets, liveGas };

  let seadrop = null;
  if (detection.type === 'SEADROP') {
    seadrop = await dropInspector.inspectDrop(contract, chainKey, wallets);
  } else {
    const chain = config.CHAINS[chainKey] || config.CHAINS.base;
    const provider = new ethers.JsonRpcProvider(chain.rpc[0]);
    await Promise.all(wallets.map(async w => {
      if (!w.address) return;
      try { w.balanceEth = parseFloat(ethers.formatEther(await provider.getBalance(w.address))); } catch { /* ignore */ }
    }));
  }
  return { ok: true, wallets, liveGas, detection, seadrop, chainKey, contract };
}

/** Print the full drop dashboard: phases, countdowns, and per-wallet eligibility. */
function renderDropInfo(info) {
  const { contract, chainKey, wallets, liveGas, detection, seadrop } = info;
  const gasEth = parseFloat(liveGas.estimatedCostEth || '0');

  ui.section(`DROP INFO | ${chainKey.toUpperCase()}`);
  ui.infoRow('Contract', contract);
  ui.infoRow('Network', `${chainKey.toUpperCase()} (Chain ID: ${config.CHAINS[chainKey].id})`);
  ui.infoRow('Protocol', seadrop ? `OpenSea SeaDrop (${seadrop.seadropAddress})` : 'Generic ERC-721 mint');
  ui.infoRow('Live Gas', `${liveGas.gwei} Gwei (~${liveGas.estimatedCostEth} ${liveGas.symbol})`);

  let priceEth = 0;
  let activePhaseName = 'Public';
  let phases = [];

  if (seadrop && seadrop.phases.length) {
    phases = seadrop.phases;
    const now = Math.floor(Date.now() / 1000);
    const active = phases.find(p => now >= p.rawStart && now < p.rawEnd);
    const upcoming = phases.filter(p => now < p.rawStart).sort((a, b) => a.rawStart - b.rawStart)[0];
    const target = active || upcoming || phases[phases.length - 1];
    priceEth = parseFloat(String(target.priceEth).replace(/[^\d.]/g, '')) || 0;
    activePhaseName = target.phaseName;

    ui.section('MINT PHASES & COUNTDOWN');
    ui.renderTable(
      ['Phase', 'Price', 'Starts', 'Time Left', 'Max', 'Status'],
      phases.map((p, i) => [
        `#${i + 1} ${p.phaseName}`,
        p.priceEth,
        p.startTime,
        phaseTiming(p),
        String(p.maxPerWallet),
        ui.badge(p.status.replace(/\s*\(.*\)/, ''))
      ])
    );

    const now2 = Math.floor(Date.now() / 1000);
    if (active) {
      ui.log('INFO', `${c.bGreen}${active.phaseName}${c.reset} is LIVE now — ${c.bYellow}${fmtDur(active.rawEnd - now2)}${c.reset} left.`);
    } else if (upcoming) {
      ui.log('INFO', `Next: ${c.cyan}${upcoming.phaseName}${c.reset} opens in ${c.bYellow}${fmtDur(upcoming.rawStart - now2)}${c.reset} (${upcoming.startTime}).`);
    } else {
      ui.log('WARN', 'All phases have ended for this drop.');
    }
  } else {
    priceEth = parseFloat(detection.estimatedPriceEth || '0') || 0;
    ui.section('MINT SCHEDULE');
    ui.infoRow('Type', 'Generic Web3 / Custom Mint');
    ui.infoRow('Functions', (detection.methodsFound || []).join(', ') || 'Fallback mint() supported');
    ui.infoRow('Price', `${priceEth} ETH`);
    ui.infoRow('Status', detection.isPaused ? 'PAUSED' : 'OPEN');
  }

  ui.section('WALLET ELIGIBILITY');
  const rows = wallets.map(w => {
    const s = seadrop ? seadrop.wallets.find(x => x.id === w.id) : null;
    const balEth = s ? s.balanceEth : (w.balanceEth !== undefined ? w.balanceEth : null);
    const need = priceEth + gasEth;
    let verdict = 'ELIGIBLE';
    if (!w.privateKey) verdict = 'NO KEY';
    else if (!w.address) verdict = 'NOT SET';
    else if (balEth === null) verdict = 'UNKNOWN';
    else if (balEth < need) verdict = 'LOW FUNDS';
    else if (s && s.maxPerWallet > 0 && s.mintedCount >= s.maxPerWallet) verdict = 'LIMIT HIT';
    else if (/allowlist|gtd|fcfs/i.test(String(s ? s.phase : activePhaseName))) verdict = 'ALLOWLIST?';
    return [
      String(w.id),
      w.name || `Wallet ${w.id}`,
      shortAddr(w.address),
      s ? s.phase : activePhaseName,
      `${need.toFixed(5)} ETH`,
      balEth === null ? '—' : `${balEth.toFixed(5)} ETH`,
      ui.badge(verdict)
    ];
  });

  ui.renderTable(['#', 'Wallet', 'Address', 'Phase', 'Needed', 'Balance', 'Verdict'], rows);

  const ready = rows.filter(r => !/NO KEY|NOT SET|LOW FUNDS|UNKNOWN|LIMIT|ALLOWLIST/.test(ui.helpers.stripAnsi(r[6])));
  ui.log('INFO', `${c.bGreen}${ready.length}${c.reset} of ${wallets.length} wallets ready to mint at ${c.bYellow}${priceEth} ETH${c.reset} + gas.`);
  if (rows.some(r => /ALLOWLIST/.test(ui.helpers.stripAnsi(r[6])))) {
    ui.log('INFO', `${c.bYellow}ALLOWLIST?${c.reset} means funds are fine, but that phase needs your wallet on the allowlist — the contract cannot reveal that check.`);
  }

  return { priceEth, activePhaseName, phases };
}

/** Single vs multi wallet selection. Returns an array of wallet ids, or null. */
async function chooseTargets(allWallets) {
  const configured = allWallets.filter(w => w.privateKey);
  const mode = await selectOptionArrow('How do you want to mint?', [
    { label: '1) Single wallet', hint: '(one wallet, simplest)', value: 'single' },
    { label: '2) Multi parallel', hint: '(several wallets fire together)', value: 'multi' },
    { label: '0) Cancel', hint: '(back to menu)', value: 'cancel', key: '0' }
  ]);

  if (mode === 'cancel') return null;

  if (!configured.length) {
    ui.log('ERROR', `No wallet keys yet. Use ${c.white}6) Set / Update Wallet Key${c.reset} first.`);
    return null;
  }

  if (mode === 'single') {
    const pick = await selectOptionArrow(
      'Pick wallet to mint with:',
      configured.map(w => ({ label: `${w.id}) ${w.name}`, hint: shortAddr(w.address), value: String(w.id) }))
    );
    return [Number(pick)];
  }

  const raw = await askQuestion(`  Wallet numbers (e.g. 1 2 4 5, or all): `);
  const text = String(raw || '').trim().toLowerCase();
  let ids;
  if (!text || text === 'all') {
    ids = configured.map(w => w.id);
  } else {
    ids = [...new Set((text.match(/\d+/g) || []).map(Number))].filter(n => n >= 1 && n <= 5);
  }

  const chosen = configured.filter(w => ids.includes(w.id));
  const missing = ids.filter(id => !configured.some(w => w.id === id));
  const notSet = allWallets.filter(w => ids.includes(w.id) && !w.privateKey).map(w => w.id);

  if (!chosen.length) {
    ui.log('ERROR', 'None of those wallet slots have a key. Nothing to mint with.');
    return null;
  }
  if (missing.length) ui.log('WARN', `Ignored unknown slot(s): ${missing.join(', ')}.`);
  if (notSet.length) ui.log('WARN', `No key in slot(s): ${notSet.join(', ')} — skipped.`);

  console.log(`\n  ${c.mintNeon}Selected${c.reset}  ${chosen.map(w => `${c.white}${w.id}${c.reset} ${c.gray}${shortAddr(w.address)}${c.reset}`).join('   ')}`);
  return chosen.map(w => w.id);
}

async function executeInspect(contract, chainKey) {
  ui.log('INFO', `Analyzing contract: ${c.cyan}${contract}${c.reset}`);
  const sp = ui.spinner(`Reading drop data on ${chainKey.toUpperCase()}…`);
  const info = await loadDropInfo(contract, chainKey);
  sp.stop();
  if (!info.ok) {
    ui.log('ERROR', info.error);
    return;
  }
  renderDropInfo(info);
}

async function executeSnipe(contract, chainKey, targetMode = 'all', quantity = 1, speedTier = 'turbo') {
  ui.section(`HIGH-FREQUENCY SNIPER INITIALIZATION`);

  const allWallets = walletManager.loadWallets();
  let selectedWallets = [];

  if (Array.isArray(targetMode)) {
    selectedWallets = allWallets.filter(w => targetMode.includes(w.id) && w.privateKey);
    const names = selectedWallets.map(w => `${w.id}:${shortAddr(w.address)}`).join('  ');
    ui.log('INFO', `Target Mode: ${c.cyan}${selectedWallets.length === 1 ? 'SINGLE' : 'MULTI PARALLEL'}${c.reset} -> ${names}`);
  } else if (targetMode === 'all') {
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
    showHelp();
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
    let raw = args[1];
    if (!raw) raw = await askQuestion(`  Enter NFT contract address or OpenSea / mint link: `);
    const target = await resolveTarget(raw);
    if (!target.ok) {
      ui.log('ERROR', target.error);
      return;
    }
    if (target.source !== 'address') {
      ui.log('OK', `Resolved: ${target.address}${target.chain ? `  (${target.chain})` : ''}`);
    }
    let chainKey = args[2];
    if (!chainKey) chainKey = target.chain || await selectChainInteractive('base');
    return executeInspect(target.address, chainKey);
  }

  // 10. Direct Snipe
  if (command === 'snipe') {
    let raw = args[1];
    if (!raw) raw = await askQuestion(`  Enter contract address or OpenSea / mint link: `);
    const target = await resolveTarget(raw);
    if (!target.ok) {
      ui.log('ERROR', target.error);
      return;
    }
    if (target.source !== 'address') {
      ui.log('OK', `Resolved: ${target.address}${target.chain ? `  (${target.chain})` : ''}`);
    }
    const contract = target.address;
    let chainKey = args[2];
    if (!chainKey) chainKey = target.chain || await selectChainInteractive('base');
    let targetMode = args[3] || 'all';
    if (targetMode !== 'all' && /^[\d,\s]+$/.test(targetMode)) {
      const parsedIds = [...new Set(targetMode.match(/\d+/g).map(Number))].filter(n => n >= 1 && n <= 5);
      if (parsedIds.length) targetMode = parsedIds;
    }
    
    let quantity = 1;
    let speedTier = 'turbo';
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--qty' && args[i + 1]) quantity = parseInt(args[i + 1], 10) || 1;
      if (args[i] === '--speed' && args[i + 1]) speedTier = args[i + 1].toLowerCase();
    }

    const sp = ui.spinner(`Reading drop data on ${chainKey.toUpperCase()}…`);
    const info = await loadDropInfo(contract, chainKey);
    sp.stop();
    if (!info.ok) {
      ui.log('ERROR', info.error);
      return;
    }
    renderDropInfo(info);
    return executeSnipe(contract, chainKey, targetMode, quantity, speedTier);
  }

  console.log(`  ${c.bYellow}Unknown command: ${command}. Run ${c.white}sniper${c.bYellow} for interactive menu.${c.reset}`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { renderDropInfo, loadDropInfo, chooseTargets, executeSnipe, fmtDur, phaseTiming };
